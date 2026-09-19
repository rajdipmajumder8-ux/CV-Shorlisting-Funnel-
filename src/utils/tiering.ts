export interface TierThresholds {
  tier1_min: number;
  tier2_min: number;
}

export function assignTier(score: number, thresholds: TierThresholds): 1 | 2 | 3 {
  if (score >= thresholds.tier1_min) {
    return 1;
  }
  if (score >= thresholds.tier2_min) {
    return 2;
  }
  return 3;
}

export function generateRationale(
  jdText: string,
  cvText: string,
  score: number,
  matched: string[],
  missing: string[]
): { pros: string[]; cons: string[]; nextAction: string } {
  const pros: string[] = [];
  const cons: string[] = [];
  let nextAction = '';

  if (score >= 0.75) {
    pros.push('Strong alignment with core job requirements');
    if (matched.length > 0) {
      const topMatched = matched.slice(0, 3);
      pros.push(`Key matching skills: ${topMatched.join(', ')}`);
    }
    if (missing.length > 0) {
      const topMissing = missing.slice(0, 3);
      cons.push(`Minor gaps in: ${topMissing.join(', ')}`);
    }
    nextAction = 'Schedule interview';
  } else if (score >= 0.50) {
    pros.push('Moderate alignment with job requirements');
    if (matched.length > 0) {
      const topMatched = matched.slice(0, 3);
      pros.push(`Relevant skills: ${topMatched.join(', ')}`);
    }
    if (missing.length > 0) {
      const topMissing = missing.slice(0, 3);
      cons.push(`Missing key requirements: ${topMissing.join(', ')}`);
    }
    cons.push('Partial skill overlap — may need upskilling');
    nextAction = 'Technical screen recommended';
  } else {
    if (matched.length > 0) {
      pros.push(`Some relevant background: ${matched.slice(0, 3).join(', ')}`);
    } else {
      pros.push('Limited direct skill overlap');
    }
    if (missing.length > 0) {
      const topMissing = missing.slice(0, 3);
      cons.push(`Significant gaps in required skills: ${topMissing.join(', ')}`);
    }
    cons.push('Does not meet minimum requirements for this role');
    nextAction = 'Consider for future roles / reject';
  }

  return { pros, cons, nextAction };
}
