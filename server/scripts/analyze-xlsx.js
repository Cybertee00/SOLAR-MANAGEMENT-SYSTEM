/**
 * Analyze an Excel (.xlsx) template to understand its structure and any placeholders.
 *
 * Usage:
 *   node scripts/analyze-xlsx.js "D:/PJs/ChecksheetsApp/Checksheets/excel/Energy Meter_Checklist.xlsx"
 *   node scripts/analyze-xlsx.js
 *
 * Output:
 * - Prints workbook + worksheet summary to console
 * - Writes a markdown report to server/EXCEL_TEMPLATE_ANALYSIS.md
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const defaultXlsxPath = path.join(__dirname, '../../Checksheets/excel/Energy Meter_Checklist.xlsx');
const xlsxPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultXlsxPath;

function isNonEmptyCellValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return true;
  if (typeof v === 'boolean') return true;
  if (v && typeof v === 'object') {
    // exceljs richText, formula, date etc.
    if (v.text && String(v.text).trim().length > 0) return true;
    if (v.richText && Array.isArray(v.richText) && v.richText.some(rt => String(rt.text || '').trim().length > 0)) return true;
    if (v.formula) return true;
    if (v.result !== undefined) return true;
  }
  return true;
}

function toCellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text;
    if (Array.isArray(v.richText)) return v.richText.map(rt => rt.text || '').join('');
    if (v.formula) return `=${v.formula}`;
    if (v.hyperlink) return String(v.text || v.hyperlink);
    if (v.result !== undefined) return String(v.result);
  }
  try {
    return String(v);
  } catch {
    return '';
  }
}

function findPlaceholdersInText(text) {
  const placeholders = [];
  // Support both:
  // - {{placeholder}} (Word-style)
  // - {placeholder}   (Excel template in this project uses this)
  const res = [
    /\{\{([^}]+)\}\}/g,
    /\{([a-zA-Z0-9_.-]+)\}/g
  ];

  for (const re of res) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const p = String(m[1] || '').trim();
      if (p && !placeholders.includes(p)) placeholders.push(p);
    }
  }
  return placeholders;
}

function detectHeaderRow(worksheet, maxScanRows = 60) {
  const headerKeywords = ['s/n', 'sn', 'no', 'item', 'check', 'inspection', 'activity', 'parameter', 'result', 'pass', 'fail', 'remarks', 'observation'];
  for (let r = 1; r <= Math.min(maxScanRows, worksheet.rowCount || maxScanRows); r++) {
    const row = worksheet.getRow(r);
    const texts = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      const t = toCellText(cell.value).toLowerCase();
      if (t) texts.push(t);
    });
    if (texts.length === 0) continue;
    const hits = headerKeywords.filter(k => texts.some(t => t.includes(k)));
    if (hits.length >= 2) {
      return { rowNumber: r, hits, texts: texts.slice(0, 30) };
    }
  }
  return null;
}

async function main() {
  if (!fs.existsSync(xlsxPath)) {
    console.error('❌ Excel file not found:', xlsxPath);
    process.exit(1);
  }

  console.log('Analyzing Excel template:', xlsxPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const mdLines = [];
  mdLines.push('# Excel Template Analysis');
  mdLines.push('');
  mdLines.push(`**File:** \`${xlsxPath}\``);
  mdLines.push('');
  mdLines.push(`**Worksheets:** ${workbook.worksheets.length}`);
  mdLines.push('');

  const allPlaceholders = new Set();

  workbook.worksheets.forEach((ws, idx) => {
    const used = { minRow: null, maxRow: null, minCol: null, maxCol: null, nonEmptyCells: 0 };
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (!isNonEmptyCellValue(cell.value)) return;
        used.nonEmptyCells++;
        used.minRow = used.minRow === null ? rowNumber : Math.min(used.minRow, rowNumber);
        used.maxRow = used.maxRow === null ? rowNumber : Math.max(used.maxRow, rowNumber);
        used.minCol = used.minCol === null ? colNumber : Math.min(used.minCol, colNumber);
        used.maxCol = used.maxCol === null ? colNumber : Math.max(used.maxCol, colNumber);

        const text = toCellText(cell.value);
        findPlaceholdersInText(text).forEach(p => allPlaceholders.add(p));
      });
    });

    const headerGuess = detectHeaderRow(ws);

    mdLines.push(`## Sheet ${idx + 1}: ${ws.name}`);
    mdLines.push('');
    mdLines.push(`- **Used range (approx)**: rows ${used.minRow ?? '-'} to ${used.maxRow ?? '-'}, cols ${used.minCol ?? '-'} to ${used.maxCol ?? '-'}`);
    mdLines.push(`- **Non-empty cells**: ${used.nonEmptyCells}`);
    if (headerGuess) {
      mdLines.push(`- **Header row guess**: row ${headerGuess.rowNumber} (matched: ${headerGuess.hits.join(', ')})`);
    } else {
      mdLines.push(`- **Header row guess**: not detected`);
    }
    mdLines.push('');

    // Preview: first ~25 rows in used range, first ~8 cols in used range
    const previewRowStart = used.minRow ?? 1;
    const previewRowEnd = Math.min((used.minRow ?? 1) + 24, used.maxRow ?? 30);
    const previewColStart = used.minCol ?? 1;
    const previewColEnd = Math.min((used.minCol ?? 1) + 17, used.maxCol ?? 18);

    mdLines.push('**Preview (top-left region):**');
    mdLines.push('');
    mdLines.push('| Row | Cells (A..R) |');
    mdLines.push('|---:|---|');
    for (let r = previewRowStart; r <= previewRowEnd; r++) {
      const row = ws.getRow(r);
      const parts = [];
      for (let c = previewColStart; c <= previewColEnd; c++) {
        const cell = row.getCell(c);
        const t = toCellText(cell.value).replace(/\s+/g, ' ').trim();
        if (t) {
          const colLetter = ws.getColumn(c).letter || String(c);
          parts.push(`${colLetter}${r}: ${t}`);
        }
      }
      const joined = parts.join(' · ').slice(0, 240);
      mdLines.push(`| ${r} | ${joined || ''} |`);
    }
    mdLines.push('');
  });

  mdLines.push('## Detected placeholders');
  mdLines.push('');
  if (allPlaceholders.size === 0) {
    mdLines.push('No `{{...}}` or `{...}` placeholders detected in this Excel file.');
    mdLines.push('');
    mdLines.push('If you want the app to fill this template **without redesigning it**, add placeholders into the exact cells where values should appear, for example:');
    mdLines.push('');
    mdLines.push('- `{{task_code}}`');
    mdLines.push('- `{{asset_name}}`');
    mdLines.push('- `{{inspection_date}}`');
    mdLines.push('');
  } else {
    Array.from(allPlaceholders).sort().forEach(p => mdLines.push(`- \`{${p}}\` (also supports \`{{${p}}}\`)`));
    mdLines.push('');
  }

  const outPath = path.join(__dirname, '../EXCEL_TEMPLATE_ANALYSIS.md');
  fs.writeFileSync(outPath, mdLines.join('\n'), 'utf8');

  console.log('✅ Analysis written to:', outPath);
  console.log('Detected placeholders:', allPlaceholders.size);
}

main().catch((e) => {
  console.error('❌ Failed to analyze Excel template:', e);
  process.exit(1);
});


