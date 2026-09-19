from dataclasses import dataclass
from typing import List, Dict, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

from src.scoring.tfidf_scorer import ScoreResult


_model_cache: Dict[str, object] = {}


def get_embedding_model(model_name: str = "all-MiniLM-L6-v2"):
    """Load/cached model — singleton per session."""
    global _model_cache
    if model_name not in _model_cache:
        from sentence_transformers import SentenceTransformer
        _model_cache[model_name] = SentenceTransformer(model_name)
    return _model_cache[model_name]


def _extract_keywords_tfidf(text: str, top_k: int) -> List[str]:
    """Extract keywords using TF-IDF for overlap analysis."""
    if not text.strip():
        return []
    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=1,
        max_df=1.0
    )
    try:
        tfidf_matrix = vectorizer.fit_transform([text])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]
        top_indices = scores.argsort()[-top_k:][::-1]
        return [feature_names[i] for i in top_indices if scores[i] > 0]
    except ValueError:
        return []


def score_candidate_semantic(
    jd_text: str,
    cv_text: str,
    model_name: str = "all-MiniLM-L6-v2",
    top_k: int = 10
) -> ScoreResult:
    """Embed JD and CV, cosine similarity, keyword overlap via embedding proximity."""
    if not jd_text.strip() or not cv_text.strip():
        return ScoreResult(
            candidate_name="Unknown",
            file_name="unknown.txt",
            score=0.0,
            tier=3,
            matched_skills=[],
            missing_skills=[],
            pros=[],
            cons=[],
            next_action="",
            raw_breakdown={
                "method": "semantic",
                "model": model_name,
                "jd_embedding_shape": (0,),
                "cv_embedding_shape": (0,),
                "similarity": 0.0
            }
        )

    model = get_embedding_model(model_name)

    jd_embedding = model.encode([jd_text], convert_to_numpy=True, normalize_embeddings=True)[0]
    cv_embedding = model.encode([cv_text], convert_to_numpy=True, normalize_embeddings=True)[0]

    similarity = float(cosine_similarity([jd_embedding], [cv_embedding])[0, 0])

    jd_keywords = set(_extract_keywords_tfidf(jd_text, top_k * 2))
    cv_keywords = set(_extract_keywords_tfidf(cv_text, top_k * 2))

    matched = list(jd_keywords & cv_keywords)[:top_k]
    missing = list(jd_keywords - cv_keywords)[:top_k]

    return ScoreResult(
        candidate_name="Unknown",
        file_name="unknown.txt",
        score=similarity,
        tier=3,
        matched_skills=matched,
        missing_skills=missing,
        pros=[],
        cons=[],
        next_action="",
        raw_breakdown={
            "method": "semantic",
            "model": model_name,
            "jd_embedding_shape": jd_embedding.shape,
            "cv_embedding_shape": cv_embedding.shape,
            "similarity": similarity
        }
    )