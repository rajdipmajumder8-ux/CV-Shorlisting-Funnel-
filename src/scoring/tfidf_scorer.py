from dataclasses import dataclass
from typing import List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


@dataclass
class ScoreResult:
    candidate_name: str
    file_name: str
    score: float
    tier: int = 3
    matched_skills: List[str] = None
    missing_skills: List[str] = None
    pros: List[str] = None
    cons: List[str] = None
    next_action: str = ""
    raw_breakdown: dict = None

    def __post_init__(self):
        if self.matched_skills is None:
            self.matched_skills = []
        if self.missing_skills is None:
            self.missing_skills = []
        if self.pros is None:
            self.pros = []
        if self.cons is None:
            self.cons = []
        if self.raw_breakdown is None:
            self.raw_breakdown = {}


def _extract_key_terms(text: str, vectorizer: TfidfVectorizer, doc_index: int, top_k: int) -> list[str]:
    """Extract top-k terms by TF-IDF weight for a document."""
    tfidf_matrix = vectorizer.transform([text])
    feature_names = vectorizer.get_feature_names_out()
    scores = tfidf_matrix.toarray()[0]
    top_indices = scores.argsort()[-top_k:][::-1]
    return [feature_names[i] for i in top_indices if scores[i] > 0]


def score_candidate_tfidf(jd_text: str, cv_text: str, top_k: int = 10) -> ScoreResult:
    """TF-IDF vectorize JD + CV together, cosine similarity, extract top-k overlapping terms."""
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
            raw_breakdown={"method": "tfidf", "vector_shape": (0, 0), "similarity": 0.0}
        )

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=1,
        max_df=1.0
    )

    corpus = [jd_text, cv_text]
    tfidf_matrix = vectorizer.fit_transform(corpus)

    similarity_matrix = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
    score = float(similarity_matrix[0, 0])

    jd_terms = set(_extract_key_terms(jd_text, vectorizer, 0, top_k * 2))
    cv_terms = set(_extract_key_terms(cv_text, vectorizer, 1, top_k * 2))

    matched = list(jd_terms & cv_terms)[:top_k]
    missing = list(jd_terms - cv_terms)[:top_k]

    return ScoreResult(
        candidate_name="Unknown",
        file_name="unknown.txt",
        score=score,
        tier=3,
        matched_skills=matched,
        missing_skills=missing,
        pros=[],
        cons=[],
        next_action="",
        raw_breakdown={
            "method": "tfidf",
            "vector_shape": tfidf_matrix.shape,
            "similarity": score
        }
    )