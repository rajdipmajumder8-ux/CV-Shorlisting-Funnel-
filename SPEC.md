# Sunjet Energy — AI Talent Funnel & CV Ranker
## Specification Document (Phase 1 Output)

---

### 1. Problem Statement
Sunjet Energy's HR team needs a **zero-cost, offline, local resume-screening tool**. No candidate data (PII) leaves the machine — critical for DPDP Act data-localization compliance. The tool accepts a Job Description (JD) and multiple CVs, scores each CV against the JD using local NLP models, tiers candidates into 3 funnel tiers, and exports a styled Excel report.

---

### 2. Non-Goals (Explicit Scope Rejection)
- ❌ No cloud AI calls (OpenAI, Anthropic, etc.)
- ❌ No paid APIs or external services
- ❌ No external database
- ❌ No multi-user authentication / SaaS-style features
- ❌ No persistent storage of candidate data beyond the session
- ❌ No real-time collaboration or sharing

---

### 3. Success Criteria (Acceptance Tests)

| ID | Criterion | Measurement |
|----|-----------|-------------|
| AC-1 | **Throughput** | Given 1 JD + 20 CVs, produces scored tiered matrix in **< 30 seconds** on standard hardware (8GB RAM, no GPU) |
| AC-2 | **Offline operation** | After `pip install -r requirements.txt`, app runs with **zero internet access** (Ollama optional; TF-IDF + sentence-transformers fallback mandatory) |
| AC-3 | **Excel export integrity** | Generated `.xlsx` opens correctly in Excel 2016+ and LibreOffice Calc with styled headers (dark blue, white text, frozen panes), no corrupt XML warnings |
| AC-4 | **Tier accuracy** | Candidates correctly assigned to tiers: **Tier 1 ≥ 75%**, **Tier 2 50–74%**, **Tier 3 < 50%** (configurable via UI) |
| AC-5 | **Graceful degradation** | Malformed/corrupt PDF → skips file with warning, continues batch; Ollama unavailable → silent fallback to TF-IDF, logged not swallowed |
| AC-6 | **PII handling** | No CV text persisted to disk beyond session; temp files deleted on session end unless user explicitly exports |

---

### 4. Functional Requirements

#### 4.1 Input
- **Job Description**: Single file (PDF, DOCX, TXT) or pasted text
- **CVs**: Multiple files (PDF, DOCX, TXT) — batch upload, max 50 files per run

#### 4.2 Processing Pipeline
1. **Text Extraction**: `pdfplumber` (primary) → `pypdf` (fallback) for PDFs; `python-docx` for DOCX; native for TXT
2. **Cleaning**: Normalize whitespace, remove headers/footers, strip non-printable chars
3. **Scoring** (three methods, selectable + fallback chain):
   - **TF-IDF + Cosine Similarity** (mandatory baseline, zero dependencies beyond scikit-learn)
   - **Sentence-Transformers** (semantic embeddings, `all-MiniLM-L6-v2` default, ~90MB)
   - **Ollama** (optional enrichment: `llama3.1:8b` or `nomic-embed-text` if running locally)
4. **Tiering**: Configurable thresholds (default: 75% / 50%)
5. **Rationale Generation**: Per-candidate Pros / Cons / Next Action (rule-based from keyword overlap + score bands)

#### 4.3 Output — Two-Tab Excel Workbook
| Tab | Contents |
|-----|----------|
| **Summary Matrix** | Candidate | File | Score % | Tier | Key Matched Skills | Missing Skills | Next Action |
| **Detail Sheets** | One sub-sheet per candidate: JD key terms, CV key terms, overlap matrix, raw score breakdown |

**Styling**: Dark blue header (`#1B2A4A`), white text, frozen top row, auto-filter, column widths auto-fit.

---

### 5. Technical Constraints (Carried Forward Verbatim)

| Area | Requirement |
|------|-------------|
| **UI Framework** | Streamlit (single `app.py` entry point) |
| **PDF Extraction** | `pdfplumber` primary, `pypdf` fallback |
| **DOCX Extraction** | `python-docx` |
| **Data/Export** | `pandas` + `openpyxl` |
| **NLP Baseline** | `scikit-learn` TF-IDF + cosine similarity |
| **NLP Semantic** | `sentence-transformers` (`all-MiniLM-L6-v2`) |
| **NLP Optional** | Ollama HTTP client (graceful degrade if not installed/not running) |
| **Config** | Sidebar: tier thresholds (sliders), scoring method (radio), top-K skills to display |
| **Temp Files** | `tempfile` module; cleanup on session end |

