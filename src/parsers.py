from pathlib import Path
import logging
import re

logger = logging.getLogger(__name__)

CONTROL_CHAR_RE = re.compile(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]')
MULTI_NEWLINE_RE = re.compile(r'\n{3,}')
MULTI_SPACE_RE = re.compile(r' {2,}')

SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.txt'}


def clean_text(raw: str) -> str:
    """Normalize whitespace, remove headers/footers, strip non-printable chars."""
    if not raw:
        return ""
    text = CONTROL_CHAR_RE.sub('', raw)
    text = MULTI_NEWLINE_RE.sub('\n\n', text)
    text = MULTI_SPACE_RE.sub(' ', text)
    lines = [line.strip() for line in text.splitlines()]
    return '\n'.join(line for line in lines if line)


def _extract_pdf_plumber(path: Path) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return '\n'.join(text_parts)


def _extract_pdf_pypdf(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(path)
    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)
    return '\n'.join(text_parts)


def _extract_docx(path: Path) -> str:
    from docx import Document
    doc = Document(path)
    text_parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            text_parts.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            row_text = [cell.text for cell in row.cells if cell.text.strip()]
            if row_text:
                text_parts.append(' | '.join(row_text))
    return '\n'.join(text_parts)


def _extract_txt(path: Path) -> str:
    for encoding in ('utf-8', 'latin-1'):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding='utf-8', errors='replace')


def extract_text(file_path: Path) -> str:
    """Extract raw text from PDF, DOCX, or TXT file."""
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = file_path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix}. Supported: {SUPPORTED_EXTENSIONS}")

    try:
        if suffix == '.pdf':
            try:
                return _extract_pdf_plumber(file_path)
            except Exception as e:
                logger.warning(f"pdfplumber failed for {file_path.name}: {e}, falling back to pypdf")
                try:
                    return _extract_pdf_pypdf(file_path)
                except Exception as e2:
                    logger.error(f"pypdf also failed for {file_path.name}: {e2}")
                    return ""
        elif suffix == '.docx':
            return _extract_docx(file_path)
        elif suffix == '.txt':
            return _extract_txt(file_path)
    except Exception as e:
        logger.error(f"Extraction failed for {file_path.name}: {e}")
        return ""

    return ""