import streamlit as st
from typing import Dict, List, Tuple, Optional
from src.scoring.tfidf_scorer import ScoreResult


def render_sidebar() -> Dict:
    """Returns dict of user params: thresholds, method, top_k, ollama_model."""
    st.sidebar.header("Screening Parameters")
    
    tier1_min = st.sidebar.slider(
        "Tier 1 threshold (%)",
        min_value=50, max_value=95, value=75, step=1,
        help="Candidates scoring above this go to Tier 1"
    ) / 100.0
    
    tier2_min = st.sidebar.slider(
        "Tier 2 threshold (%)",
        min_value=20, max_value=74, value=50, step=1,
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
    
    top_k = st.sidebar.slider(
        "Top-K skills to display",
        min_value=5, max_value=20, value=10, step=1
    )
    
    ollama_model = None
    if method == "Ollama":
        ollama_model = st.sidebar.selectbox(
            "Ollama model",
            options=["nomic-embed-text", "llama3.1:8b", "mxbai-embed-large"],
            index=0
        )
    
    return {
        "tier1_min": tier1_min,
        "tier2_min": tier2_min,
        "method": method_map[method],
        "top_k": top_k,
        "ollama_model": ollama_model
    }


def render_uploaders() -> Tuple[Optional[str], List[Tuple[str, bytes]]]:
    """Returns (jd_text_or_none, list_of_(filename, file_bytes))."""
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
    
    # Text area takes precedence over file
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
    
    return final_jd_text, cv_list


def render_results_table(results: List[ScoreResult], thresholds: Dict):
    """Tier-color-coded dataframe with download button."""
    if not results:
        st.info("No results yet. Upload a JD and CVs, then click **Run Screening**.")
        return
    
    # Color mapping for tiers
    tier_colors = {1: "#d4edda", 2: "#fff3cd", 3: "#f8d7da"}
    
    data = []
    for r in results:
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
    
    # Style the dataframe
    def highlight_tier(row):
        tier = int(row["Tier"].split()[1])
        color = tier_colors.get(tier, "#ffffff")
        return [f"background-color: {color}"] * len(row)
    
    styled_df = df.style.apply(highlight_tier, axis=1)
    st.dataframe(styled_df, use_container_width=True, hide_index=True)
    
    # Download button will be rendered by the main app after Excel generation
    st.caption(f"Showing {len(results)} candidates")


def main():
    st.set_page_config(page_title="Sunjet Talent Funnel", layout="wide")
    st.title("🎯 Sunjet Energy — AI Talent Funnel & CV Ranker")
    
    params = render_sidebar()
    jd_text, cv_files = render_uploaders()
    
    # Run button
    can_run = jd_text is not None and len(cv_files) > 0
    run_clicked = st.button("Run Screening", type="primary", disabled=not can_run)
    
    if run_clicked:
        st.info("Screening in progress... (wiring in Task 7)")
    
    # Results placeholder
    st.subheader("Results")
    render_results_table([], params)


if __name__ == "__main__":
    main()