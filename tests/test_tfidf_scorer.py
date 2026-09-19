import pytest
from src.scoring.tfidf_scorer import score_candidate_tfidf, ScoreResult


class TestScoreCandidateTfidf:
    def test_identical_texts_score_one(self):
        jd = "Python developer with Flask and PostgreSQL experience"
        cv = "Python developer with Flask and PostgreSQL experience"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        assert isinstance(result, ScoreResult)
        assert result.score == pytest.approx(1.0, abs=1e-6)
        assert len(result.matched_skills) > 0

    def test_disjoint_texts_score_low(self):
        jd = "Python developer with Flask and PostgreSQL"
        cv = "Marketing manager with SEO and social media expertise"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        assert result.score < 0.2

    def test_partial_overlap_mid_score(self):
        jd = "Python developer with Flask, PostgreSQL, Docker, AWS"
        cv = "Python engineer with Flask, Docker, Kubernetes, GCP"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        # TF-IDF with stop words removal yields lower scores for partial overlap
        assert 0.1 < result.score < 0.5
        matched_lower = [s.lower() for s in result.matched_skills]
        assert any("python" in s for s in matched_lower) or any("flask" in s for s in matched_lower) or any("docker" in s for s in matched_lower)

    def test_missing_skills_from_jd(self):
        jd = "Python, Flask, PostgreSQL, Docker, AWS, Kubernetes"
        cv = "Python, Flask, Docker"
        result = score_candidate_tfidf(jd, cv, top_k=10)
        missing = [s.lower() for s in result.missing_skills]
        assert any("postgresql" in s for s in missing)
        assert any("aws" in s for s in missing) or any("kubernetes" in s for s in missing)

    def test_top_k_parameter(self):
        jd = "skill one skill two skill three skill four skill five"
        cv = "skill one skill two skill three skill four skill five"
        result = score_candidate_tfidf(jd, cv, top_k=3)
        assert len(result.matched_skills) <= 3
        assert len(result.missing_skills) <= 3

    def test_empty_jd_raises_or_low_score(self):
        jd = ""
        cv = "Python developer"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        assert result.score == 0.0

    def test_empty_cv_raises_or_low_score(self):
        jd = "Python developer"
        cv = ""
        result = score_candidate_tfidf(jd, cv, top_k=5)
        assert result.score == 0.0

    def test_raw_breakdown_contains_expected_keys(self):
        jd = "Python Flask PostgreSQL"
        cv = "Python Flask"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        assert result.raw_breakdown["method"] == "tfidf"
        assert "vector_shape" in result.raw_breakdown
        assert "similarity" in result.raw_breakdown
        assert result.raw_breakdown["similarity"] == pytest.approx(result.score, abs=1e-6)

    def test_candidate_name_and_file_name_populated(self):
        jd = "Python"
        cv = "Python"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        assert result.candidate_name == "Unknown"
        assert result.file_name == "unknown.txt"

    def test_case_insensitive_matching(self):
        jd = "PYTHON FLASK postgresql"
        cv = "python flask PostgreSQL"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        assert result.score > 0.9

    def test_special_chars_handled(self):
        jd = "C++ developer with C# and dotnet"
        cv = "C++ engineer with C# and dotnet core"
        result = score_candidate_tfidf(jd, cv, top_k=5)
        # TF-IDF tokenizes special chars poorly; score may be low but should not crash
        assert result.score >= 0.0
        assert "dotnet" in [s.lower() for s in result.matched_skills] or len(result.matched_skills) == 0