---

### 6. Internal API Contracts (for Phase 2 Planning)

```python
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
from typing import Literal
from io import BytesIO

class ScoringMethod(str, Enum):
    TFIDF = "tfidf"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    OLLAMA = "ollama"

@dataclass
class TierThresholds:
    tier1_min: float = 0.75
    tier2_min: float = 0.50

@dataclass
class ScoreResult:
    candidate_name: str
    file_name: str
    score: float              # 0.0 - 1.0
    tier: Literal[1, 2, 3]
    matched_skills: list[str]
    missing_skills: list[str]
    pros: list[str]
    cons: list[str]
    next_action: str
    raw_breakdown: dict       # method-specific details

# Core functions (to be implemented in Phase 3)
def extract_text(file_path: Path) -> str: ...
def clean_text(raw: str) -> str: ...
def score_candidate(jd_text: str, cv_text: str, method: ScoringMethod) -> ScoreResult: ...
def assign_tier(score: float, thresholds: TierThresholds) -> Literal[1, 2, 3]: ...
def generate_rationale(jd_text: str, cv_text: str, score: float) -> tuple[list[str], list[str], str]: ...
def build_excel_report(results: list[ScoreResult]) -> BytesIO: ...
```

---

### 7. UI Specification (Streamlit)

**Sidebar Controls:**
- Tier 1 threshold slider (50–95%, default 75%)
- Tier 2 threshold slider (20–74%, default 50%)
- Scoring method radio: [TF-IDF, Sentence-Transformers, Ollama (if available)]
- Top-K skills to display (5–20, default 10)
- Ollama model selector (if Ollama detected): `llama3.1:8b`, `nomic-embed-text`, `mxbai-embed-large`

**Main Area:**
- JD upload (file uploader + text area fallback)
- CV batch uploader (multi-file)
- "Run Screening" button (disabled until JD + ≥1 CV)
- Results table: sortable, filterable, tier-color-coded rows
- Download button: "Export Excel Report"

---

### 8. Error Handling Requirements

| Scenario | Behavior |
|----------|----------|
| Corrupt/unreadable PDF | Skip file, show toast warning, continue batch |
| Empty JD text | Block "Run" button, show inline error |
| Zero CVs uploaded | Block "Run" button, show inline error |
| Ollama not running / 404 | Log warning, auto-fallback to sentence-transformers → TF-IDF |
| Embedding model not cached | Download on first run (sentence-transformers), show progress |
| Export with no results | Disable download button |

---

### 9. Performance Requirements

- Embedding models loaded **once per session**, reused across all CVs in batch
- TF-IDF vectorizer fit on JD + all CVs together (single fit-transform)
- Batch size: up to 50 CVs without memory pressure (< 1GB RAM)
- Streaming file reads for extraction (no full-file-in-memory for large PDFs)

---

### 10. Security & Privacy

- **No persistence**: All extracted text held in memory only
- **Temp files**: Created in `tempfile.gettempdir()`, deleted on `streamlit` session end (`st.session_state` cleanup hook)
- **Export only**: User-initiated Excel download is the only artifact leaving memory
- **No logging of PII**: Logs contain only file names, scores, timing — never CV content

---

### 11. Acceptance Test Scenarios (for Phase 4 Verification)

| Scenario | Steps | Expected |
|----------|-------|----------|
| Happy path | Upload JD + 5 CVs, click Run, export Excel | Tiered matrix in <30s, Excel opens cleanly |
| Ollama absent | Uninstall Ollama, run with method=Ollama | Falls back to sentence-transformers silently |
| Corrupt PDF | Upload 1 corrupt PDF + 3 valid CVs | 3 results + 1 warning toast, no crash |
| Threshold change | Move Tier 1 slider to 80%, re-run | Re-tiering without re-scoring |
| Large batch | 20 CVs, sentence-transformers | Completes <30s, memory <1GB |
| Session cleanup | Run screening, close browser tab | Temp files deleted |

---

### 12. Dependencies (requirements.txt preview)

```
streamlit>=1.35
pdfplumber>=0.11
pypdf>=3.17
python-docx>=1.1
pandas>=2.2
openpyxl>=3.1
scikit-learn>=1.5
sentence-transformers>=3.0
torch>=2.3 --index-url https://download.pytorch.org/whl/cpu
ollama>=0.3  # optional, graceful import
```

---

**Sign-off**: This SPEC.md must be reviewed and confirmed before Phase 2 (Planning) begins.