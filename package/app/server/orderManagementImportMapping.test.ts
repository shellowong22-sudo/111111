import { describe, expect, it } from 'vitest';
import { buildOrderManagementBatchComparison } from './orderManagementResearchDb';
import { createDefaultOrderEventMapping, extractOrderEventRows, previewMappedOrderEvents } from '../shared/orderManagementImportMapping';

describe('交易委托 JSON 模板校验与批次对比', () => {
  it('detects missing required fields, invalid enums and duplicate event IDs before import', () => {
    const rows = extractOrderEventRows([
      { eventId: 'E-1', orderId: 'O-1', eventType: 'new', instrument: 'ABC', side: 'buy', eventAt: '2026-08-22T09:00:00.000Z', orderQty: 100 },
      { eventId: 'E-1', orderId: 'O-2', eventType: 'not-an-event', instrument: 'XYZ', side: 'hold', eventAt: 'bad-time' },
    ]);
    const preview = previewMappedOrderEvents(rows, createDefaultOrderEventMapping(rows));
    expect(preview.canImport).toBe(false);
    expect(preview.validCount).toBe(1);
    expect(preview.errors.join(' ')).toContain('重复');
    expect(preview.errors.join(' ')).toContain('事件类型无效');
    expect(preview.errors.join(' ')).toContain('买卖方向必须为 buy 或 sell');
  });

  it('supports supplier-specific column mapping without persisting the original JSON', () => {
    const rows = extractOrderEventRows([{ event_key: 'A-1', parent_id: 'P-1', status: 'FILL', symbol: 'BOND-A', direction: 'SELL', occurred_at: '2026-08-22T10:00:00.000Z', quantity: '50', exec_px: '99.25' }]);
    const mapping = { eventId: 'event_key', orderId: 'parent_id', parentOrderId: null, eventType: 'status', instrument: 'symbol', assetClass: null, side: 'direction', orderQty: null, eventQty: 'quantity', limitPrice: null, executionPrice: 'exec_px', venue: null, broker: null, eventAt: 'occurred_at' } as const;
    const preview = previewMappedOrderEvents(rows, mapping);
    expect(preview).toMatchObject({ canImport: true, validCount: 1, invalidCount: 0 });
    expect(preview.events[0]).toMatchObject({ eventId: 'A-1', orderId: 'P-1', eventType: 'fill', side: 'sell', eventQty: 50, executionPrice: 99.25 });
  });

  it('compares only chronologically ordered imported batches and leaves unavailable deltas blank', () => {
    const result = buildOrderManagementBatchComparison([
      { batchId: 2, name: 'Later', sourceLabel: 'OMS', asOfAt: new Date('2026-08-22T12:00:00Z'), recordCount: 4, eventCount: 4, orderCount: 2, fillRatioPct: 75, averageLifecycleMs: 90_000 },
      { batchId: 1, name: 'Earlier', sourceLabel: 'OMS', asOfAt: new Date('2026-08-21T12:00:00Z'), recordCount: 2, eventCount: 2, orderCount: 1, fillRatioPct: 50, averageLifecycleMs: null },
    ]);
    expect(result[0]).toMatchObject({ name: 'Earlier', previousBatchName: null, fillRatioDeltaPpt: null, lifecycleDeltaMs: null });
    expect(result[1]).toMatchObject({ name: 'Later', previousBatchName: 'Earlier', fillRatioDeltaPpt: 25, lifecycleDeltaMs: null });
  });
});
