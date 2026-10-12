import { and, asc, desc, eq, gte, inArray, like, lte } from 'drizzle-orm';
import { preferredTermImportBatches, preferredTermRecords } from '../drizzle/schema';
import { getDb } from './db';

export const DIVIDEND_TYPES = ['fixed', 'floating', 'fixed_to_float', 'other'] as const;
export const PAYMENT_FREQUENCIES = ['monthly', 'quarterly', 'semiannual', 'annual', 'other'] as const;
export type DividendType = typeof DIVIDEND_TYPES[number];
export type PaymentFrequency = typeof PAYMENT_FREQUENCIES[number];

export type RawPreferredTermRow = {
  securityIdentifier?: string | null; issuerName?: string | null; securityName?: string | null; cik?: string | null;
  dividendType?: string | null; couponRatePct?: string | number | null; paymentFrequency?: string | null;
  referenceIndex?: string | null; spreadBps?: string | number | null; resetFrequency?: string | null;
  firstCallDate?: string | null; maturityDate?: string | null; liquidationPreference?: string | number | null;
  sourceReference?: string | null; asOfDate?: string | null;
};

export type PreferredTerm = {
  securityIdentifier: string; issuerName: string; securityName: string; cik: string | null; dividendType: DividendType;
  couponRatePct: string | null; paymentFrequency: PaymentFrequency; referenceIndex: string | null; spreadBps: number | null;
  resetFrequency: PaymentFrequency | null; firstCallDate: string | null; maturityDate: string | null;
  liquidationPreference: string | null; sourceReference: string | null; asOfDate: string;
};
export type TermValidationIssue = { field: string; severity: 'error' | 'warning'; message: string };
export type ValidatedTermRow = { rowNumber: number; raw: RawPreferredTermRow; normalized: PreferredTerm | null; errors: TermValidationIssue[]; warnings: TermValidationIssue[] };
export type TermCoverageReport = { importedRecords: number; coreCoveragePct: number; conditionalCoveragePct: number; recommendedCoveragePct: number; fieldMissingCounts: Record<string, number>; typeSummary: Array<{ dividendType: string; records: number; completeRecords: number }> };

const clean = (value: unknown, limit = 240) => String(value ?? '').trim().slice(0, limit) || null;
const validDate = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
const numeric = (value: unknown) => { const text = clean(value, 64); if (!text) return null; const parsed = Number(text.replace(/,/g, '')); return Number.isFinite(parsed) ? parsed : Number.NaN; };
const normalizedEnum = <T extends readonly string[]>(value: unknown, allowed: T): T[number] | null => { const candidate = clean(value, 40)?.toLowerCase().replace(/[\s-]+/g, '_') ?? null; return candidate && (allowed as readonly string[]).includes(candidate) ? candidate as T[number] : null; };
const parseTermDate = (value: string | null | undefined) => {
  if (!value) return null;
  if (!validDate(value)) throw new Error('INVALID_PREFERRED_TERM_DATE');
  return new Date(`${value}T00:00:00.000Z`);
};
const serializeTermDate = (value: Date | string | null | undefined) => value instanceof Date ? value.toISOString().slice(0, 10) : value ?? null;

