# Sunjet Energy — AI Talent Funnel & CV Ranker

A zero-cost, offline, local resume-screening tool for Sunjet Energy's HR team. No candidate data leaves the machine — compliant with DPDP Act data-localization requirements.

## Features

- **Local-only processing**: Runs entirely offline after `pip install` (Ollama optional)
- **Multi-format support**: PDF (pdfplumber/pypdf), DOCX (python-docx), TXT
- **Three scoring methods**:
  - **TF-IDF + Cosine Similarity** (mandatory baseline, always works)
  - **Sentence-Transformers** (semantic embeddings, `all-MiniLM-L6-v2`)
  - **Ollama** (optional enrichment: `nomic-embed-text`, `llama3.1:8b`, `mxbai-embed-large`)
- **Automatic fallback chain**: Ollama → Sentence-Transformers → TF-IDF
- **3-tier funnel**: Tier 1 (≥75%), Tier 2 (50–74%), Tier 3 (<50%) — configurable
- **Rationale generation**: Pros, Cons, Next Action per candidate
- **Styled Excel export**: 2-tab workbook (Summary Matrix + Detail Sheets) with dark-blue headers, tier color-coding, frozen panes, auto-filter

## Quick Start

```bash
# 1. Clone and enter project
cd sunjet-talent-funnel

# 2. Install dependencies
pip install -r requirements.txt

# 3. (Optional) Install Ollama for LLM enrichment
# https://ollama.ai/download
# ollama pull nomic-embed-text
# ollama serve

# 4. Run the app
streamlit run app.py
```

The app opens at `http://localhost:8501`.

## Usage

1. **Configure thresholds** in the sidebar (Tier 1/2 sliders, scoring method, top-K skills)
2. **Upload Job Description** — file (PDF/DOCX/TXT) or paste text
3. **Upload CVs** — multiple files (PDF/DOCX/TXT)
4. **Click "Run Screening"** — progress bar shows batch processing
5. **Review results** — tier-color-coded table (green/yellow/red)
6. **Download Excel report** — two tabs: Summary Matrix + per-candidate Detail Sheets

## Scoring Methods

| Method | Speed | Quality | Requires |
|--------|-------|---------|----------|
| TF-IDF | Fast | Keyword-based | None (built-in) |
| Sentence-Transformers | Medium | Semantic | ~90MB model download (first run) |
| Ollama | Slow | LLM-enriched | Local Ollama server running |

**Fallback behavior**: If selected method fails, automatically falls back to next available method (logged, not swallowed).

## Excel Report Format

### Tab 1: Summary Matrix
| Candidate | File | Score % | Tier | Key Matched Skills | Missing Skills | Next Action |
|-----------|------|---------|------|-------------------|----------------|-------------|

- Tier column color-coded: Green (1), Yellow (2), Red (3)
- Frozen header row, auto-filter, auto-fit columns

### Tab 2+: Detail Sheets (one per candidate)
- JD Key Terms, CV Key Terms, Overlap Matrix, Raw Score Breakdown
- Pros, Cons, Next Action rationale

## Privacy & Security

- **Zero persistence**: All extracted text held in memory only
- **Temp files**: Created in system temp dir, deleted after each file is processed
- **Export only**: User-initiated Excel download is the only artifact leaving memory
- **No PII logging**: Logs contain only file names, scores, timing — never CV content

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: sentence_transformers` | `pip install sentence-transformers torch --index-url https://download.pytorch.org/whl/cpu` |
| Ollama not detected | Ensure `ollama serve` is running; check `http://localhost:11434/api/tags` |
| Model download fails | Check internet connection (required for first Sentence-Transformers run) |
| Excel corrupt on open | Ensure `openpyxl>=3.1` installed; try LibreOffice Calc |
| Corrupt PDF crashes batch | App skips corrupt files with warning toast, continues processing |

## Architecture

```
src/
├── parsers.py           # PDF/DOCX/TXT extraction + cleaning
├── scoring/
│   ├── tfidf_scorer.py     # TF-IDF + cosine similarity (baseline)
│   ├── semantic_scorer.py  # Sentence-Transformers embeddings
│   └── ollama_scorer.py    # Ollama HTTP client + graceful fallback
├── tiering.py           # Tier assignment + rationale generation
├── export.py            # 2-tab styled Excel workbook
└── ui/
    └── shell.py         # Streamlit UI components
app.py                   # Main entry point, orchestrates pipeline
```

## Requirements

- Python 3.10+
- 8GB RAM recommended (for Sentence-Transformers model)
- No GPU required (CPU-only PyTorch)
- Windows/macOS/Linux

## Architecture Decision Records (ADRs)

### ADR-001: Zero-Cost Offline-First NLP with In-Memory Execution
- **Context**: Sunjet Energy's HR team handles sensitive candidate resumes (PII). Under India's Digital Personal Data Protection (DPDP) Act, candidate data must remain localized and secure. Cloud LLM APIs (OpenAI, Claude) introduce recurrent API fees, network latency, and compliance liabilities.
- **Decision**: TF-IDF n-gram vectorization with cosine similarity and local sentence embeddings serve as the default mandatory baseline. Ollama is supported as optional enrichment when available locally, with silent fallback to the baseline if absent. All resume text extraction and vectorization is strictly performed in-memory and discarded upon session completion.
- **Consequences**:
  - Positive: Zero operating cost, 100% data privacy and DPDP compliance, zero external API token limits, instant screening throughput (<30s for 20+ CVs).
  - Negative: Advanced contextual reasoning is bounded by keyword overlap and local embeddings rather than multi-billion parameter cloud models.

## License

Internal tool for Sunjet Energy HR team.