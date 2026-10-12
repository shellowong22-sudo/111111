import { and, desc, eq, inArray } from 'drizzle-orm';
import { tradeBookPrivateBatches, tradeBookPrivateCashFlows, tradeBookPrivatePositionSnapshots } from '../drizzle/schema';
import { getDb } from './db';

export type ImportedTradeBookPosition = {
  snapshotId: string;
  accountLabel: string;
  instrument: string;
  quantity: number;
  snapshotAt: Date;
  marketPrice?: number | null;
  costBasis?: number | null;
  currency?: string | null;
};

export type ImportedTradeBookCashFlow = {
  flowId: string;
  accountLabel: string;
  flowType: string;
  amount: number;
  occurredAt: Date;
  currency?: string | null;
  instrument?: string | null;
};

type StoredPosition = ImportedTradeBookPosition & { id?: number };
type StoredCashFlow = ImportedTradeBookCashFlow & { id?: number };
type ReconciliationException = {
  id: string;
  category: 'missing_market_price' | 'missing_cost_basis' | 'unmatched_cash_flow_account' | 'unmatched_cash_flow_instrument' | 'not_comparable_date';
  severity: 'attention' | 'notice';
  accountLabel: string;
  instrument: string | null;
  occurredAt: Date;
  message: string;
};

const numeric = (value: unknown) => value == null ? null : Number(value);
const normalizedCurrency = (currency: string | null | undefined) => currency?.trim().toUpperCase() || '未提供币种';
const positionKey = (position: Pick<StoredPosition, 'accountLabel' | 'instrument'>) => `${position.accountLabel}\u0000${position.instrument}`;
const accountKey = (accountLabel: string) => accountLabel;
const latestPosition = (left: StoredPosition, right: StoredPosition) => left.snapshotAt.getTime() - right.snapshotAt.getTime() || left.snapshotId.localeCompare(right.snapshotId);

/**
 * 仅针对当前账户主动导入的规范化快照和现金流进行保守分析。
 * 没有市场价格、成本基础或 FX 依据时不补值、不折算、不推断已实现损益。
 */