export function validatePreferredTermRows(rows: RawPreferredTermRow[]): ValidatedTermRow[] {
  const identifiers = new Set<string>();
  return rows.map((raw, index) => {
    const errors: TermValidationIssue[] = []; const warnings: TermValidationIssue[] = [];
    const securityIdentifier = clean(raw.securityIdentifier, 120); const issuerName = clean(raw.issuerName); const securityName = clean(raw.securityName);
    const dividendType = normalizedEnum(raw.dividendType, DIVIDEND_TYPES); const paymentFrequency = normalizedEnum(raw.paymentFrequency, PAYMENT_FREQUENCIES);
    const resetFrequency = raw.resetFrequency == null || clean(raw.resetFrequency) == null ? null : normalizedEnum(raw.resetFrequency, PAYMENT_FREQUENCIES);
    const cikRaw = clean(raw.cik, 10); const cik = cikRaw ? (/^\d{1,10}$/.test(cikRaw) ? cikRaw.padStart(10, '0') : null) : null;
    const coupon = numeric(raw.couponRatePct); const spread = numeric(raw.spreadBps); const liquidation = numeric(raw.liquidationPreference);
    const firstCallDate = clean(raw.firstCallDate, 10); const maturityDate = clean(raw.maturityDate, 10); const asOfDate = clean(raw.asOfDate, 10);
    if (!securityIdentifier) errors.push({ field: 'security_identifier', severity: 'error', message: '证券标识为必填字段。' });
    else if (identifiers.has(securityIdentifier.toLowerCase())) errors.push({ field: 'security_identifier', severity: 'error', message: '同一文件内证券标识重复。' });
    else identifiers.add(securityIdentifier.toLowerCase());
    if (!issuerName) errors.push({ field: 'issuer_name', severity: 'error', message: '发行主体为必填字段。' });
    if (!securityName) errors.push({ field: 'security_name', severity: 'error', message: '证券名称为必填字段。' });
    if (!dividendType) errors.push({ field: 'dividend_type', severity: 'error', message: '分配类型必须为 fixed、floating、fixed_to_float 或 other。' });
    if (!paymentFrequency) errors.push({ field: 'payment_frequency', severity: 'error', message: '支付频率必须为 monthly、quarterly、semiannual、annual 或 other。' });
    if (!asOfDate || !validDate(asOfDate)) errors.push({ field: 'as_of_date', severity: 'error', message: '截至日期必须是有效 YYYY-MM-DD 日期。' });
    if (cikRaw && !cik) errors.push({ field: 'cik', severity: 'error', message: 'CIK 必须为 1–10 位数字。' });
    if (coupon !== null && (!Number.isFinite(coupon) || coupon < 0 || coupon > 100)) errors.push({ field: 'coupon_rate_pct', severity: 'error', message: '固定分配率必须在 0–100 之间。' });
    if (spread !== null && (!Number.isInteger(spread) || spread < -10_000 || spread > 10_000)) errors.push({ field: 'spread_bps', severity: 'error', message: '加点必须为 -10,000 至 10,000 之间的整数 bps。' });
    if (liquidation !== null && (!Number.isFinite(liquidation) || liquidation <= 0)) errors.push({ field: 'liquidation_preference', severity: 'error', message: '清算优先额必须为正数。' });
    if (firstCallDate && !validDate(firstCallDate)) errors.push({ field: 'first_call_date', severity: 'error', message: '首次赎回日必须是有效 YYYY-MM-DD 日期。' });
    if (maturityDate && !validDate(maturityDate)) errors.push({ field: 'maturity_date', severity: 'error', message: '到期日必须是有效 YYYY-MM-DD 日期。' });
    const referenceIndex = clean(raw.referenceIndex, 120); const sourceReference = clean(raw.sourceReference); const isFloat = dividendType === 'floating' || dividendType === 'fixed_to_float'; const isCoupon = dividendType === 'fixed' || dividendType === 'fixed_to_float';
    if (isCoupon && coupon === null) errors.push({ field: 'coupon_rate_pct', severity: 'error', message: '固定或固定转浮动分配类型必须提供固定分配率。' });
    if (isFloat && !referenceIndex) errors.push({ field: 'reference_index', severity: 'error', message: '浮动或固定转浮动类型必须提供参考指数。' });
    if (isFloat && spread === null) errors.push({ field: 'spread_bps', severity: 'error', message: '浮动或固定转浮动类型必须提供加点。' });
    if (isFloat && !resetFrequency) errors.push({ field: 'reset_frequency', severity: 'error', message: '浮动或固定转浮动类型必须提供重设频率。' });
    if (!firstCallDate) warnings.push({ field: 'first_call_date', severity: 'warning', message: '未提供首次赎回日。' });
    if (!maturityDate) warnings.push({ field: 'maturity_date', severity: 'warning', message: '未提供到期日。' });
    if (liquidation === null) warnings.push({ field: 'liquidation_preference', severity: 'warning', message: '未提供清算优先额。' });
    if (!sourceReference) warnings.push({ field: 'source_reference', severity: 'warning', message: '未提供内部来源标识或文件参考。' });
    const normalized = errors.length || !securityIdentifier || !issuerName || !securityName || !dividendType || !paymentFrequency || !asOfDate ? null : { securityIdentifier, issuerName, securityName, cik, dividendType, couponRatePct: coupon === null ? null : coupon.toFixed(4), paymentFrequency, referenceIndex, spreadBps: spread === null ? null : spread, resetFrequency, firstCallDate, maturityDate, liquidationPreference: liquidation === null ? null : liquidation.toFixed(4), sourceReference, asOfDate };
    return { rowNumber: index + 2, raw, normalized, errors, warnings };
  });
}

