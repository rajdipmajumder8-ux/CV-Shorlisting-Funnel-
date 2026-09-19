from dataclasses import dataclass
from typing import List, Literal, Tuple
from src.scoring.tfidf_scorer import ScoreResult


@dataclass
class TierThresholds:
    tier1_min: float = 0.75
    tier2_min: float = 0.50


def assign_tier(score: float, thresholds: TierThresholds) -> Literal[1, 2, 3]:
    if score >= thresholds.tier1_min:
        return 1
    if score >= thresholds.tier2_min:
        return 2
    return 3


def generate_rationale(
    jd_text: str,
    cv_text: str,
    score: float,
    matched: List[str],
    missing: List[str]
) -> Tuple[List[str], List[str], str]:
    """Return (pros, cons, next_action) based on score bands + keyword evidence."""
    pros = []
    cons = []

    matched_lower = [m.lower() for m in matched]
    missing_lower = [m.lower() for m in missing]

    if score >= 0.75:
        pros.append("Strong alignment with core job requirements")
        if matched:
            top_matched = matched[:3]
            pros.append(f"Key matching skills: {', '.join(top_matched)}")
        if missing:
            top_missing = missing[:3]
            cons.append(f"Minor gaps in: {', '.join(top_missing)}")
        next_action = "Schedule interview"

    elif score >= 0.50:
        pros.append("Moderate alignment with job requirements")
        if matched:
            top_matched = matched[:3]
            pros.append(f"Relevant skills: {', '.join(top_matched)}")
        if missing:
            top_missing = missing[:3]
            cons.append(f"Missing key requirements: {', '.join(top_missing)}")
        cons.append("Partial skill overlap — may need upskilling")
        next_action = "Technical screen recommended"

    else:
        if matched:
            pros.append(f"Some relevant background: {', '.join(matched[:3])}")
        else:
            pros.append("Limited direct skill overlap")
        if missing:
            top_missing = missing[:3]
            cons.append(f"Significant gaps in required skills: {', '.join(top_missing)}")
        cons.append("Does not meet minimum requirements for this role")
        next_action = "Consider for future roles / reject"

    return pros, cons, next_action


def build_final_result(base: ScoreResult, thresholds: TierThresholds) -> ScoreResult:
    """Attach tier, pros, cons, next_action to base ScoreResult."""
    tier = assign_tier(base.score, thresholds)
    pros, cons, next_action = generate_rationale(
        "", "", base.score, base.matched_skills, base.missing_skills
    )
    
    return ScoreResult(
        candidate_name=base.candidate_name,
        file_name=base.file_name,
        score=base.score,
        tier=tier,
        matched_skills=base.matched_skills,
        missing_skills=base.missing_skills,
        pros=pros,
        cons=cons,
        next_action=next_action,
        raw_breakdown=base.raw_breakdown
    )