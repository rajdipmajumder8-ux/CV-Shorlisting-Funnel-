import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const CONTROL_CHAR_RE = /[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g;
const MULTI_NEWLINE_RE = /\n{3,}/g;
const MULTI_SPACE_RE = / {2,}/g;

export function cleanText(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(CONTROL_CHAR_RE, '');
  text = text.replace(MULTI_NEWLINE_RE, '\n\n');
  text = text.replace(MULTI_SPACE_RE, ' ');
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.join('\n');
}

export async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  try {
    if (ext === '.pdf') {
      try {
        const data = await pdfParse(buffer);
        return data.text || '';
      } catch (err) {
        console.warn(`[parsers] pdf-parse failed for ${filename}:`, err);
        // Fallback: extract ascii readable strings
        const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
        return text;
      }
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } else if (ext === '.txt' || ext === '.md') {
      return buffer.toString('utf-8');
    } else {
      // Treat as plain text fallback
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error(`[parsers] Extraction error for ${filename}:`, error);
    return '';
  }
}