const termValue = (value: unknown) => value === null || value === undefined || value === '' ? null : String(value);

export function buildTermCoverageReport(rows: PreferredTerm[]): TermCoverageReport {
  const missing: Record<string, number> = {}; const add = (field: string, value: unknown) => { if (!termValue(value)) missing[field] = (missing[field] ?? 0) + 1; };
  const core = ['securityIdentifier', 'issuerName', 'securityName', 'dividendType', 'paymentFrequency', 'asOfDate'] as const;
  const recommended = ['firstCallDate', 'maturityDate', 'liquidationPreference', 'sourceReference'] as const;
  let corePresent = 0; let coreTotal = 0; let conditionalPresent = 0; let conditionalTotal = 0; let recommendedPresent = 0; let recommendedTotal = 0;
  const typeMap = new Map<string, { records: number; completeRecords: number }>();
  rows.forEach((row) => {
    let complete = true;
    core.forEach((field) => { coreTotal += 1; add(field, row[field]); if (termValue(row[field])) corePresent += 1; else complete = false; });
    const conditional: Array<keyof PreferredTerm> = row.dividendType === 'fixed' ? ['couponRatePct'] : row.dividendType === 'floating' ? ['referenceIndex', 'spreadBps', 'resetFrequency'] : row.dividendType === 'fixed_to_float' ? ['couponRatePct', 'referenceIndex', 'spreadBps', 'resetFrequency'] : [];
    conditional.forEach((field) => { conditionalTotal += 1; add(field, row[field]); if (termValue(row[field])) conditionalPresent += 1; else complete = false; });
    recommended.forEach((field) => { recommendedTotal += 1; add(field, row[field]); if (termValue(row[field])) recommendedPresent += 1; });
    const summary = typeMap.get(row.dividendType) ?? { records: 0, completeRecords: 0 }; summary.records += 1; if (complete) summary.completeRecords += 1; typeMap.set(row.dividendType, summary);
  });
  const pct = (present: number, total: number) => total ? Number((present / total * 100).toFixed(1)) : 100;
  return { importedRecords: rows.length, coreCoveragePct: pct(corePresent, coreTotal), conditionalCoveragePct: pct(conditionalPresent, conditionalTotal), recommendedCoveragePct: pct(recommendedPresent, recommendedTotal), fieldMissingCounts: missing, typeSummary: Array.from(typeMap.entries()).map(([dividendType, summary]) => ({ dividendType, ...summary })).sort((a, b) => a.dividendType.localeCompare(b.dividendType)) };
}

