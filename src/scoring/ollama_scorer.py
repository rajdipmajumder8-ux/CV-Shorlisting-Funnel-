from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
import logging
import httpx

from src.scoring.tfidf_scorer import ScoreResult

logger = logging.getLogger(__name__)


class OllamaModel(str, Enum):
    LLAMA31_8B = "llama3.1:8b"
    NOMIC_EMBED = "nomic-embed-text"
    MXBAI_EMBED = "mxbai-embed-large"


OLLAMA_BASE_URL = "http://localhost:11434"
REQUEST_TIMEOUT = 10.0


def is_ollama_available() -> bool:
    """Health check — GET /api/tags, timeout 2s."""
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            return True
    except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError):
        return False
    except Exception:
        return False


def _score_with_embeddings(jd_text: str, cv_text: str, model: OllamaModel) -> Optional[float]:
    """Use embeddings endpoint for nomic/mxbai models."""
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            jd_resp = client.post(
                f"{OLLAMA_BASE_URL}/api/embeddings",
                json={"model": model.value, "prompt": jd_text}
            )
            jd_resp.raise_for_status()
            jd_embedding = jd_resp.json().get("embedding", [])

            cv_resp = client.post(
                f"{OLLAMA_BASE_URL}/api/embeddings",
                json={"model": model.value, "prompt": cv_text}
            )
            cv_resp.raise_for_status()
            cv_embedding = cv_resp.json().get("embedding", [])

        if not jd_embedding or not cv_embedding:
            return None

        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np
        similarity = float(cosine_similarity([jd_embedding], [cv_embedding])[0, 0])
        return max(0.0, min(1.0, similarity))
    except Exception as e:
        logger.warning(f"Ollama embeddings scoring failed: {e}")
        return None


def _score_with_chat(jd_text: str, cv_text: str, model: OllamaModel) -> Optional[float]:
    """Use chat endpoint for llama models with prompt engineering."""
    prompt = f"""Rate the match between this job description and candidate CV on a scale of 0.0 to 1.0.
Return ONLY a single number (e.g., 0.75).

Job Description:
{jd_text}

Candidate CV:
{cv_text}

Match score:"""

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": model.value,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.1}
                }
            )
            response.raise_for_status()
            content = response.json().get("message", {}).get("content", "").strip()
            
            # Extract first float from response
            import re
            match = re.search(r'0?\.\d+|1\.0|0|1', content)
            if match:
                score = float(match.group())
                return max(0.0, min(1.0, score))
            return None
    except Exception as e:
        logger.warning(f"Ollama chat scoring failed: {e}")
        return None


def score_candidate_ollama(
    jd_text: str,
    cv_text: str,
    model: OllamaModel = OllamaModel.NOMIC_EMBED,
    top_k: int = 10
) -> Optional[ScoreResult]:
    """Call local Ollama HTTP API. Returns None on any failure (caller falls back)."""
    if not jd_text.strip() or not cv_text.strip():
        return None

    # Route to appropriate endpoint based on model type
    if model in (OllamaModel.NOMIC_EMBED, OllamaModel.MXBAI_EMBED):
        score = _score_with_embeddings(jd_text, cv_text, model)
        endpoint = "embeddings"
    else:
        score = _score_with_chat(jd_text, cv_text, model)
        endpoint = "chat"

    if score is None:
        return None

    # Extract keywords using TF-IDF for matched/missing skills
    from sklearn.feature_extraction.text import TfidfVectorizer
    try:
        vectorizer = TfidfVectorizer(
            lowercase=True, stop_words='english', ngram_range=(1, 2), min_df=1
        )
        tfidf_matrix = vectorizer.fit_transform([jd_text, cv_text])
        feature_names = vectorizer.get_feature_names_out()
        
        jd_scores = tfidf_matrix[0].toarray()[0]
        cv_scores = tfidf_matrix[1].toarray()[0]
        
        jd_terms = {feature_names[i] for i in jd_scores.argsort()[-top_k*2:][::-1] if jd_scores[i] > 0}
        cv_terms = {feature_names[i] for i in cv_scores.argsort()[-top_k*2:][::-1] if cv_scores[i] > 0}
        
        matched = list(jd_terms & cv_terms)[:top_k]
        missing = list(jd_terms - cv_terms)[:top_k]
    except Exception:
        matched = []
        missing = []

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
            "method": "ollama",
            "model": model.value,
            "endpoint": endpoint,
            "similarity": score
        }
    )