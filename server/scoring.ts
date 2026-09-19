import { GoogleGenAI, Type } from '@google/genai';
import { assignTier, generateRationale, TierThresholds } from './tiering';

export interface ScoreOutput {
  candidate_name: string;
  file_name: string;
  score: number;
  tier: 1 | 2 | 3;
  matched_skills: string[];
  missing_skills: string[];
  pros: string[];
  cons: string[];
  next_action: string;
  executive_summary?: string;
  raw_breakdown: Record<string, any>;
}

export interface CandidateInput {
  candidateName: string;
  fileName: string;
  content: string;
}

export const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
};

// Dynamic model routing with cooldown for models experiencing high-demand spikes
const BASE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
const lastHighDemandTime: Record<string, number> = {};
const HIGH_DEMAND_COOLDOWN_MS = 60 * 1000; // 60s cooldown before prioritizing back to primary

function isHighDemandOrQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const status = String(err.status || err.error?.status || err.code || err.error?.code || '');
  return (
    status === '503' ||
    status === 'UNAVAILABLE' ||
    status === '429' ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted')
  );
}

/**
 * Robust Gemini caller with immediate failover on high-demand spikes and model fallbacks
 */
async function callGeminiWithRetry(prompt: string, schema: any, temperature: number = 0.5): Promise<any> {
  const ai = getGenAI();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is missing from environment.');
  }

  // Order models, putting any currently cooling down models at the end
  const now = Date.now();
  const models = [...BASE_MODELS].sort((a, b) => {
    const aBusy = lastHighDemandTime[a] && now - lastHighDemandTime[a] < HIGH_DEMAND_COOLDOWN_MS ? 1 : 0;
    const bBusy = lastHighDemandTime[b] && now - lastHighDemandTime[b] < HIGH_DEMAND_COOLDOWN_MS ? 1 : 0;
    return aBusy - bBusy;
  });

  let lastError: any = null;

  for (const model of models) {
    // If model is cooling down, only do 1 attempt; otherwise up to 2 attempts
    const isCoolingDown = lastHighDemandTime[model] && now - lastHighDemandTime[model] < HIGH_DEMAND_COOLDOWN_MS;
    const maxAttempts = isCoolingDown ? 1 : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature
          }
        });

        if (res.text) {
          const parsed = JSON.parse(res.text);
          // Successfully completed with this model; clear any cooldown
          delete lastHighDemandTime[model];
          return { data: parsed, model };
        }
      } catch (err: any) {
        lastError = err;

        // If the model is experiencing temporary 503 high demand or quota exhaustion,
        // fail over IMMEDIATELY to the next fallback model rather than repeatedly retrying the overloaded model.
        if (isHighDemandOrQuotaError(err)) {
          lastHighDemandTime[model] = Date.now();
          console.info(
            `[Gemini AI] ${model} reported high demand / unavailable (503). Immediately failing over to next available model...`
          );
          break; // Break inner loop immediately to try the next model
        }

        console.warn(`[Gemini AI] Attempt ${attempt} with ${model} error:`, err?.message || err);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 800));
        }
      }
    }
  }

  throw lastError || new Error('Gemini AI evaluation failed across all model attempts.');
}

/**
 * Score all candidates directly and purely with Gemini AI
 */
