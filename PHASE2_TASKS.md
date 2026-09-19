# Phase 2 — Task Breakdown
## Independently Shippable Increments (Agent-Executable Prompts)

Each task below is a **self-contained prompt** for a focused agent context window. Tasks are ordered by dependency; an agent should complete Task N before Task N+1 begins.

---

### Task 1: File Parsers (PDF/DOCX/TXT → Clean Text)
**Depends on:** —  
**Output:** `src/parsers.py` + `tests/test_parsers.py`

**Prompt:**
> Implement text extraction for PDF, DOCX, and TXT files with the following signature:
> ```python
> from pathlib import Path
> 
> def extract_text(file_path: Path) -> str:
>     """Extract raw text from PDF, DOCX, or TXT file."""
>     ...
> 
> def clean_text(raw: str) -> str:
>     """Normalize whitespace, remove headers/footers, strip non-printable chars."""
>     ...
> ```
> **Requirements:**
> - PDF: `pdfplumber` primary, `pypdf` fallback on exception
> - DOCX: `python-docx` (paragraphs + tables)
> - TXT: UTF-8 with fallback to latin-1
> - `clean_text`: collapse >2 newlines → 2, strip leading/trailing whitespace per line, remove control chars except `\n\t`
> - **Tests first (TDD)**: Write `tests/test_parsers.py` with fixtures for each format + 1 corrupt PDF. Assert: non-empty string for valid files, graceful handling for corrupt (returns empty string + logs warning).
> - No Streamlit, no scoring — pure functions only.

---

### Task 2: Scoring Engine — TF-IDF + Cosine Similarity (Mandatory Baseline)
**Depends on:** Task 1  
**Output:** `src/scoring/tfidf_scorer.py` + `tests/test_tfidf_scorer.py`

**Prompt:**
> Implement the mandatory fallback scorer using `scikit-learn` TF-IDF + cosine similarity.
> ```python
> from dataclasses import dataclass
> from src.parsers import clean_text
> 
> @dataclass
> class ScoreResult:
>     candidate_name: str
>     file_name: str
>     score: float              # 0.0 - 1.0
>     matched_skills: list[str]
>     missing_skills: list[str]
>     raw_breakdown: dict
> 
> def score_candidate_tfidf(jd_text: str, cv_text: str, top_k: int = 10) -> ScoreResult:
>     """TF-IDF vectorize JD + CV together, cosine similarity, extract top-k overlapping terms."""
>     ...
> ```
> **Requirements:**
> - Single `TfidfVectorizer` fit on `[jd_text, cv_text]` (not separate fits)
> - Cosine similarity of the two vectors → `score`
> - `matched_skills`: top-k terms by TF-IDF weight present in both
> - `missing_skills`: top-k terms by TF-IDF weight in JD but absent in CV
> - `raw_breakdown`: `{"method": "tfidf", "vector_shape": (2, n_features), "similarity": float}`
> - **Tests first**: Known JD/CV pairs with expected score ranges (e.g., identical text → 1.0, disjoint → <0.1). Test `top_k` parameter.

---

### Task 3: Scoring Engine — Sentence-Transformers Semantic Layer
**Depends on:** Task 2  
**Output:** `src/scoring/semantic_scorer.py` + `tests/test_semantic_scorer.py`

