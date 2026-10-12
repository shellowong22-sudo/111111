export type BondPositionInput = {
  identifier: string;
  faceValue: number;
  couponRate: number;
  maturityYears: number;
  yieldToMaturity: number;
  frequency: 1 | 2 | 4;
};

export type CsvField = keyof BondPositionInput;
export type CsvMapping = Record<string, CsvField | ''>;
export type CsvRowError = { rowNumber: number; reason: string; rawValues: string[] };
export type CsvInspection = { headers: string[]; rows: string[][]; mapping: CsvMapping; parseErrors: CsvRowError[] };
export type CsvImportResult = { positions: BondPositionInput[]; errors: CsvRowError[]; missingFields: CsvField[] };

export const REQUIRED_CSV_FIELDS: CsvField[] = ['identifier', 'faceValue', 'couponRate', 'maturityYears', 'yieldToMaturity'];
export const CSV_FIELD_LABELS: Record<CsvField, string> = {
  identifier: '标的（ISIN / CUSIP / 代码）',
  faceValue: '面值',
  couponRate: '票面利率（%）',
  maturityYears: '剩余年限',
  yieldToMaturity: '到期收益率（%）',
  frequency: '付息频率（次/年）',
};

const aliases: Record<string, CsvField> = {
  identifier: 'identifier', isin: 'identifier', cusip: 'identifier', security: 'identifier', symbol: 'identifier', code: 'identifier',
  facevalue: 'faceValue', notional: 'faceValue', nominal: 'faceValue', parvalue: 'faceValue', principal: 'faceValue',
  couponrate: 'couponRate', coupon: 'couponRate', couponpct: 'couponRate', couponpercent: 'couponRate',
  maturityyears: 'maturityYears', years: 'maturityYears', yearstomaturity: 'maturityYears', tenor: 'maturityYears', remainingyears: 'maturityYears',
  yieldtomaturity: 'yieldToMaturity', ytm: 'yieldToMaturity', yield: 'yieldToMaturity', yieldpct: 'yieldToMaturity',
  frequency: 'frequency', couponfrequency: 'frequency', paymentfrequency: 'frequency',
};

function normalizeHeader(value: string) { return value.replace(/^\uFEFF/, '').trim().replace(/[_\s-]/g, '').toLowerCase(); }

/** 解析 RFC 4180 常用引号规则，保留空列；不把上传内容发往网络。 */
export function parseCsvTable(text: string): { rows: string[][]; errors: CsvRowError[] } {
  const rows: string[][] = []; const errors: CsvRowError[] = [];
  let row: string[] = []; let cell = ''; let quoted = false; let line = 1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim()); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = []; line += 1; continue;
    }
    cell += char;
  }
  if (quoted) errors.push({ rowNumber: line, reason: '存在未闭合的引号。', rawValues: row.concat(cell) });
  if (cell !== '' || row.length > 0) { row.push(cell.trim()); if (row.some((value) => value !== '')) rows.push(row); }
  return { rows, errors };
}

export function inspectBondPortfolioCsv(text: string): CsvInspection {
  const parsed = parseCsvTable(text);
  if (parsed.rows.length === 0) return { headers: [], rows: [], mapping: {}, parseErrors: [{ rowNumber: 1, reason: 'CSV 为空。', rawValues: [] }] };
  const headers = parsed.rows[0].map((header, index) => header || `未命名列 ${index + 1}`);
  return { headers, rows: parsed.rows.slice(1), mapping: Object.fromEntries(headers.map((header) => [header, aliases[normalizeHeader(header)] ?? ''])), parseErrors: parsed.errors };
}

export function importBondPortfolioRows(inspection: CsvInspection, mapping: CsvMapping): CsvImportResult {
  const mappedFields = Object.values(mapping).filter((field): field is CsvField => Boolean(field));
  const missingFields = REQUIRED_CSV_FIELDS.filter((field) => !mappedFields.includes(field));
  if (missingFields.length) return { positions: [], errors: inspection.parseErrors, missingFields };
  const duplicateFields = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);
  if (duplicateFields.length) {
    const uniqueDuplicates = duplicateFields.filter((field, index, all) => all.indexOf(field) === index);
    return { positions: [], errors: [{ rowNumber: 1, reason: `字段映射重复：${uniqueDuplicates.map((field) => CSV_FIELD_LABELS[field]).join('、')}。`, rawValues: inspection.headers }], missingFields: [] };
  }
  const positions: BondPositionInput[] = []; const errors = [...inspection.parseErrors];
  for (let rowIndex = 0; rowIndex < inspection.rows.length; rowIndex += 1) {
    const rawValues = inspection.rows[rowIndex]; const record: Partial<Record<CsvField, string>> = {};
    inspection.headers.forEach((header, columnIndex) => { const field = mapping[header]; if (field) record[field] = rawValues[columnIndex] ?? ''; });
    const faceValue = Number(record.faceValue); const couponRate = Number(record.couponRate); const maturityYears = Number(record.maturityYears); const yieldToMaturity = Number(record.yieldToMaturity); const frequencyValue = Number(record.frequency || 2);
    const invalid: string[] = [];
    if (!record.identifier?.trim()) invalid.push('标的为空');
    if (!Number.isFinite(faceValue) || faceValue <= 0) invalid.push('面值须为正数');
    if (!Number.isFinite(couponRate)) invalid.push('票面利率无效');
    if (!Number.isFinite(maturityYears) || maturityYears <= 0) invalid.push('剩余年限须为正数');
    if (!Number.isFinite(yieldToMaturity)) invalid.push('到期收益率无效');
    if (![1, 2, 4].includes(frequencyValue)) invalid.push('付息频率仅支持 1、2 或 4');
    if (invalid.length) { errors.push({ rowNumber: rowIndex + 2, reason: invalid.join('；'), rawValues }); continue; }
    positions.push({ identifier: record.identifier!.trim(), faceValue, couponRate, maturityYears, yieldToMaturity, frequency: frequencyValue as 1 | 2 | 4 });
  }
  return { positions, errors, missingFields: [] };
}

function csvCell(value: string | number) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

export function buildBondPortfolioErrorReport(headers: string[], errors: CsvRowError[]) {
  return ['rowNumber,reason,rawValues', ...errors.map((error) => [error.rowNumber, error.reason, error.rawValues.map((value, index) => `${headers[index] ?? `列${index + 1}`}: ${value}`).join(' | ')].map(csvCell).join(','))].join('\n');
}
