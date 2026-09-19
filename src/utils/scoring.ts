import { assignTier, generateRationale, TierThresholds } from './tiering';
import { ScoreResult, ScoringMethod } from '../types';

export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't", 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', "can't", 'cannot',
  'could', "couldn't", 'did', "didn't", 'do', 'does', "doesn't", 'doing', "don't", 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't", 'have', "haven't", 'having', 'he', "he'd",
  "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself', 'him', 'himself', 'his', 'how', "how's", 'i',
  "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into', 'is', "isn't", 'it', "it's", 'its', 'itself', "let's",
  'me', 'more', 'most', "mustn't", 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', "shan't", 'she', "she'd", "she'll",
  "she's", 'should', "shouldn't", 'so', 'some', 'such', 'than', 'that', "that's", 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're", "they've",
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', "wasn't", 'we', "we'd", "we'll",
  "we're", "we've", 'were', "weren't", 'what', "what's", 'when', "when's", 'where', "where's", 'which',
  'while', 'who', "who's", 'whom', 'why', "why's", 'with', "won't", 'would', "wouldn't", 'you', "you'd",
  "you'll", "you're", "you've", 'your', 'yours', 'yourself', 'yourselves'
]);

export function cleanText(raw: string): string {
  if (!raw) return '';
  // Collapse >2 newlines into 2
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  // Strip leading/trailing whitespace per line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  // Strip control chars except newline and tab
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return text.trim();
}

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-zA-Z0-9_\-\+#\.]+\b/g) || [];
  return words.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

export function extractNgrams(tokens: string[]): string[] {
  const ngrams: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    ngrams.push(bigram);
  }
  return ngrams;
}

export function scoreCandidateTfidf(
  jdText: string,
  cvText: string,
  candidateName: string,
  fileName: string,
  thresholds: TierThresholds,
  topK: number = 10
): ScoreResult {
  const cleanJd = cleanText(jdText);
  const cleanCv = cleanText(cvText);

  if (!cleanJd.trim() || !cleanCv.trim()) {
    const tier = assignTier(0, thresholds);
    const { pros, cons, nextAction } = generateRationale(cleanJd, cleanCv, 0, [], []);
    return {
      candidate_name: candidateName,
      file_name: fileName,
      score: 0,
      tier,
      matched_skills: [],
      missing_skills: [],
      pros,
      cons,
      next_action: nextAction,
      raw_breakdown: { method: 'tfidf', similarity: 0 }
    };
  }

  const jdTokens = tokenize(cleanJd);
  const cvTokens = tokenize(cleanCv);

  const jdNgrams = extractNgrams(jdTokens);
  const cvNgrams = extractNgrams(cvTokens);

  // Term Frequency counts
  const jdFreq: Record<string, number> = {};
  for (const term of jdNgrams) {
    jdFreq[term] = (jdFreq[term] || 0) + 1;
  }

  const cvFreq: Record<string, number> = {};
  for (const term of cvNgrams) {
    cvFreq[term] = (cvFreq[term] || 0) + 1;
  }

  // Combined vocabulary
  const vocab = Array.from(new Set([...Object.keys(jdFreq), ...Object.keys(cvFreq)]));

  // Compute TF-IDF weights across the 2 documents
  const nDocs = 2;
  const jdVector: number[] = [];
  const cvVector: number[] = [];

  for (const term of vocab) {
    let docCount = 0;
    if (jdFreq[term]) docCount++;
    if (cvFreq[term]) docCount++;

    // Standard smoothed IDF: ln((1 + n) / (1 + df)) + 1
    const idf = Math.log((1 + nDocs) / (1 + docCount)) + 1;

    const tfJd = (jdFreq[term] || 0) / (jdNgrams.length || 1);
    const tfCv = (cvFreq[term] || 0) / (cvNgrams.length || 1);

    jdVector.push(tfJd * idf);
    cvVector.push(tfCv * idf);
  }

  // Cosine Similarity
  let dotProduct = 0;
  let normJd = 0;
  let normCv = 0;

  for (let i = 0; i < vocab.length; i++) {
    dotProduct += jdVector[i] * cvVector[i];
    normJd += jdVector[i] * jdVector[i];
    normCv += cvVector[i] * cvVector[i];
  }

  let similarity = 0;
  if (normJd > 0 && normCv > 0) {
    similarity = dotProduct / (Math.sqrt(normJd) * Math.sqrt(normCv));
  }
  similarity = Math.min(Math.max(similarity, 0), 1);

  // Extract matched and missing terms based on JD term importance
  const jdTermsSorted = Object.keys(jdFreq).sort((a, b) => {
    const scoreA = jdFreq[a] * (cvFreq[a] ? 1.5 : 1);
    const scoreB = jdFreq[b] * (cvFreq[b] ? 1.5 : 1);
    return scoreB - scoreA;
  });

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const term of jdTermsSorted) {
    if (cvFreq[term]) {
      if (!matchedSkills.includes(term)) {
        matchedSkills.push(term);
      }
    } else {
      if (!missingSkills.includes(term)) {
        missingSkills.push(term);
      }
    }
  }

  const topMatched = matchedSkills.slice(0, topK);
  const topMissing = missingSkills.slice(0, topK);

  const tier = assignTier(similarity, thresholds);
  const { pros, cons, nextAction } = generateRationale(
    cleanJd,
    cleanCv,
    similarity,
    topMatched,
    topMissing
  );

  return {
    candidate_name: candidateName,
    file_name: fileName,
    score: similarity,
    tier,
    matched_skills: topMatched,
    missing_skills: topMissing,
    pros,
    cons,
    next_action: nextAction,
    raw_breakdown: {
      method: 'tfidf',
      vector_shape: [2, vocab.length],
      similarity: parseFloat(similarity.toFixed(3)),
      jd_terms_count: jdTokens.length,
      cv_terms_count: cvTokens.length
    }
  };
}
