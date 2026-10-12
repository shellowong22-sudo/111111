export const ORDER_EVENT_FIELD_DEFINITIONS = [
  { key: 'eventId', label: '事件 ID', required: true },
  { key: 'orderId', label: '订单 ID', required: true },
  { key: 'eventType', label: '事件类型', required: true },
  { key: 'instrument', label: '证券/合约', required: true },
  { key: 'side', label: '买卖方向', required: true },
  { key: 'eventAt', label: '事件时间', required: true },
  { key: 'parentOrderId', label: '父订单 ID', required: false },
  { key: 'assetClass', label: '资产类别', required: false },
  { key: 'orderQty', label: '订单数量', required: false },
  { key: 'eventQty', label: '事件数量', required: false },
  { key: 'limitPrice', label: '限价', required: false },
  { key: 'executionPrice', label: '执行价格', required: false },
  { key: 'venue', label: '场所', required: false },
  { key: 'broker', label: '经纪商', required: false },
] as const;

export type OrderEventFieldKey = (typeof ORDER_EVENT_FIELD_DEFINITIONS)[number]['key'];
export type OrderEventMapping = Record<OrderEventFieldKey, string | null>;
export type RawOrderEventRecord = Record<string, unknown>;
export type ValidatedOrderEvent = { eventId: string; orderId: string; parentOrderId?: string | null; eventType: 'new' | 'route' | 'modify' | 'cancel' | 'partial_fill' | 'fill' | 'reject'; instrument: string; assetClass?: string | null; side: 'buy' | 'sell'; orderQty?: number | null; eventQty?: number | null; limitPrice?: number | null; executionPrice?: number | null; venue?: string | null; broker?: string | null; eventAt: Date };

const eventTypes = new Set(['new', 'route', 'modify', 'cancel', 'partial_fill', 'fill', 'reject']);
const sides = new Set(['buy', 'sell']);
const canonical = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const cleanText = (value: unknown) => String(value ?? '').trim();
const optionalText = (value: unknown) => cleanText(value) || null;
const optionalNumber = (value: unknown) => { const raw = cleanText(value); if (!raw) return null; const parsed = Number(raw); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; };

export function extractOrderEventRows(payload: unknown): RawOrderEventRecord[] {
  const rows = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && Array.isArray((payload as { events?: unknown[] }).events) ? (payload as { events: unknown[] }).events : null;
  if (!rows?.length || rows.length > 1000 || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('JSON 必须是 1–1000 条对象记录的数组，或包含 events 数组的对象。');
  return rows as RawOrderEventRecord[];
}

export function createDefaultOrderEventMapping(rows: RawOrderEventRecord[]): OrderEventMapping {
  const available = Object.keys(rows[0] ?? {}); const normalized = new Map(available.map((key) => [canonical(key), key]));
  return Object.fromEntries(ORDER_EVENT_FIELD_DEFINITIONS.map(({ key }) => [key, normalized.get(canonical(key)) ?? null])) as OrderEventMapping;
}

export function listOrderEventSourceFields(rows: RawOrderEventRecord[]) { return [...new Set(rows.flatMap((row) => Object.keys(row)))].sort((left, right) => left.localeCompare(right)); }

export function previewMappedOrderEvents(rows: RawOrderEventRecord[], mapping: OrderEventMapping) {
  const errors: string[] = []; const events: ValidatedOrderEvent[] = []; const seenEventIds = new Set<string>();
  const read = (row: RawOrderEventRecord, key: OrderEventFieldKey) => { const source = mapping[key]; return source ? row[source] : undefined; };
  ORDER_EVENT_FIELD_DEFINITIONS.filter((field) => field.required && !mapping[field.key]).forEach((field) => errors.push(`未映射必填字段「${field.label}」。`));
  rows.forEach((row, index) => {
    const eventId = cleanText(read(row, 'eventId')); const orderId = cleanText(read(row, 'orderId')); const instrument = cleanText(read(row, 'instrument')); const eventType = canonical(read(row, 'eventType')); const side = canonical(read(row, 'side')); const eventAt = new Date(cleanText(read(row, 'eventAt'))); const prefix = `第 ${index + 1} 条`;
    const rowErrors: string[] = [];
    if (!eventId) rowErrors.push('缺少事件 ID'); else if (seenEventIds.has(eventId)) rowErrors.push(`事件 ID「${eventId}」重复`); else seenEventIds.add(eventId);
    if (!orderId) rowErrors.push('缺少订单 ID'); if (!instrument) rowErrors.push('缺少证券/合约'); if (!eventTypes.has(eventType)) rowErrors.push('事件类型无效'); if (!sides.has(side)) rowErrors.push('买卖方向必须为 buy 或 sell'); if (Number.isNaN(eventAt.getTime())) rowErrors.push('事件时间无效');
    const orderQty = optionalNumber(read(row, 'orderQty')); const eventQty = optionalNumber(read(row, 'eventQty')); const limitPrice = optionalNumber(read(row, 'limitPrice')); const executionPrice = optionalNumber(read(row, 'executionPrice'));
    if (orderQty === undefined) rowErrors.push('订单数量必须为非负数'); if (eventQty === undefined) rowErrors.push('事件数量必须为非负数'); if (limitPrice === undefined) rowErrors.push('限价必须为非负数'); if (executionPrice === undefined) rowErrors.push('执行价格必须为非负数');
    if (rowErrors.length) { errors.push(`${prefix}${rowErrors.join('；')}。`); return; }
    events.push({ eventId, orderId, parentOrderId: optionalText(read(row, 'parentOrderId')), eventType: eventType as ValidatedOrderEvent['eventType'], instrument, assetClass: optionalText(read(row, 'assetClass')), side: side as 'buy' | 'sell', orderQty, eventQty, limitPrice, executionPrice, venue: optionalText(read(row, 'venue')), broker: optionalText(read(row, 'broker')), eventAt });
  });
  return { events, errors: [...new Set(errors)], validCount: events.length, invalidCount: rows.length - events.length, canImport: errors.length === 0 && events.length > 0 };
}

export const ORDER_EVENT_JSON_TEMPLATE = { schema: 'finance-hub/order-management-event/v1', requiredFields: ORDER_EVENT_FIELD_DEFINITIONS.filter((field) => field.required).map((field) => field.key), optionalFields: ORDER_EVENT_FIELD_DEFINITIONS.filter((field) => !field.required).map((field) => field.key), events: [] };
