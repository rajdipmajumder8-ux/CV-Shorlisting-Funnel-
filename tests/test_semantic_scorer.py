import pytest
from src.scoring.semantic_scorer import score_candidate_semantic, get_embedding_model, ScoreResult


class TestScoreCandidateSemantic:
    def test_identical_texts_high_score(self):
        jd = "Python developer with Flask and PostgreSQL experience"
        cv = "Python developer with Flask and PostgreSQL experience"
        result = score_candidate_semantic(jd, cv, top_k=5)
        assert isinstance(result, ScoreResult)
        assert result.score > 0.85
        assert len(result.matched_skills) > 0

    def test_disjoint_texts_low_score(self):
        jd = "Python developer with Flask and PostgreSQL"
        cv = "Marketing manager with SEO and social media expertise"
        result = score_candidate_semantic(jd, cv, top_k=5)
        assert result.score < 0.5

    def test_partial_overlap_mid_score(self):
        jd = "Python developer with Flask, PostgreSQL, Docker, AWS"
        cv = "Python engineer with Flask, Docker, Kubernetes, GCP"
        result = score_candidate_semantic(jd, cv, top_k=5)
        assert 0.4 < result.score < 0.9
        matched_lower = [s.lower() for s in result.matched_skills]
        assert any("python" in s for s in matched_lower) or any("flask" in s for s in matched_lower) or any("docker" in s for s in matched_lower)

    def test_missing_skills_from_jd(self):
        jd = "Python, Flask, PostgreSQL, Docker, AWS, Kubernetes"
        cv = "Python, Flask, Docker"
        result = score_candidate_semantic(jd, cv, top_k=10)
        missing_lower = [s.lower() for s in result.missing_skills]
        assert any("postgresql" in s for s in missing_lower) or any("aws" in s for s in missing_lower) or any("kubernetes" in s for s in missing_lower)

    def test_top_k_parameter(self):
        jd = "skill one skill two skill three skill four skill five"
        cv = "skill one skill two skill three skill four skill five"
        result = score_candidate_semantic(jd, cv, top_k=3)
        assert len(result.matched_skills) <= 3
        assert len(result.missing_skills) <= 3

    def test_empty_texts_zero_score(self):
        result = score_candidate_semantic("", "Python developer", top_k=5)
        assert result.score == 0.0
        result = score_candidate_semantic("Python developer", "", top_k=5)
        assert result.score == 0.0

    def test_raw_breakdown_contains_expected_keys(self):
        jd = "Python Flask PostgreSQL"
        cv = "Python Flask"
        result = score_candidate_semantic(jd, cv, top_k=5)
        assert result.raw_breakdown["method"] == "semantic"
        assert "model" in result.raw_breakdown
        assert "jd_embedding_shape" in result.raw_breakdown
        assert "cv_embedding_shape" in result.raw_breakdown
        assert "similarity" in result.raw_breakdown
        assert result.raw_breakdown["similarity"] == pytest.approx(result.score, abs=1e-6)

    def test_default_model_name(self):
        jd = "Python"
        cv = "Python"
        result = score_candidate_semantic(jd, cv, top_k=5)
        assert result.raw_breakdown["model"] == "all-MiniLM-L6-v2"

    def test_custom_model_name_passed_through(self):
        jd = "Python"
        cv = "Python"
        result = score_candidate_semantic(jd, cv, model_name="paraphrase-MiniLM-L3-v2", top_k=5)
        assert result.raw_breakdown["model"] == "paraphrase-MiniLM-L3-v2"


class TestGetEmbeddingModel:
    def test_singleton_caching(self):
        model1 = get_embedding_model("all-MiniLM-L6-v2")
        model2 = get_embedding_model("all-MiniLM-L6-v2")
        assert model1 is model2

    def test_different_models_different_instances(self):
        model1 = get_embedding_model("all-MiniLM-L6-v2")
        model2 = get_embedding_model("paraphrase-MiniLM-L3-v2")
        assert model1 is not model2

    def test_model_has_encode_method(self):
        model = get_embedding_model("all-MiniLM-L6-v2")
        assert hasattr(model, 'encode')
        embeddings = model.encode(["test sentence"])
        assert embeddings.shape == (1, 384)