export async function scoreCandidatesWithAI(
  jdText: string,
  candidates: CandidateInput[],
  method: string,
  thresholds: TierThresholds,
  topK: number = 10
): Promise<ScoreOutput[]> {
  if (candidates.length === 0) return [];

  // Construct structured evaluation prompt
  const methodInstruction =
    method === 'gemini_strict'
      ? 'Apply STRICT recruitment standards: penalize candidates missing mandatory certifications, minimum years of experience, or core engineering tool proficiencies.'
      : method === 'gemini_holistic'
      ? 'Apply HOLISTIC talent evaluation: credit transferable domain competencies, aptitude, leadership trajectory, and related industry accomplishments.'
      : 'Apply BALANCED, high-precision technical recruiting standards: evaluate actual qualification fit, relevant project scale, hands-on tool proficiencies, and domain alignment.';

  const candidatesFormatted = candidates
    .map(
      (c, i) =>
        `==================================================\nCANDIDATE ID #${i + 1}: ${c.candidateName}\nFILE: ${c.fileName}\nRESUME / CV CONTENT:\n${c.content}\n==================================================`
    )
    .join('\n\n');

  const prompt = `You are a Principal Technical Recruiter and Talent Funnel Specialist.
Compare the following candidate resumes directly and purely against the Job Description.

Do NOT perform a simple keyword count or superficial match. Perform a rigorous, grounded, and domain-informed evaluation.

JOB DESCRIPTION:
${jdText}

EVALUATION CRITERIA & MODE:
${methodInstruction}

Tier Assignment Rules:
- Tier 1 (Shortlist / Interview): Match score >= ${thresholds.tier1_min} (${Math.round(thresholds.tier1_min * 100)}%). Exceptional or very strong alignment with core requirements and tools.
- Tier 2 (Review / Technical Screen): Match score >= ${thresholds.tier2_min} (${Math.round(thresholds.tier2_min * 100)}%). Promising overlap or relevant background with addressable skill gaps.
- Tier 3 (Gaps / Reject / Keep on file): Match score < ${thresholds.tier2_min}. Major gaps in mandatory qualifications or mismatched profile.

CANDIDATES TO SCREEN:
${candidatesFormatted}

==================================================
EVALUATION PROTOCOL & GROUNDING MANDATES:
==================================================

1. FACT EXTRACTION PASS (PRE-SCORING REQUIREMENT):
Before assigning scores or drafting commentary, privately extract concrete, verifiable facts for each candidate drawn ONLY from their actual CV text:
- Specific employer names and company backgrounds
- Stated titles, roles, and verified years/durations
- Team sizes, project budgets, territory scope, or megawatt/power ratings
- Specific software tools, CAD platforms, or instruments explicitly stated
- Measurable outcomes, delivered milestones, and quantified achievements
Do NOT infer, invent, extrapolate, or assume unstated credentials as facts.

2. HARD ANTI-TEMPLATING RULES:
- Every single sentence in "pros", "cons", and "executive_summary" MUST be directly traceable to a specific fact in that candidate's CV text (such as a named employer, stated metric/number, specific project scale, or actual job title).
- STRICT BAN on generic filler adjectives and buzzwords (e.g. "elite", "highly accustomed", "deeply expert", "seasoned veteran", "proven track record") UNLESS immediately followed in the exact same sentence by the specific, concrete fact from the CV backing it up (e.g. "Brings 6 years at Tata Solar designing 50MW plants" instead of "Elite solar capability").
- If any evaluation sentence could be copied and pasted onto another candidate without being factually false, it is templated and strictly forbidden.

3. CROSS-CANDIDATE COMPARISON PASS:
- After scoring each candidate individually, re-read all candidates together as a cohort.
- Ensure equivalent evidence across candidates receives equivalent scoring treatment.
- Check that no two candidate write-ups or summaries are interchangeable. If any two sound generic or interchangeable, rewrite them to highlight the genuine, distinct differences in their backgrounds.

4. "NO EVIDENCE" HONESTY RULE:
- If a candidate's CV is genuinely thin, irrelevant, or lacking depth for this Job Description, state this plainly in "executive_summary" (e.g. "Candidate's resume contains no solar or electrical engineering background, detailing only general retail administration").
- Do NOT pad or invent hypothetical strengths or soft skills to fill out the pros.

For every single candidate (from candidate 1 to ${candidates.length}), output:
1. candidate_index: matching the candidate's numeric index (1 to ${candidates.length}).
2. candidate_name: the candidate's full name.
3. score: a calibrated float score between 0.00 and 1.00 reflecting genuine role suitability grounded in actual CV evidence.
4. tier: 1, 2, or 3 based on the score and thresholds above.
5. matched_skills: array of specific technical skills, softwares, tools, and domain qualifications the candidate explicitly possesses in their CV for this job (up to ${topK}).
6. missing_skills: array of critical requirements from the JD that this candidate lacks or has insufficient proof of in their CV (up to ${topK}).
7. pros: 2 to 4 specific bullet points of this candidate's strongest qualifications or achievements, citing actual employers, metrics, or tools from their CV.
8. cons: 1 to 3 specific bullet points of candidate limitations, risks, or gaps for this role, grounded in what the CV actually lacks.
9. next_action: a clear, decisive next recruitment step (e.g. "Fast-track to Technical Interview", "Conduct 30-min phone screen on electrical design", "Decline / Archive profile").
10. executive_summary: a concise 2-3 sentence AI evaluation verdict synthesizing why this candidate received this score and tier, grounded in concrete CV facts.
11. evidence_quotes: array of up to 3 short quote fragments lifted verbatim from the candidate's CV that directly support the score assessment (or empty array if no relevant experience exists).`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        candidate_index: { type: Type.INTEGER },
        candidate_name: { type: Type.STRING },
        score: { type: Type.NUMBER },
        tier: { type: Type.INTEGER },
        matched_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
        missing_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
        pros: { type: Type.ARRAY, items: { type: Type.STRING } },
        cons: { type: Type.ARRAY, items: { type: Type.STRING } },
        next_action: { type: Type.STRING },
        executive_summary: { type: Type.STRING },
        evidence_quotes: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: [
        'candidate_index',
        'candidate_name',
        'score',
        'tier',
        'matched_skills',
        'missing_skills',
        'pros',
        'cons',
        'next_action',
        'executive_summary'
      ]
    }
  };

  try {
    const { data, model } = await callGeminiWithRetry(prompt, schema, 0.5);
    if (Array.isArray(data) && data.length > 0) {
      const results: ScoreOutput[] = [];

      candidates.forEach((cand, idx) => {
        const item = data.find((d: any) => d.candidate_index === idx + 1) || data[idx];
        if (item) {
          const rawScore = typeof item.score === 'number' ? item.score : 0;
          const clampedScore = Math.min(Math.max(rawScore, 0), 1);
          // Re-verify tier against user thresholds
          let calculatedTier: 1 | 2 | 3 = 3;
          if (clampedScore >= thresholds.tier1_min) calculatedTier = 1;
          else if (clampedScore >= thresholds.tier2_min) calculatedTier = 2;

          results.push({
            candidate_name: item.candidate_name || cand.candidateName,
            file_name: cand.fileName,
            score: clampedScore,
            tier: calculatedTier,
            matched_skills: Array.isArray(item.matched_skills) ? item.matched_skills : [],
            missing_skills: Array.isArray(item.missing_skills) ? item.missing_skills : [],
            pros: Array.isArray(item.pros) ? item.pros : [],
            cons: Array.isArray(item.cons) ? item.cons : [],
            next_action: item.next_action || 'Review candidate profile',
            executive_summary: item.executive_summary || '',
            raw_breakdown: {
              method: 'Gemini AI Intelligence',
              model,
              ai_reasoning: 'Deep Semantic & Technical Capability Evaluation',
              similarity: Number(clampedScore.toFixed(2)),
              evidence_quotes: Array.isArray(item.evidence_quotes) ? item.evidence_quotes : []
            }
          });
        }
      });

      return results;
    }
  } catch (err) {
    console.error('[scoring] Gemini batch evaluation error:', err);
    throw err;
  }

  throw new Error('No evaluation results generated by AI.');
}

/**
 * Score a single candidate with Gemini AI
 */
export async function scoreCandidate(
  jdText: string,
  cvText: string,
  candidateName: string,
  fileName: string,
  method: string,
  thresholds: TierThresholds,
  topK: number = 10
): Promise<ScoreOutput> {
  const batchResult = await scoreCandidatesWithAI(
    jdText,
    [{ candidateName, fileName, content: cvText }],
    method,
    thresholds,
    topK
  );

  if (batchResult.length > 0) {
    return batchResult[0];
  }

  throw new Error(`Failed to evaluate candidate ${candidateName} with AI.`);
}