**Prompt:**
> Implement semantic scoring using `sentence-transformers` (`all-MiniLM-L6-v2` default).
> ```python
> from src.scoring.tfidf_scorer import ScoreResult
> 
> def score_candidate_semantic(jd_text: str, cv_text: str, model_name: str = "all-MiniLM-L6-v2", top_k: int = 10) -> ScoreResult:
>     """Embed JD and CV, cosine similarity, keyword overlap via embedding proximity."""
>     ...
> 
> def get_embedding_model(model_name: str):
>     """Load/cached model — singleton per session."""
>     ...
> ```
> **Requirements:**
> - Model loaded **once** (module-level cache), reused across calls
> - Cosine similarity of mean-pooled embeddings → `score`
> - `matched_skills` / `missing_skills`: approximate via keyword extraction + embedding nearest-neighbors to JD terms (simplified: reuse TF-IDF keywords from Task 2, score overlap via embedding similarity)
> - `raw_breakdown`: `{"method": "semantic", "model": model_name, "jd_embedding_shape": (384,), "cv_embedding_shape": (384,), "similarity": float}`
> - **Tests first**: Same JD/CV pairs as Task 2 — semantic scores should correlate but not identical. Test model caching (second call doesn't reload).

---

### Task 4: Scoring Engine — Ollama Optional Enrichment + Graceful Degrade
**Depends on:** Task 3  
**Output:** `src/scoring/ollama_scorer.py` + `tests/test_ollama_scorer.py`

**Prompt:**
> Implement optional Ollama enrichment with automatic fallback.
> ```python
> from src.scoring.semantic_scorer import ScoreResult
> from enum import Enum
> 
> class OllamaModel(str, Enum):
>     LLAMA31_8B = "llama3.1:8b"
>     NOMIC_EMBED = "nomic-embed-text"
>     MXBAI_EMBED = "mxbai-embed-large"
> 
> def score_candidate_ollama(jd_text: str, cv_text: str, model: OllamaModel = OllamaModel.NOMIC_EMBED, top_k: int = 10) -> ScoreResult | None:
>     """Call local Ollama HTTP API. Returns None on any failure (caller falls back)."""
>     ...
> 
> def is_ollama_available() -> bool:
>     """Health check — GET /api/tags, timeout 2s."""
>     ...
> ```
> **Requirements:**
> - Uses `ollama` Python client if available, else `httpx` direct calls
> - **Never raises** — returns `None` on connection error, timeout, 404, model not found
> - Logs warning (stdlib `logging`) on fallback, not `print`
> - Embedding endpoint `/api/embeddings` for nomic/mxbai; chat endpoint for llama3.1 with prompt engineering for scoring
> - `raw_breakdown`: `{"method": "ollama", "model": str, "endpoint": "embeddings|chat", "similarity": float}`
> - **Tests first**: Mock `httpx` responses. Test: success path, connection refused, model not found, timeout. All return `None` gracefully.

---

### Task 5: Tiering Logic + Rationale Generator (Pros/Cons/Next Action)
**Depends on:** Tasks 2–4  
**Output:** `src/tiering.py` + `tests/test_tiering.py`

**Prompt:**
> Implement tier assignment and human-readable rationale generation.
> ```python
> from dataclasses import dataclass
> from typing import Literal
> 
> @dataclass
> class TierThresholds:
>     tier1_min: float = 0.75
>     tier2_min: float = 0.50
> 
> def assign_tier(score: float, thresholds: TierThresholds) -> Literal[1, 2, 3]:
>     if score >= thresholds.tier1_min: return 1
>     if score >= thresholds.tier2_min: return 2
>     return 3
> 
> def generate_rationale(jd_text: str, cv_text: str, score: float, matched: list[str], missing: list[str]) -> tuple[list[str], list[str], str]:
>     """Return (pros, cons, next_action) based on score bands + keyword evidence."""
>     ...
> 
> def build_final_result(base: ScoreResult, thresholds: TierThresholds) -> ScoreResult:
>     """Attach tier, pros, cons, next_action to base ScoreResult."""
>     ...
> ```
> **Rationale rules:**
> - **Pros**: Matched skills (top 3), high score band descriptors ("Strong alignment on core requirements")
> - **Cons**: Missing skills (top 3), low score band descriptors ("Gap in required certification")
> - **Next Action**: Tier 1 → "Schedule interview", Tier 2 → "Technical screen recommended", Tier 3 → "Consider for future roles / reject"
> - **Tests first**: Parameterized tests across score boundaries (0.74, 0.75, 0.49, 0.50). Test rationale content matches bands.

---

### Task 6: Streamlit UI Shell (Uploaders, Sidebar Params)
**Depends on:** — (parallelizable)  
**Output:** `src/ui/shell.py` + `tests/test_ui_shell.py` (visual/behavioral)

**Prompt:**
> Build the Streamlit UI shell — **no scoring logic wired yet**.
> ```python
> import streamlit as st
> from src.scoring.tfidf_scorer import ScoreResult
> 
> def render_sidebar() -> dict:
>     """Returns dict of user params: thresholds, method, top_k, ollama_model."""
>     ...
> 
> def render_uploaders() -> tuple[str | None, list[tuple[str, bytes]]]:
>     """Returns (jd_text_or_none, list_of_(filename, file_bytes))."""
>     ...
> 
> def render_results_table(results: list[ScoreResult], thresholds: TierThresholds):
>     """Tier-color-coded dataframe with download button."""
>     ...
> 
> def main():
>     st.set_page_config(page_title="Sunjet Talent Funnel", layout="wide")
>     params = render_sidebar()
>     jd_text, cv_files = render_uploaders()
>     # ... wire later
> ```
> **Requirements:**
> - Sidebar: Tier 1 slider (50–95), Tier 2 slider (20–74), Method radio (TF-IDF, Semantic, Ollama*), Top-K slider (5–20), Ollama model select (conditional)
> - Main: JD file uploader + text area (text area overrides file), CV multi-file uploader
> - "Run Screening" button — disabled until JD + ≥1 CV
> - Results: `st.dataframe` with tier-colored rows (Tier 1 green, 2 yellow, 3 red), sortable/filterable
> - Download button appears only after results exist
> - **Tests**: Use `streamlit.testing.v1.AppTest` — verify widgets render, button disabled/enabled logic, sidebar params returned correctly.

---

### Task 7: Wire UI → Scoring Pipeline
**Depends on:** Tasks 5, 6  
**Output:** `app.py` (updated) + integration test

**Prompt:**
> Wire the complete pipeline in `app.py`:
> ```python
> def run_screening(jd_text: str, cv_files: list[tuple[str, bytes]], params: dict) -> list[ScoreResult]:
>     """Orchestrate: extract → clean → score (with fallback chain) → tier → rationale."""
>     ...
> ```
> **Fallback chain logic:**
> 1. If `params["method"] == "ollama"` and `is_ollama_available()`: try Ollama → on `None`, log and fall to semantic
> 2. If semantic: try sentence-transformers → on exception, log and fall to TF-IDF
> 3. TF-IDF: always works (mandatory baseline)
> - Extract text from uploaded bytes (use `tempfile.NamedTemporaryFile` per file, cleanup after)
> - Load embedding model **once** before loop (semantic/Ollama)
> - Progress bar during batch (`st.progress`)
> - Collect all `ScoreResult`, pass to `build_final_result` with thresholds from params
> - Store results in `st.session_state.results` for export
> - **Integration test**: Run with sample JD + 3 CVs, verify all tiers populated, no crashes.

---

### Task 8: Excel Export (2-Tab Styled Workbook)
**Depends on:** Task 5  
**Output:** `src/export.py` + `tests/test_export.py`

**Prompt:**
> Generate the two-tab Excel report with styling.
> ```python
> from io import BytesIO
> from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
> from src.tiering import ScoreResult
> 
> HEADER_FILL = PatternFill(start_color="1B2A4A", end_color="1B2A4A", fill_type="solid")
> HEADER_FONT = Font(color="FFFFFF", bold=True)
> 
> def build_excel_report(results: list[ScoreResult]) -> BytesIO:
>     """Returns BytesIO positioned at start, ready for st.download_button."""
>     ...
> ```
> **Tab 1 — "Summary Matrix":**
> | Candidate | File | Score % | Tier | Key Matched Skills | Missing Skills | Next Action |
> - Tier column: conditional formatting (green/yellow/red fill)
> - Frozen header row, auto-filter, column widths auto-fit
> 
> **Tab 2 — "Detail Sheets":**
> - One worksheet per candidate (truncate sheet name to 31 chars)
> - Sections: JD Key Terms, CV Key Terms, Overlap Matrix, Raw Score Breakdown
> - Same header styling
> 
> **Tests first**: Generate workbook with 3 mock results. Verify:
> - `openpyxl.load_workbook` reads without error
> - Two sheets exist (1 summary + 1 detail per candidate = 4 sheets for 3 candidates)
> - Header row style applied (dark blue fill, white font)
> - Tier conditional formatting rules present
> - BytesIO seekable and non-empty

---

### Task 9: End-to-End Run on Sample Data
**Depends on:** Tasks 7, 8  
**Output:** `sample_data/` + `tests/test_e2e.py` + updated `README.md`

**Prompt:**
> Create sample data and verify full flow.
> - `sample_data/jd_senior_python.txt` — realistic JD
> - `sample_data/cv_*.txt` — 5 diverse CVs (strong match, partial, weak, keyword-stuffed, empty-ish)
> - Run `streamlit run app.py` headlessly via `AppTest`, upload samples, click Run, export Excel
> - Assert: 5 results, all tiers represented, Excel bytes valid, runtime < 30s
> - Update `README.md` with setup instructions (verbatim from SPEC §12), troubleshooting (Ollama not found, model download), and usage screenshots (optional)

---

## Execution Order & Gating

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 7 → Task 9
                    ↘ Task 6 ↗              ↗
                      Task 8 ──────────────→
```

- Tasks 1–5: Pure logic, **TDD mandatory** — test file written first, then implementation
- Task 6: UI shell — can run parallel to 1–5, but Task 7 needs both
- Task 8: Export — depends on Task 5's `ScoreResult` shape
- Task 9: Final integration — all prior tasks must pass

---

## Agent Handoff Protocol

Each task prompt above is **complete** — an agent can execute it without reading other tasks.  
When a task is done, the agent should:
1. Run its tests: `pytest tests/test_<task>.py -v`
2. Run lint/typecheck if configured (see `AGENTS.md` or ask user)
3. Summarize what was created + any deviations from prompt
4. **Stop** — do not continue to next task

The orchestrator (you) then feeds the next task prompt to a fresh agent context.