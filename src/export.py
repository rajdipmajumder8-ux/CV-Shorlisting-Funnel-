from io import BytesIO
from typing import List
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.utils import get_column_letter

from src.scoring.tfidf_scorer import ScoreResult


# Color palette - professional dark blue theme
DARK_BLUE = "1B2A4A"
MEDIUM_BLUE = "2E4A6E"
LIGHT_BLUE = "D6E4F0"
WHITE = "FFFFFF"
TIER1_GREEN = "C6EFCE"
TIER1_DARK_GREEN = "006100"
TIER2_YELLOW = "FFEB9C"
TIER2_DARK_YELLOW = "9C6500"
TIER3_RED = "FFC7CE"
TIER3_DARK_RED = "9C0006"
LIGHT_GRAY = "F2F2F2"
MEDIUM_GRAY = "D9D9D9"
DARK_GRAY = "404040"

HEADER_FILL = PatternFill(start_color=DARK_BLUE, end_color=DARK_BLUE, fill_type="solid")
HEADER_FONT = Font(color=WHITE, bold=True, size=11)
SECTION_HEADER_FILL = PatternFill(start_color=MEDIUM_BLUE, end_color=MEDIUM_BLUE, fill_type="solid")
SECTION_HEADER_FONT = Font(color=WHITE, bold=True, size=11)
SUB_HEADER_FONT = Font(bold=True, size=11, color=DARK_BLUE)
NORMAL_FONT = Font(size=11)
BOLD_FONT = Font(bold=True, size=11, color=DARK_GRAY)

TIER_FILLS = {
    1: PatternFill(start_color=TIER1_GREEN, end_color=TIER1_GREEN, fill_type="solid"),
    2: PatternFill(start_color=TIER2_YELLOW, end_color=TIER2_YELLOW, fill_type="solid"),
    3: PatternFill(start_color=TIER3_RED, end_color=TIER3_RED, fill_type="solid"),
}

TIER_FONTS = {
    1: Font(bold=True, size=11, color=TIER1_DARK_GREEN),
    2: Font(bold=True, size=11, color=TIER2_DARK_YELLOW),
    3: Font(bold=True, size=11, color=TIER3_DARK_RED),
}

THIN_BORDER = Border(
    left=Side(style='thin', color=MEDIUM_GRAY),
    right=Side(style='thin', color=MEDIUM_GRAY),
    top=Side(style='thin', color=MEDIUM_GRAY),
    bottom=Side(style='thin', color=MEDIUM_GRAY)
)

HEADER_ALIGNMENT = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT_ALIGN_WRAP = Alignment(horizontal="left", vertical="top", wrap_text=True)
CENTER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _style_header_row(ws, num_cols: int, row: int = 1):
    for col in range(1, num_cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = HEADER_ALIGNMENT
        cell.border = THIN_BORDER


def _style_section_header(ws, row: int, col: int, text: str, max_col: int = 2):
    cell = ws.cell(row=row, column=col, value=text)
    cell.fill = SECTION_HEADER_FILL
    cell.font = SECTION_HEADER_FONT
    cell.alignment = HEADER_ALIGNMENT
    cell.border = THIN_BORDER
    if max_col > 1:
        for c in range(col + 1, max_col + 1):
            c_cell = ws.cell(row=row, column=c)
            c_cell.fill = SECTION_HEADER_FILL
            c_cell.border = THIN_BORDER
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=max_col)


def _auto_width(ws, min_width: int = 12, max_width: int = 60):
    for col in ws.columns:
        max_length = 0
        column_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                if cell.value:
                    # Handle wrapped text - check each line
                    lines = str(cell.value).split('\n')
                    max_line_len = max(len(line) for line in lines)
                    max_length = max(max_length, max_line_len)
            except Exception:
                pass
        adjusted_width = min(max(max_length + 3, min_width), max_width)
        ws.column_dimensions[column_letter].width = adjusted_width


