import streamlit as st
import tempfile
import logging
from pathlib import Path
from io import BytesIO
from typing import List, Tuple, Optional

from src.parsers import extract_text, clean_text
from src.scoring.tfidf_scorer import score_candidate_tfidf
from src.scoring.semantic_scorer import score_candidate_semantic
from src.scoring.ollama_scorer import score_candidate_ollama, is_ollama_available, OllamaModel
from src.tiering import TierThresholds, build_final_result
from src.export import build_excel_report
from src.scoring.tfidf_scorer import ScoreResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_screening(
    jd_text: str,
    cv_files: List[Tuple[str, bytes]],
    params: dict
) -> List[ScoreResult]:
    """Orchestrate: extract → clean → score (with fallback chain) → tier → rationale."""
    if not jd_text.strip() or not cv_files:
        return []
    
    jd_clean = clean_text(jd_text)
    
    # Select scoring function based on method
    method = params.get("method", "tfidf")
    top_k = params.get("top_k", 10)
    ollama_model_name = params.get("ollama_model")
    
    # Pre-load model for semantic/ollama to avoid reloading per CV
    if method == "sentence_transformers":
        from src.scoring.semantic_scorer import get_embedding_model
        get_embedding_model("all-MiniLM-L6-v2")  # Warm up cache
    elif method == "ollama" and ollama_model_name:
        # Check Ollama availability
        if not is_ollama_available():
            logger.warning("Ollama not available, falling back to semantic")
            method = "sentence_transformers"
            from src.scoring.semantic_scorer import get_embedding_model
            get_embedding_model("all-MiniLM-L6-v2")
    
    thresholds = TierThresholds(
        tier1_min=params.get("tier1_min", 0.75),
        tier2_min=params.get("tier2_min", 0.50)
    )
    
    results = []
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    for i, (filename, file_bytes) in enumerate(cv_files):
        status_text.text(f"Processing {filename}... ({i+1}/{len(cv_files)})")
        
        # Write to temp file for extraction
        with tempfile.NamedTemporaryFile(suffix=Path(filename).suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = Path(tmp.name)
        
        try:
            cv_raw = extract_text(tmp_path)
            cv_clean = clean_text(cv_raw)
        finally:
            # Cleanup temp file
            try:
                tmp_path.unlink()
            except Exception:
                pass
        
        # Score with fallback chain
        base_result = None
        
        if method == "tfidf":
            base_result = score_candidate_tfidf(jd_clean, cv_clean, top_k=top_k)
        
        elif method == "sentence_transformers":
            try:
                base_result = score_candidate_semantic(jd_clean, cv_clean, top_k=top_k)
            except Exception as e:
                logger.warning(f"Sentence-transformers failed: {e}, falling back to TF-IDF")
                base_result = score_candidate_tfidf(jd_clean, cv_clean, top_k=top_k)
        
        elif method == "ollama":
            ollama_model = OllamaModel(ollama_model_name) if ollama_model_name else OllamaModel.NOMIC_EMBED
            base_result = score_candidate_ollama(jd_clean, cv_clean, ollama_model, top_k=top_k)
            if base_result is None:
                logger.warning("Ollama scoring failed, falling back to semantic")
                try:
                    base_result = score_candidate_semantic(jd_clean, cv_clean, top_k=top_k)
                except Exception as e:
                    logger.warning(f"Semantic also failed: {e}, falling back to TF-IDF")
                    base_result = score_candidate_tfidf(jd_clean, cv_clean, top_k=top_k)
        
        if base_result is None:
            base_result = score_candidate_tfidf(jd_clean, cv_clean, top_k=top_k)
        
        # Set candidate info
        base_result.candidate_name = Path(filename).stem
        base_result.file_name = filename
        
        # Apply tiering and rationale
        final_result = build_final_result(base_result, thresholds)
        results.append(final_result)
        
        progress_bar.progress((i + 1) / len(cv_files))
    
    progress_bar.empty()
    status_text.empty()
    
    return results


def main():
    st.set_page_config(page_title="Sunjet Talent Funnel", layout="wide")
    st.title("🎯 Sunjet Energy — AI Talent Funnel & CV Ranker")
    
    # Sidebar
    st.sidebar.header("Screening Parameters")
    
    tier1_min = st.sidebar.slider(
        "Tier 1 threshold (%)", 50, 95, 75, 1,
        help="Candidates scoring above this go to Tier 1"
    ) / 100.0
    
    tier2_min = st.sidebar.slider(
        "Tier 2 threshold (%)", 20, 74, 50, 1,
        help="Candidates scoring above this go to Tier 2 (below Tier 1)"
    ) / 100.0
    
    method = st.sidebar.radio(
        "Scoring method",
        options=["TF-IDF", "Sentence-Transformers", "Ollama"],
        index=0,
        help="TF-IDF: fast, keyword-based. Sentence-Transformers: semantic. Ollama: local LLM (if running)"
    )
    
    method_map = {
        "TF-IDF": "tfidf",
        "Sentence-Transformers": "sentence_transformers",
        "Ollama": "ollama"
    }
    
    top_k = st.sidebar.slider("Top-K skills to display", 5, 20, 10, 1)
    
    ollama_model = None
    if method == "Ollama":
        ollama_model = st.sidebar.selectbox(
            "Ollama model",
            options=["nomic-embed-text", "llama3.1:8b", "mxbai-embed-large"],
            index=0
        )
    
    params = {
        "tier1_min": tier1_min,
        "tier2_min": tier2_min,
        "method": method_map[method],
        "top_k": top_k,
        "ollama_model": ollama_model
    }
    
    # Main area
    st.subheader("Job Description")
    jd_file = st.file_uploader(
        "Upload JD (PDF, DOCX, TXT)",
        type=["pdf", "docx", "txt"],
        key="jd_uploader"
    )
    jd_text = st.text_area(
        "Or paste JD text",
        height=150,
        key="jd_textarea"
    )
    
    final_jd_text = jd_text if jd_text.strip() else None
    if final_jd_text is None and jd_file is not None:
        final_jd_text = jd_file.read().decode('utf-8', errors='replace')
    
    st.subheader("Candidate CVs")
    cv_files = st.file_uploader(
        "Upload CVs (PDF, DOCX, TXT) — multiple files",
        type=["pdf", "docx", "txt"],
        accept_multiple_files=True,
        key="cv_uploader"
    )
    
    cv_list = []
    if cv_files:
        for cv_file in cv_files:
            cv_list.append((cv_file.name, cv_file.read()))
    
    # Run button
    can_run = final_jd_text is not None and len(cv_list) > 0
    run_clicked = st.button("Run Screening", type="primary", disabled=not can_run)
    
    # Session state for results
    if "results" not in st.session_state:
        st.session_state.results = []
    if "excel_bytes" not in st.session_state:
        st.session_state.excel_bytes = None
    
    if run_clicked and can_run:
        with st.spinner("Screening candidates..."):
            results = run_screening(final_jd_text, cv_list, params)
            st.session_state.results = results
            
            # Generate Excel report
            try:
                excel_bytes = build_excel_report(results)
                st.session_state.excel_bytes = excel_bytes.getvalue()
            except Exception as e:
                logger.error(f"Excel generation failed: {e}")
                st.error(f"Excel export failed: {e}")
    
    # Results
    st.subheader("Results")
    
    if st.session_state.results:
        # Display results table
        tier_colors = {1: "#d4edda", 2: "#fff3cd", 3: "#f8d7da"}
        
        data = []
        for r in st.session_state.results:
            data.append({
                "Candidate": r.candidate_name,
                "File": r.file_name,
                "Score %": f"{r.score * 100:.1f}%",
                "Tier": f"Tier {r.tier}",
                "Matched Skills": ", ".join(r.matched_skills[:5]) if r.matched_skills else "—",
                "Missing Skills": ", ".join(r.missing_skills[:5]) if r.missing_skills else "—",
                "Next Action": r.next_action
            })
        
        import pandas as pd
        df = pd.DataFrame(data)
        
        def highlight_tier(row):
            tier = int(row["Tier"].split()[1])
            color = tier_colors.get(tier, "#ffffff")
            return [f"background-color: {color}"] * len(row)
        
        styled_df = df.style.apply(highlight_tier, axis=1)
        st.dataframe(styled_df, use_container_width=True, hide_index=True)
        
        # Download button
        if st.session_state.excel_bytes:
            st.download_button(
                label="📥 Download Excel Report",
                data=st.session_state.excel_bytes,
                file_name="sunjet_talent_funnel_report.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
    else:
        st.info("Upload a Job Description and at least one CV, then click **Run Screening**.")


if __name__ == "__main__":
    main()