export function analyzeTradeBookPrivateRecords(positionSnapshots: StoredPosition[], cashFlows: StoredCashFlow[]) {
  const currentByPosition = new Map<string, StoredPosition>();
  for (const position of positionSnapshots) {
    const key = positionKey(position);
    const existing = currentByPosition.get(key);
    if (!existing || latestPosition(existing, position) <= 0) currentByPosition.set(key, position);
  }
  const currentPositions = [...currentByPosition.values()].sort((left, right) => left.accountLabel.localeCompare(right.accountLabel) || left.instrument.localeCompare(right.instrument) || right.snapshotAt.getTime() - left.snapshotAt.getTime());
  const latestSnapshotAt = currentPositions.reduce<Date | null>((latest, position) => !latest || position.snapshotAt > latest ? position.snapshotAt : latest, null);
  const exceptions: ReconciliationException[] = [];
  const valuations = new Map<string, { currency: string; positionCount: number; marketValue: number; marketValueCount: number; unrealizedPnl: number; unrealizedPnlCount: number }>();
  const accountCurrencyMetrics = new Map<string, { accountLabel: string; currency: string; positionCount: number; marketValue: number; marketValueCount: number; unrealizedPnl: number; unrealizedPnlCount: number }>();

  for (const position of currentPositions) {
    const currency = normalizedCurrency(position.currency);
    const value = position.marketPrice == null ? null : position.quantity * position.marketPrice;
    const unrealizedPnl = value != null && position.costBasis != null ? value - position.costBasis : null;
    const valuation = valuations.get(currency) ?? { currency, positionCount: 0, marketValue: 0, marketValueCount: 0, unrealizedPnl: 0, unrealizedPnlCount: 0 };
    const accountMetricKey = `${position.accountLabel}\u0000${currency}`;
    const accountMetric = accountCurrencyMetrics.get(accountMetricKey) ?? { accountLabel: position.accountLabel, currency, positionCount: 0, marketValue: 0, marketValueCount: 0, unrealizedPnl: 0, unrealizedPnlCount: 0 };
    valuation.positionCount += 1;
    accountMetric.positionCount += 1;
    if (value == null) {
      exceptions.push({ id: `position:${position.snapshotId}:market-price`, category: 'missing_market_price', severity: 'attention', accountLabel: position.accountLabel, instrument: position.instrument, occurredAt: position.snapshotAt, message: '缺少导入市价，无法计算该持仓市值。' });
    } else {
      valuation.marketValue += value;
      valuation.marketValueCount += 1;
      accountMetric.marketValue += value;
      accountMetric.marketValueCount += 1;
    }
    if (position.costBasis == null) {
      exceptions.push({ id: `position:${position.snapshotId}:cost-basis`, category: 'missing_cost_basis', severity: 'notice', accountLabel: position.accountLabel, instrument: position.instrument, occurredAt: position.snapshotAt, message: '缺少导入成本基础，无法计算该持仓未实现损益。' });
    } else if (unrealizedPnl != null) {
      valuation.unrealizedPnl += unrealizedPnl;
      valuation.unrealizedPnlCount += 1;
      accountMetric.unrealizedPnl += unrealizedPnl;
      accountMetric.unrealizedPnlCount += 1;
    }
    valuations.set(currency, valuation);
    accountCurrencyMetrics.set(accountMetricKey, accountMetric);
  }

  const positionAccounts = new Set(currentPositions.map((position) => accountKey(position.accountLabel)));
  const positionKeys = new Set(currentPositions.map(positionKey));
  const snapshotTimesByAccount = new Map<string, Set<number>>();
  for (const position of currentPositions) {
    const snapshots = snapshotTimesByAccount.get(position.accountLabel) ?? new Set<number>();
    snapshots.add(position.snapshotAt.getTime());
    snapshotTimesByAccount.set(position.accountLabel, snapshots);
  }
  const cashFlowAttribution = new Map<string, { currency: string; flowType: string; flowCount: number; amount: number }>();
  for (const flow of cashFlows) {
    const currency = normalizedCurrency(flow.currency);
    const attributionKey = `${currency}\u0000${flow.flowType}`;
    const attribution = cashFlowAttribution.get(attributionKey) ?? { currency, flowType: flow.flowType, flowCount: 0, amount: 0 };
    attribution.flowCount += 1;
    attribution.amount += flow.amount;
    cashFlowAttribution.set(attributionKey, attribution);
    if (!positionAccounts.has(accountKey(flow.accountLabel))) {
      exceptions.push({ id: `flow:${flow.flowId}:account`, category: 'unmatched_cash_flow_account', severity: 'attention', accountLabel: flow.accountLabel, instrument: flow.instrument ?? null, occurredAt: flow.occurredAt, message: '现金流所属账户在当前持仓快照中没有匹配持仓，不能自动对账。' });
    } else if (flow.instrument && !positionKeys.has(`${flow.accountLabel}\u0000${flow.instrument}`)) {
      exceptions.push({ id: `flow:${flow.flowId}:instrument`, category: 'unmatched_cash_flow_instrument', severity: 'attention', accountLabel: flow.accountLabel, instrument: flow.instrument, occurredAt: flow.occurredAt, message: '现金流标的在同账户当前持仓快照中没有匹配持仓，不能自动对账。' });
    }
    const snapshotTimes = snapshotTimesByAccount.get(flow.accountLabel);
    if (snapshotTimes?.size && !snapshotTimes.has(flow.occurredAt.getTime())) {
      exceptions.push({ id: `flow:${flow.flowId}:date`, category: 'not_comparable_date', severity: 'notice', accountLabel: flow.accountLabel, instrument: flow.instrument ?? null, occurredAt: flow.occurredAt, message: '现金流时间与该账户导入持仓快照时间不同；系统不推断期间持仓变化或已实现损益。' });
    }
  }

  return {
    positionSnapshotCount: positionSnapshots.length,
    currentPositionCount: currentPositions.length,
    cashFlowCount: cashFlows.length,
    latestSnapshotAt,
    currentPositions: currentPositions.map((position) => ({ ...position, currency: normalizedCurrency(position.currency), marketValue: position.marketPrice == null ? null : position.quantity * position.marketPrice, unrealizedPnl: position.marketPrice != null && position.costBasis != null ? position.quantity * position.marketPrice - position.costBasis : null })),
    valuations: [...valuations.values()].sort((left, right) => left.currency.localeCompare(right.currency)),
    accountMetrics: [...accountCurrencyMetrics.values()].sort((left, right) => left.accountLabel.localeCompare(right.accountLabel) || left.currency.localeCompare(right.currency)),
    cashFlowAttribution: [...cashFlowAttribution.values()].sort((left, right) => left.currency.localeCompare(right.currency) || left.flowType.localeCompare(right.flowType)),
    reconciliationExceptions: exceptions.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime() || left.id.localeCompare(right.id)),
  };
}

