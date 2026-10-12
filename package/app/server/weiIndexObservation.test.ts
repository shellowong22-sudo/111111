import { describe, expect, it } from 'vitest';
import { latestSnapshots, mapIndexObservations } from '../client/src/components/index-panels/WEIPanel';
import type { ModuleLiveFeedItem } from '../client/src/hooks/useModuleLiveFeed';

function dataset(
  itemKey: string,
  provider: string,
  label: string,
  rows: Array<Record<string, string | number>>,
): ModuleLiveFeedItem {
  return {
    itemKey,
    title: label,
    body: '',
    topic: 'index',
    category: 'index',
    sourceKind: 'observation',
    dataset: {
      label,
      columns: ['symbol', 'date', 'close'],
      rows,
      metadata: {
        provider,
        queriedAt: null,
        observedAt: null,
        timezone: 'UTC',
        rowCount: rows.length,
        displayedRowCount: rows.length,
        truncated: false,
        quality: 'verified',
        realtimeStatus: 'daily',
        schemaVersion: 'index-observation-v1',
        checksum: itemKey,
      },
    },
  };
}

describe('WEI index series identity', () => {
  it('does not compute a daily return by combining index variants with the same ticker', () => {
    const observations = mapIndexObservations([
      dataset('source-a', 'Provider A', '台股价格指数', [
        { symbol: 'TAIEX', date: '2026-09-30', close: 48000 },
      ]),
      dataset('source-b', 'Provider B', '台股总回报指数', [
        { symbol: 'TAIEX', date: '2026-10-01', close: 112000, change: 50, change_pct: 0.045 },
      ]),
    ]);
    const snapshots = latestSnapshots(observations);
    const snapshot = snapshots.find(row => row.name === '台股总回报指数');
    expect(snapshots).toHaveLength(2);
    expect(snapshot).toBeDefined();
    if (!snapshot) return;
    expect(snapshot.code).toBe('TAIEX');
    expect(snapshot.historyCount).toBe(1);
    expect(snapshot.provider).toBe('Provider B');
    expect(snapshot.change).toBe(50);
    expect(snapshot.changePercent).toBe(0.045);
  });

  it('does not rename every Taiwanese-labelled dataset TAIEX', () => {
    const [observation] = mapIndexObservations([
      dataset('unidentified', 'Provider C', '台湾行业股票指数', [
        { date: '2026-10-01', close: 1000 },
      ]),
    ]);
    expect(observation.code).toBe('台湾行业股票指数');
  });
});