def _format_skills_list(skills: List[str], max_per_line: int = 3) -> str:
    """Format skills as bullet points with line breaks for readability."""
    if not skills:
        return "—"
    # Group skills for better readability
    lines = []
    for i in range(0, len(skills), max_per_line):
        chunk = skills[i:i + max_per_line]
        lines.append("; ".join(chunk))
    return "\n".join(lines)


def _write_summary_sheet(ws, results: List[ScoreResult]):
    # Title row
    ws.merge_cells('A1:G1')
    title_cell = ws.cell(row=1, column=1, value="Sunjet Energy — Talent Funnel Screening Report")
    title_cell.font = Font(bold=True, size=16, color=DARK_BLUE)
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 35

    # Subtitle row
    ws.merge_cells('A2:G2')
    from datetime import datetime
    subtitle_cell = ws.cell(row=2, column=1, value=f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')} | Candidates: {len(results)}")
    subtitle_cell.font = Font(italic=True, size=10, color=DARK_GRAY)
    subtitle_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 20

    # Headers row
    headers = [
        "Candidate", "File", "Score %", "Tier",
        "Key Matched Skills", "Missing Skills", "Next Action"
    ]
    
    header_row = 4
    for col, header in enumerate(headers, 1):
        ws.cell(row=header_row, column=col, value=header)
    _style_header_row(ws, len(headers), header_row)
    ws.row_dimensions[header_row].height = 30

    # Data rows
    for row_idx, r in enumerate(results, header_row + 1):
        ws.cell(row=row_idx, column=1, value=r.candidate_name).font = BOLD_FONT
        ws.cell(row=row_idx, column=1).alignment = LEFT_ALIGN_WRAP
        ws.cell(row=row_idx, column=1).border = THIN_BORDER
        
        ws.cell(row=row_idx, column=2, value=r.file_name).font = NORMAL_FONT
        ws.cell(row=row_idx, column=2).alignment = LEFT_ALIGN_WRAP
        ws.cell(row=row_idx, column=2).border = THIN_BORDER
        
        score_cell = ws.cell(row=row_idx, column=3, value=round(r.score * 100, 1))
        score_cell.font = Font(bold=True, size=11, color=DARK_BLUE)
        score_cell.alignment = CENTER_ALIGN
        score_cell.border = THIN_BORDER
        score_cell.number_format = '0.0"%"'
        
        tier_cell = ws.cell(row=row_idx, column=4, value=f"Tier {r.tier}")
        tier_cell.font = TIER_FONTS.get(r.tier, TIER_FONTS[3])
        tier_cell.fill = TIER_FILLS.get(r.tier, TIER_FILLS[3])
        tier_cell.alignment = CENTER_ALIGN
        tier_cell.border = THIN_BORDER
        
        matched_cell = ws.cell(row=row_idx, column=5, value=_format_skills_list(r.matched_skills))
        matched_cell.font = NORMAL_FONT
        matched_cell.alignment = LEFT_ALIGN_WRAP
        matched_cell.border = THIN_BORDER
        
        missing_cell = ws.cell(row=row_idx, column=6, value=_format_skills_list(r.missing_skills))
        missing_cell.font = NORMAL_FONT
        missing_cell.alignment = LEFT_ALIGN_WRAP
        missing_cell.border = THIN_BORDER
        
        action_cell = ws.cell(row=row_idx, column=7, value=r.next_action)
        action_cell.font = Font(bold=True, size=11, color=DARK_BLUE)
        action_cell.alignment = LEFT_ALIGN_WRAP
        action_cell.border = THIN_BORDER
        
        # Alternate row coloring for readability
        if (row_idx - header_row) % 2 == 0:
            for col in range(1, len(headers) + 1):
                cell = ws.cell(row=row_idx, column=col)
                if cell.fill == PatternFill():
                    cell.fill = PatternFill(start_color=LIGHT_BLUE, end_color=LIGHT_BLUE, fill_type="solid")
        
        ws.row_dimensions[row_idx].height = max(60, min(120, 20 * max(len(r.matched_skills), len(r.missing_skills), 1) // 3 + 40))

    # Freeze panes
    ws.freeze_panes = f"A{header_row + 1}"
    
    # Auto-filter
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{header_row + len(results)}"
    
    # Set column widths
    col_widths = {1: 22, 2: 28, 3: 12, 4: 14, 5: 40, 6: 40, 7: 35}
    for col, width in col_widths.items():
        ws.column_dimensions[get_column_letter(col)].width = width


def _write_detail_sheets(wb: Workbook, results: List[ScoreResult]):
    for r in results:
        safe_name = "".join(c for c in r.candidate_name if c.isalnum() or c in " _-")[:31]
        if not safe_name:
            safe_name = f"Candidate_{id(r)}"
        
        ws = wb.create_sheet(title=safe_name)
        row = 1
        
        # Candidate header block
        _style_section_header(ws, row, 1, f"Candidate Profile: {r.candidate_name}", 4)
        ws.row_dimensions[row].height = 28
        row += 1
        
        # Info table
        info_items = [
            ("File Name", r.file_name),
            ("Overall Score", f"{round(r.score * 100, 1)}%"),
            ("Tier Classification", f"Tier {r.tier}"),
            ("Screening Method", r.raw_breakdown.get('method', 'TF-IDF').replace('_', ' ').title()),
        ]
        if 'model' in r.raw_breakdown:
            info_items.append(("Model Used", r.raw_breakdown['model']))
        
        for label, value in info_items:
            ws.cell(row=row, column=1, value=label).font = BOLD_FONT
            ws.cell(row=row, column=1).border = THIN_BORDER
            ws.cell(row=row, column=1).alignment = LEFT_ALIGN_WRAP
            ws.cell(row=row, column=2, value=value).font = NORMAL_FONT
            ws.cell(row=row, column=2).border = THIN_BORDER
            ws.cell(row=row, column=2).alignment = LEFT_ALIGN_WRAP
            row += 1
        
        row += 1
        
        # Matched Skills Section
        _style_section_header(ws, row, 1, "✓ Matched Skills", 4)
        ws.row_dimensions[row].height = 24
        row += 1
        
        if r.matched_skills:
            for i, skill in enumerate(r.matched_skills, 1):
                ws.cell(row=row, column=1, value=f"{i}.").font = Font(size=11, color=TIER1_DARK_GREEN)
                ws.cell(row=row, column=1).alignment = Alignment(horizontal="right", vertical="top")
                ws.cell(row=row, column=1).border = THIN_BORDER
                ws.cell(row=row, column=2, value=skill).font = NORMAL_FONT
                ws.cell(row=row, column=2).alignment = LEFT_ALIGN_WRAP
                ws.cell(row=row, column=2).border = THIN_BORDER
                row += 1
        else:
            ws.cell(row=row, column=1, value="—").font = Font(italic=True, size=11, color=MEDIUM_GRAY)
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
            row += 1
        
        row += 1
        
        # Missing Skills Section
        _style_section_header(ws, row, 1, "✗ Missing / Gap Skills", 4)
        ws.row_dimensions[row].height = 24
        row += 1
        
        if r.missing_skills:
            for i, skill in enumerate(r.missing_skills, 1):
                ws.cell(row=row, column=1, value=f"{i}.").font = Font(size=11, color=TIER3_DARK_RED)
                ws.cell(row=row, column=1).alignment = Alignment(horizontal="right", vertical="top")
                ws.cell(row=row, column=1).border = THIN_BORDER
                ws.cell(row=row, column=2, value=skill).font = NORMAL_FONT
                ws.cell(row=row, column=2).alignment = LEFT_ALIGN_WRAP
                ws.cell(row=row, column=2).border = THIN_BORDER
                row += 1
        else:
            ws.cell(row=row, column=1, value="—").font = Font(italic=True, size=11, color=MEDIUM_GRAY)
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
            row += 1
        
        row += 1
        
        # Rationale Section
        _style_section_header(ws, row, 1, "Assessment Rationale", 4)
        ws.row_dimensions[row].height = 24
        row += 1
        
        # Pros
        ws.cell(row=row, column=1, value="Strengths (Pros)").font = SUB_HEADER_FONT
        ws.cell(row=row, column=1).border = THIN_BORDER
        row += 1
        for pro in r.pros:
            ws.cell(row=row, column=1, value="•").font = Font(size=11, color=TIER1_DARK_GREEN)
            ws.cell(row=row, column=1).alignment = Alignment(horizontal="center", vertical="top")
            ws.cell(row=row, column=1).border = THIN_BORDER
            ws.cell(row=row, column=2, value=pro).font = NORMAL_FONT
            ws.cell(row=row, column=2).alignment = LEFT_ALIGN_WRAP
            ws.cell(row=row, column=2).border = THIN_BORDER
            ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=4)
            row += 1
        
        row += 1
        
        # Cons
        ws.cell(row=row, column=1, value="Areas for Improvement (Cons)").font = SUB_HEADER_FONT
        ws.cell(row=row, column=1).border = THIN_BORDER
        row += 1
        for con in r.cons:
            ws.cell(row=row, column=1, value="•").font = Font(size=11, color=TIER3_DARK_RED)
            ws.cell(row=row, column=1).alignment = Alignment(horizontal="center", vertical="top")
            ws.cell(row=row, column=1).border = THIN_BORDER
            ws.cell(row=row, column=2, value=con).font = NORMAL_FONT
            ws.cell(row=row, column=2).alignment = LEFT_ALIGN_WRAP
            ws.cell(row=row, column=2).border = THIN_BORDER
            ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=4)
            row += 1
        
        row += 1
        
        # Next Action
        _style_section_header(ws, row, 1, "Recommended Next Action", 4)
        ws.row_dimensions[row].height = 24
        row += 1
        action_cell = ws.cell(row=row, column=1, value=r.next_action)
        action_cell.font = Font(bold=True, size=12, color=DARK_BLUE)
        action_cell.alignment = LEFT_ALIGN_WRAP
        action_cell.border = THIN_BORDER
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
        ws.row_dimensions[row].height = 40
        row += 2
        
        # Score Breakdown
        _style_section_header(ws, row, 1, "Score Breakdown Details", 4)
        ws.row_dimensions[row].height = 24
        row += 1
        
        for key, value in r.raw_breakdown.items():
            if key not in ['method', 'model', 'endpoint']:  # Skip redundant fields
                continue
            ws.cell(row=row, column=1, value=key.replace('_', ' ').title()).font = BOLD_FONT
            ws.cell(row=row, column=1).border = THIN_BORDER
            ws.cell(row=row, column=1).alignment = LEFT_ALIGN_WRAP
            ws.cell(row=row, column=2, value=str(value)).font = NORMAL_FONT
            ws.cell(row=row, column=2).border = THIN_BORDER
            ws.cell(row=row, column=2).alignment = LEFT_ALIGN_WRAP
            ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=4)
            row += 1
        
        # Set column widths for detail sheet
        ws.column_dimensions['A'].width = 30
        ws.column_dimensions['B'].width = 55
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 15
        
        # Print settings
        ws.sheet_properties.pageSetUpPr = None
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.page_setup.orientation = 'portrait'


def build_excel_report(results: List[ScoreResult]) -> BytesIO:
    """Returns BytesIO positioned at start, ready for st.download_button."""
    wb = Workbook()
    
    # Remove default sheet
    default_ws = wb.active
    wb.remove(default_ws)
    
    # Summary sheet
    ws_summary = wb.create_sheet(title="Summary Matrix")
    _write_summary_sheet(ws_summary, results)
    
    # Detail sheets
    _write_detail_sheets(wb, results)
    
    # Save to BytesIO
    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return bio