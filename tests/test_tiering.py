import pytest
from src.tiering import (
    TierThresholds,
    assign_tier,
    generate_rationale,
    build_final_result,
    ScoreResult
)


class TestAssignTier:
    def test_tier1_at_threshold(self):
        thresholds = TierThresholds(tier1_min=0.75, tier2_min=0.50)
        assert assign_tier(0.75, thresholds) == 1
        assert assign_tier(0.80, thresholds) == 1
        assert assign_tier(1.0, thresholds) == 1

    def test_tier2_at_threshold(self):
        thresholds = TierThresholds(tier1_min=0.75, tier2_min=0.50)
        assert assign_tier(0.50, thresholds) == 2
        assert assign_tier(0.60, thresholds) == 2
        assert assign_tier(0.74, thresholds) == 2

    def test_tier3_below_tier2(self):
        thresholds = TierThresholds(tier1_min=0.75, tier2_min=0.50)
        assert assign_tier(0.49, thresholds) == 3
        assert assign_tier(0.20, thresholds) == 3
        assert assign_tier(0.0, thresholds) == 3

    def test_custom_thresholds(self):
        thresholds = TierThresholds(tier1_min=0.80, tier2_min=0.60)
        assert assign_tier(0.80, thresholds) == 1
        assert assign_tier(0.60, thresholds) == 2
        assert assign_tier(0.59, thresholds) == 3


class TestGenerateRationale:
    def test_tier1_pros_cons_action(self):
        jd = "Python Flask PostgreSQL Docker AWS"
        cv = "Python Flask PostgreSQL Docker AWS Kubernetes"
        matched = ["Python", "Flask", "PostgreSQL", "Docker", "AWS"]
        missing = ["Kubernetes"]
        
        pros, cons, action = generate_rationale(jd, cv, 0.85, matched, missing)
        
        assert len(pros) > 0
        assert any("strong" in p.lower() or "excellent" in p.lower() or "alignment" in p.lower() for p in pros)
        assert action == "Schedule interview"

    def test_tier2_pros_cons_action(self):
        jd = "Python Flask PostgreSQL Docker AWS"
        cv = "Python Flask Docker"
        matched = ["Python", "Flask", "Docker"]
        missing = ["PostgreSQL", "AWS"]
        
        pros, cons, action = generate_rationale(jd, cv, 0.60, matched, missing)
        
        assert len(pros) > 0
        assert len(cons) > 0
        assert any("postgresql" in c.lower() or "aws" in c.lower() for c in cons)
        assert action == "Technical screen recommended"

    def test_tier3_pros_cons_action(self):
        jd = "Python Flask PostgreSQL Docker AWS"
        cv = "Java Spring Hibernate"
        matched = []
        missing = ["Python", "Flask", "PostgreSQL", "Docker", "AWS"]
        
        pros, cons, action = generate_rationale(jd, cv, 0.15, matched, missing)
        
        assert len(cons) > 0
        assert any("gap" in c.lower() or "missing" in c.lower() or "limited" in c.lower() for c in cons)
        assert action == "Consider for future roles / reject"

    def test_matched_skills_in_pros(self):
        jd = "Python Flask PostgreSQL"
        cv = "Python Flask"
        matched = ["Python", "Flask"]
        missing = ["PostgreSQL"]
        
        pros, cons, action = generate_rationale(jd, cv, 0.70, matched, missing)
        
        assert any("python" in p.lower() for p in pros)
        assert any("flask" in p.lower() for p in pros)

    def test_missing_skills_in_cons(self):
        jd = "Python Flask PostgreSQL Docker"
        cv = "Python Flask"
        matched = ["Python", "Flask"]
        missing = ["PostgreSQL", "Docker"]
        
        pros, cons, action = generate_rationale(jd, cv, 0.55, matched, missing)
        
        assert any("postgresql" in c.lower() for c in cons)
        assert any("docker" in c.lower() for c in cons)

    def test_empty_matched_and_missing(self):
        pros, cons, action = generate_rationale("", "", 0.0, [], [])
        assert isinstance(pros, list)
        assert isinstance(cons, list)
        assert isinstance(action, str)


class TestBuildFinalResult:
    def test_attaches_tier_and_rationale(self):
        base = ScoreResult(
            candidate_name="John Doe",
            file_name="john_cv.pdf",
            score=0.82,
            matched_skills=["Python", "Flask"],
            missing_skills=["AWS"],
            raw_breakdown={"method": "tfidf", "similarity": 0.82}
        )
        thresholds = TierThresholds(tier1_min=0.75, tier2_min=0.50)
        
        result = build_final_result(base, thresholds)
        
        assert result.tier == 1
        assert len(result.pros) > 0
        assert len(result.cons) > 0
        assert result.next_action == "Schedule interview"
        assert result.candidate_name == "John Doe"
        assert result.file_name == "john_cv.pdf"
        assert result.score == 0.82

    def test_tier2_result(self):
        base = ScoreResult(
            candidate_name="Jane Smith",
            file_name="jane_cv.pdf",
            score=0.60,
            matched_skills=["Python"],
            missing_skills=["Flask", "PostgreSQL"],
            raw_breakdown={"method": "tfidf", "similarity": 0.60}
        )
        thresholds = TierThresholds(tier1_min=0.75, tier2_min=0.50)
        
        result = build_final_result(base, thresholds)
        
        assert result.tier == 2
        assert result.next_action == "Technical screen recommended"

    def test_tier3_result(self):
        base = ScoreResult(
            candidate_name="Bob Wilson",
            file_name="bob_cv.pdf",
            score=0.30,
            matched_skills=[],
            missing_skills=["Python", "Flask", "PostgreSQL"],
            raw_breakdown={"method": "tfidf", "similarity": 0.30}
        )
        thresholds = TierThresholds(tier1_min=0.75, tier2_min=0.50)
        
        result = build_final_result(base, thresholds)
        
        assert result.tier == 3
        assert result.next_action == "Consider for future roles / reject"

    def test_preserves_raw_breakdown(self):
        base = ScoreResult(
            candidate_name="Test",
            file_name="test.pdf",
            score=0.50,
            matched_skills=[],
            missing_skills=[],
            raw_breakdown={"method": "tfidf", "custom_field": "test_value"}
        )
        thresholds = TierThresholds()
        
        result = build_final_result(base, thresholds)
        
        assert result.raw_breakdown["custom_field"] == "test_value"
        assert result.raw_breakdown["method"] == "tfidf"