export async function importPreferredTerms(userId: number, sourceFilename: string, rows: RawPreferredTermRow[]) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const validated = validatePreferredTermRows(rows); const accepted = validated.flatMap((row) => row.normalized ? [row.normalized] : []); const rejectedRows = validated.filter((row) => row.errors.length).length; const warningRows = validated.filter((row) => row.warnings.length).length;
  if (!accepted.length) return { batch: null, importedRows: 0, updatedRows: 0, rejectedRows, warningRows, validation: validated, coverage: buildTermCoverageReport([]) };
  const coverage = buildTermCoverageReport(accepted); const identifiers = accepted.map((row) => row.securityIdentifier);
  const existing = await db.select({ securityIdentifier: preferredTermRecords.securityIdentifier }).from(preferredTermRecords).where(and(eq(preferredTermRecords.userId, userId), inArray(preferredTermRecords.securityIdentifier, identifiers)));
  const existingSet = new Set(existing.map((row) => row.securityIdentifier)); const updatedRows = accepted.filter((row) => existingSet.has(row.securityIdentifier)).length;
  const result = await db.transaction(async (tx) => {
    const batchInsert = await tx.insert(preferredTermImportBatches).values({ userId, sourceFilename: clean(sourceFilename, 240) ?? 'preferred-terms.csv', totalRows: rows.length, acceptedRows: accepted.length, rejectedRows, updatedRows, warningRows, coverageSummary: coverage });
    const batchId = Number((batchInsert as any)[0]?.insertId ?? (batchInsert as any).insertId);
    for (const row of accepted) {
      const values = { userId, securityIdentifier: row.securityIdentifier, issuerName: row.issuerName, securityName: row.securityName, cik: row.cik, dividendType: row.dividendType, couponRatePct: row.couponRatePct, paymentFrequency: row.paymentFrequency, referenceIndex: row.referenceIndex, spreadBps: row.spreadBps, resetFrequency: row.resetFrequency, firstCallDate: parseTermDate(row.firstCallDate), maturityDate: parseTermDate(row.maturityDate), liquidationPreference: row.liquidationPreference, sourceReference: row.sourceReference, asOfDate: parseTermDate(row.asOfDate)!, sourceBatchId: batchId, updatedAt: new Date() };
      await tx.insert(preferredTermRecords).values(values).onDuplicateKeyUpdate({ set: values });
    }
    return (await tx.select().from(preferredTermImportBatches).where(eq(preferredTermImportBatches.id, batchId)).limit(1))[0];
  });
  return { batch: result, importedRows: accepted.length, updatedRows, rejectedRows, warningRows, validation: validated, coverage };
}

export async function listPreferredTerms(userId: number, filter: { dividendType?: DividendType; issuerQuery?: string; asOfStart?: string; asOfEnd?: string; limit?: number }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const conditions = [eq(preferredTermRecords.userId, userId)];
  if (filter.dividendType) conditions.push(eq(preferredTermRecords.dividendType, filter.dividendType));
  if (filter.issuerQuery?.trim()) conditions.push(like(preferredTermRecords.issuerName, `%${filter.issuerQuery.trim().slice(0, 120)}%`));
  const asOfStart = parseTermDate(filter.asOfStart);
  const asOfEnd = parseTermDate(filter.asOfEnd);
  if (asOfStart) conditions.push(gte(preferredTermRecords.asOfDate, asOfStart));
  if (asOfEnd) conditions.push(lte(preferredTermRecords.asOfDate, asOfEnd));
  return db.select().from(preferredTermRecords).where(and(...conditions)).orderBy(desc(preferredTermRecords.asOfDate), asc(preferredTermRecords.issuerName), asc(preferredTermRecords.securityIdentifier)).limit(Math.min(Math.max(filter.limit ?? 500, 1), 1000));
}

export async function getPreferredTermCoverage(userId: number) {
  const rows = await listPreferredTerms(userId, { limit: 1000 });
  return buildTermCoverageReport(rows.map((row) => ({ securityIdentifier: row.securityIdentifier, issuerName: row.issuerName, securityName: row.securityName, cik: row.cik, dividendType: row.dividendType, couponRatePct: termValue(row.couponRatePct), paymentFrequency: row.paymentFrequency, referenceIndex: row.referenceIndex, spreadBps: row.spreadBps, resetFrequency: row.resetFrequency, firstCallDate: serializeTermDate(row.firstCallDate), maturityDate: serializeTermDate(row.maturityDate), liquidationPreference: termValue(row.liquidationPreference), sourceReference: row.sourceReference, asOfDate: serializeTermDate(row.asOfDate)! })));
}

export async function listPreferredTermImportBatches(userId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(preferredTermImportBatches).where(eq(preferredTermImportBatches.userId, userId)).orderBy(desc(preferredTermImportBatches.importedAt)).limit(30);
}