export async function importTradeBookPrivateBatch(userId: number, input: { name: string; sourceLabel: string; asOfAt: Date; positions: ImportedTradeBookPosition[]; cashFlows: ImportedTradeBookCashFlow[] }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const inserted = await db.insert(tradeBookPrivateBatches).values({ userId, name: input.name.trim().slice(0, 120), sourceLabel: input.sourceLabel.trim().slice(0, 160), asOfAt: input.asOfAt });
  const batchId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  if (input.positions.length) await db.insert(tradeBookPrivatePositionSnapshots).values(input.positions.map((position) => ({ userId, batchId, snapshotId: position.snapshotId.trim().slice(0, 120), accountLabel: position.accountLabel.trim().slice(0, 120), instrument: position.instrument.trim().slice(0, 160), quantity: String(position.quantity), marketPrice: position.marketPrice == null ? null : String(position.marketPrice), costBasis: position.costBasis == null ? null : String(position.costBasis), currency: position.currency?.trim().toUpperCase().slice(0, 12) || null, snapshotAt: position.snapshotAt })));
  if (input.cashFlows.length) await db.insert(tradeBookPrivateCashFlows).values(input.cashFlows.map((flow) => ({ userId, batchId, flowId: flow.flowId.trim().slice(0, 120), accountLabel: flow.accountLabel.trim().slice(0, 120), flowType: flow.flowType.trim().slice(0, 48), amount: String(flow.amount), currency: flow.currency?.trim().toUpperCase().slice(0, 12) || null, instrument: flow.instrument?.trim().slice(0, 160) || null, occurredAt: flow.occurredAt })));
  return { batchId, importedPositions: input.positions.length, importedCashFlows: input.cashFlows.length };
}

export async function listTradeBookPrivateBatches(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(tradeBookPrivateBatches).where(eq(tradeBookPrivateBatches.userId, userId)).orderBy(desc(tradeBookPrivateBatches.createdAt));
}

export async function getTradeBookPrivateDossier(userId: number, batchId?: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const batch = batchId
    ? (await db.select().from(tradeBookPrivateBatches).where(and(eq(tradeBookPrivateBatches.userId, userId), eq(tradeBookPrivateBatches.id, batchId))).limit(1))[0]
    : (await db.select().from(tradeBookPrivateBatches).where(eq(tradeBookPrivateBatches.userId, userId)).orderBy(desc(tradeBookPrivateBatches.createdAt)).limit(1))[0];
  if (!batch) return null;
  const [positionRows, cashFlowRows] = await Promise.all([
    db.select().from(tradeBookPrivatePositionSnapshots).where(and(eq(tradeBookPrivatePositionSnapshots.userId, userId), eq(tradeBookPrivatePositionSnapshots.batchId, batch.id))).orderBy(tradeBookPrivatePositionSnapshots.snapshotAt),
    db.select().from(tradeBookPrivateCashFlows).where(and(eq(tradeBookPrivateCashFlows.userId, userId), eq(tradeBookPrivateCashFlows.batchId, batch.id))).orderBy(tradeBookPrivateCashFlows.occurredAt),
  ]);
  const positions: StoredPosition[] = positionRows.map((position) => ({ snapshotId: position.snapshotId, accountLabel: position.accountLabel, instrument: position.instrument, quantity: numeric(position.quantity) ?? 0, marketPrice: numeric(position.marketPrice), costBasis: numeric(position.costBasis), currency: position.currency, snapshotAt: position.snapshotAt }));
  const cashFlows: StoredCashFlow[] = cashFlowRows.map((flow) => ({ flowId: flow.flowId, accountLabel: flow.accountLabel, flowType: flow.flowType, amount: numeric(flow.amount) ?? 0, currency: flow.currency, instrument: flow.instrument, occurredAt: flow.occurredAt }));
  return { batch, positions, cashFlows, ...analyzeTradeBookPrivateRecords(positions, cashFlows) };
}

export async function exportTradeBookPrivateBatches(userId: number, batchIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const batches = await db.select().from(tradeBookPrivateBatches).where(and(eq(tradeBookPrivateBatches.userId, userId), ...(batchIds?.length ? [inArray(tradeBookPrivateBatches.id, batchIds.slice(0, 100))] : []))).orderBy(desc(tradeBookPrivateBatches.createdAt));
  if (!batches.length) return { generatedAt: new Date(), batches: [] as unknown[] };
  const ids = batches.map((batch) => batch.id);
  const [positions, cashFlows] = await Promise.all([
    db.select().from(tradeBookPrivatePositionSnapshots).where(and(eq(tradeBookPrivatePositionSnapshots.userId, userId), inArray(tradeBookPrivatePositionSnapshots.batchId, ids))).orderBy(tradeBookPrivatePositionSnapshots.snapshotAt),
    db.select().from(tradeBookPrivateCashFlows).where(and(eq(tradeBookPrivateCashFlows.userId, userId), inArray(tradeBookPrivateCashFlows.batchId, ids))).orderBy(tradeBookPrivateCashFlows.occurredAt),
  ]);
  return { generatedAt: new Date(), batches: batches.map((batch) => ({ ...batch, positions: positions.filter((position) => position.batchId === batch.id), cashFlows: cashFlows.filter((flow) => flow.batchId === batch.id) })) };
}
