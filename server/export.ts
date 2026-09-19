import ExcelJS from 'exceljs';
import { ScoreOutput } from './scoring';

const DARK_BLUE = 'FF1B2A4A';
const MEDIUM_BLUE = 'FF2E4A6E';
const LIGHT_BLUE = 'FFD6E4F0';
const WHITE = 'FFFFFFFF';
const TIER1_GREEN = 'FFC6EFCE';
const TIER1_DARK_GREEN = 'FF006100';
const TIER2_YELLOW = 'FFFFEB9C';
const TIER2_DARK_YELLOW = 'FF9C6500';
const TIER3_RED = 'FFFFC7CE';
const TIER3_DARK_RED = 'FF9C0006';
const MEDIUM_GRAY = 'FFD9D9D9';
const DARK_GRAY = 'FF404040';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: MEDIUM_GRAY } },
  left: { style: 'thin', color: { argb: MEDIUM_GRAY } },
  bottom: { style: 'thin', color: { argb: MEDIUM_GRAY } },
  right: { style: 'thin', color: { argb: MEDIUM_GRAY } },
};

function formatSkills(skills: string[], maxPerLine: number = 3): string {
  if (!skills || skills.length === 0) return '—';
  const lines: string[] = [];
  for (let i = 0; i < skills.length; i += maxPerLine) {
    lines.push(skills.slice(i, i + maxPerLine).join('; '));
  }
  return lines.join('\n');
}

