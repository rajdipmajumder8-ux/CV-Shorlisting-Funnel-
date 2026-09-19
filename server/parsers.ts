import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { getGenAI } from './scoring';

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

/**
 * Multimodal extraction using Gemini for scanned PDFs, images, or files where pdf-parse yields no text
 */
async function extractWithGemini(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const ai = getGenAI();
  if (!ai || !buffer || buffer.length === 0) return '';

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          inlineData: {
            mimeType,
            data: buffer.toString('base64')
          }
        },
        'Extract all readable text, candidate experience, education, skills, contact info, and work history from this document verbatim. Return the complete extracted text.'
      ]
    });
    const text = res.text?.trim() || '';
    if (text) {
      console.log(`[parsers] Successfully extracted text using Gemini multimodal for ${filename} (${text.length} chars)`);
    }
    return text;
  } catch (err) {
    console.warn(`[parsers] Gemini extraction failed for ${filename}:`, err);
    return '';
  }
}

export async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  if (!buffer || buffer.length === 0) return '';
  const ext = path.extname(filename).toLowerCase();

  try {
    if (ext === '.pdf') {
      try {
        const data = await pdfParse(buffer);
        const parsedText = data.text || '';
        // If pdf-parse found meaningful content, return it
        if (cleanText(parsedText).length >= 40) {
          return parsedText;
        }
        console.info(`[parsers] PDF ${filename} yielded minimal text (${parsedText.length} chars). Invoking Gemini multimodal OCR...`);
      } catch (err) {
        console.warn(`[parsers] pdf-parse failed for ${filename}, falling back to Gemini multimodal:`, err);
      }

      // Fallback: Gemini multimodal PDF extraction
      const geminiText = await extractWithGemini(buffer, 'application/pdf', filename);
      if (geminiText) return geminiText;

      // Secondary fallback: ASCII string extraction
      return buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    } else if (ext === '.docx') {
      try {
        const result = await mammoth.extractRawText({ buffer });
        if (result.value && cleanText(result.value).length > 0) {
          return result.value;
        }
      } catch (docErr) {
        console.warn(`[parsers] mammoth docx parsing error for ${filename}:`, docErr);
      }
      return buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    } else if (ext === '.doc') {
      // Legacy Word file: extract printable word tokens
      const str = buffer.toString('binary');
      const matches = str.match(/[\x20-\x7E\t\n\r]{4,}/g);
      return matches ? matches.join('\n') : buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      // Image CV (photo/scan)
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return await extractWithGemini(buffer, mime, filename);
    } else if (ext === '.txt' || ext === '.md' || ext === '.rtf' || ext === '.csv') {
      return buffer.toString('utf-8');
    } else {
      // General plain text or ASCII fallback
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error(`[parsers] Extraction error for ${filename}:`, error);
    return '';
  }
}