export async function buildExcelReportBuffer(results: ScoreOutput[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sunjet Energy AI Talent Funnel';
  workbook.created = new Date();

  // 1. Summary Sheet
  const ws = workbook.addWorksheet('Summary Matrix', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
  });

  // Title row
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Sunjet Energy — Talent Funnel Screening Report';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: DARK_BLUE } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 35;

  // Subtitle row
  ws.mergeCells('A2:G2');
  const subtitleCell = ws.getCell('A2');
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  subtitleCell.value = `Generated: ${dateStr} | Candidates: ${results.length}`;
  subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: DARK_GRAY } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Headers
  const headers = ['Candidate', 'File', 'Score %', 'Tier', 'Key Matched Skills', 'Missing Skills', 'Next Action', 'AI Executive Summary'];
  const headerRow = ws.getRow(4);
  headerRow.values = headers;
  headerRow.height = 30;

  for (let col = 1; col <= headers.length; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  }

  // Data rows
  results.forEach((r, idx) => {
    const rowIdx = idx + 5;
    const row = ws.getRow(rowIdx);
    const scorePct = Number((r.score * 100).toFixed(1));

    row.getCell(1).value = r.candidate_name;
    row.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: DARK_GRAY } };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    row.getCell(1).border = THIN_BORDER;

    row.getCell(2).value = r.file_name;
    row.getCell(2).font = { name: 'Calibri', size: 11 };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    row.getCell(2).border = THIN_BORDER;

    const scoreCell = row.getCell(3);
    scoreCell.value = `${scorePct}%`;
    scoreCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: DARK_BLUE } };
    scoreCell.alignment = { horizontal: 'center', vertical: 'middle' };
    scoreCell.border = THIN_BORDER;

    const tierCell = row.getCell(4);
    tierCell.value = `Tier ${r.tier}`;
    tierCell.alignment = { horizontal: 'center', vertical: 'middle' };
    tierCell.border = THIN_BORDER;

    let tierBg = TIER3_RED;
    let tierFg = TIER3_DARK_RED;
    if (r.tier === 1) {
      tierBg = TIER1_GREEN;
      tierFg = TIER1_DARK_GREEN;
    } else if (r.tier === 2) {
      tierBg = TIER2_YELLOW;
      tierFg = TIER2_DARK_YELLOW;
    }
    tierCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tierBg } };
    tierCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: tierFg } };

    const matchedCell = row.getCell(5);
    matchedCell.value = formatSkills(r.matched_skills);
    matchedCell.font = { name: 'Calibri', size: 11 };
    matchedCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    matchedCell.border = THIN_BORDER;

    const missingCell = row.getCell(6);
    missingCell.value = formatSkills(r.missing_skills);
    missingCell.font = { name: 'Calibri', size: 11 };
    missingCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    missingCell.border = THIN_BORDER;

    const actionCell = row.getCell(7);
    actionCell.value = r.next_action;
    actionCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: DARK_BLUE } };
    actionCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    actionCell.border = THIN_BORDER;

    const summaryCell = row.getCell(8);
    summaryCell.value = r.executive_summary || '—';
    summaryCell.font = { name: 'Calibri', size: 10, italic: true };
    summaryCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    summaryCell.border = THIN_BORDER;

    // Alternate row styling
    if (idx % 2 === 1) {
      for (const colIdx of [1, 2, 5, 6, 7, 8]) {
        row.getCell(colIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
      }
    }

    row.height = Math.max(50, Math.min(140, 20 * Math.ceil(Math.max(r.matched_skills.length, r.missing_skills.length, 1) / 3) + 20));
  });

  // Column widths
  const colWidths = [22, 28, 12, 14, 35, 35, 30, 45];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Auto-filter
  if (results.length > 0) {
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + results.length, column: 8 }
    };
  }

  // 2. Detail sheets per candidate
  const usedTitles = new Set<string>(['Summary Matrix']);
  results.forEach((r, idx) => {
    let rawTitle = r.candidate_name.replace(/[\\/*?:[\]]/g, '').trim().slice(0, 30);
    if (!rawTitle) rawTitle = `Candidate_${idx + 1}`;
    let title = rawTitle;
    let counter = 1;
    while (usedTitles.has(title)) {
      title = `${rawTitle.slice(0, 27)}_${counter++}`;
    }
    usedTitles.add(title);

    const sheet = workbook.addWorksheet(title);
    let curRow = 1;

    // Section Helper
    const addSectionHeader = (text: string) => {
      sheet.mergeCells(`A${curRow}:D${curRow}`);
      const hCell = sheet.getCell(`A${curRow}`);
      hCell.value = text;
      hCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
      hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MEDIUM_BLUE } };
      hCell.alignment = { horizontal: 'center', vertical: 'middle' };
      hCell.border = THIN_BORDER;
      sheet.getRow(curRow).height = 25;
      curRow++;
    };

    // Header block
    addSectionHeader(`Candidate Profile: ${r.candidate_name}`);

    // Info Table
    const infoItems: [string, string][] = [
      ['File Name', r.file_name],
      ['Overall Score', `${(r.score * 100).toFixed(1)}%`],
      ['Tier Classification', `Tier ${r.tier}`],
      ['Screening Method', String(r.raw_breakdown?.method || 'TF-IDF').toUpperCase()],
    ];
    if (r.raw_breakdown?.model) {
      infoItems.push(['Model Used', r.raw_breakdown.model]);
    }

    infoItems.forEach(([label, val]) => {
      sheet.getCell(`A${curRow}`).value = label;
      sheet.getCell(`A${curRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: DARK_GRAY } };
      sheet.getCell(`A${curRow}`).border = THIN_BORDER;

      sheet.getCell(`B${curRow}`).value = val;
      sheet.getCell(`B${curRow}`).font = { name: 'Calibri', size: 11 };
      sheet.getCell(`B${curRow}`).border = THIN_BORDER;
      curRow++;
    });
    curRow++;

    // Matched skills
    addSectionHeader('✓ Matched Skills');
    if (r.matched_skills && r.matched_skills.length > 0) {
      r.matched_skills.forEach((s, sIdx) => {
        sheet.getCell(`A${curRow}`).value = `${sIdx + 1}.`;
        sheet.getCell(`A${curRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: TIER1_DARK_GREEN } };
        sheet.getCell(`A${curRow}`).alignment = { horizontal: 'right', vertical: 'top' };
        sheet.getCell(`A${curRow}`).border = THIN_BORDER;

        sheet.getCell(`B${curRow}`).value = s;
        sheet.getCell(`B${curRow}`).font = { name: 'Calibri', size: 11 };
        sheet.getCell(`B${curRow}`).border = THIN_BORDER;
        curRow++;
      });
    } else {
      sheet.getCell(`A${curRow}`).value = '—';
      curRow++;
    }
    curRow++;

    // Missing skills
    addSectionHeader('✗ Missing / Gap Skills');
    if (r.missing_skills && r.missing_skills.length > 0) {
      r.missing_skills.forEach((s, sIdx) => {
        sheet.getCell(`A${curRow}`).value = `${sIdx + 1}.`;
        sheet.getCell(`A${curRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: TIER3_DARK_RED } };
        sheet.getCell(`A${curRow}`).alignment = { horizontal: 'right', vertical: 'top' };
        sheet.getCell(`A${curRow}`).border = THIN_BORDER;

        sheet.getCell(`B${curRow}`).value = s;
        sheet.getCell(`B${curRow}`).font = { name: 'Calibri', size: 11 };
        sheet.getCell(`B${curRow}`).border = THIN_BORDER;
        curRow++;
      });
    } else {
      sheet.getCell(`A${curRow}`).value = '—';
      curRow++;
    }
    curRow++;

    // AI Executive Verdict
    if (r.executive_summary) {
      addSectionHeader('AI Executive Verdict & Synthesis');
      sheet.mergeCells(`A${curRow}:D${curRow}`);
      const sumCell = sheet.getCell(`A${curRow}`);
      sumCell.value = r.executive_summary;
      sumCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: DARK_BLUE } };
      sumCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      sumCell.border = THIN_BORDER;
      sheet.getRow(curRow).height = 45;
      curRow += 2;
    }

    // Assessment Rationale
    addSectionHeader('Assessment Rationale');

    sheet.getCell(`A${curRow}`).value = 'Strengths (Pros)';
    sheet.getCell(`A${curRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: DARK_BLUE } };
    curRow++;

    (r.pros || []).forEach((pro) => {
      sheet.getCell(`A${curRow}`).value = '•';
      sheet.getCell(`A${curRow}`).font = { name: 'Calibri', size: 11, color: { argb: TIER1_DARK_GREEN } };
      sheet.getCell(`A${curRow}`).alignment = { horizontal: 'center' };
      sheet.getCell(`A${curRow}`).border = THIN_BORDER;

      sheet.mergeCells(`B${curRow}:D${curRow}`);
      sheet.getCell(`B${curRow}`).value = pro;
      sheet.getCell(`B${curRow}`).font = { name: 'Calibri', size: 11 };
      sheet.getCell(`B${curRow}`).border = THIN_BORDER;
      curRow++;
    });
    curRow++;

    sheet.getCell(`A${curRow}`).value = 'Areas for Improvement (Cons)';
    sheet.getCell(`A${curRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: DARK_BLUE } };
    curRow++;

    (r.cons || []).forEach((con) => {
      sheet.getCell(`A${curRow}`).value = '•';
      sheet.getCell(`A${curRow}`).font = { name: 'Calibri', size: 11, color: { argb: TIER3_DARK_RED } };
      sheet.getCell(`A${curRow}`).alignment = { horizontal: 'center' };
      sheet.getCell(`A${curRow}`).border = THIN_BORDER;

      sheet.mergeCells(`B${curRow}:D${curRow}`);
      sheet.getCell(`B${curRow}`).value = con;
      sheet.getCell(`B${curRow}`).font = { name: 'Calibri', size: 11 };
      sheet.getCell(`B${curRow}`).border = THIN_BORDER;
      curRow++;
    });
    curRow++;

    // Recommended Next Action
    addSectionHeader('Recommended Next Action');
    sheet.mergeCells(`A${curRow}:D${curRow}`);
    const aCell = sheet.getCell(`A${curRow}`);
    aCell.value = r.next_action;
    aCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: DARK_BLUE } };
    aCell.alignment = { horizontal: 'left', vertical: 'middle' };
    aCell.border = THIN_BORDER;
    sheet.getRow(curRow).height = 35;
    curRow += 2;

    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 50;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 15;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
