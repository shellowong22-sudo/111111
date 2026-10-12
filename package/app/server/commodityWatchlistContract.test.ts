import { describe, expect, it } from 'vitest';
import { compareCommodityWatchSnapshots } from './commodityResearchDb';

describe('commodity watchlist change contract', () => {
  it('only reports a new official observation when the configured absolute movement threshold is met', () => {
    const previous = [{ id: 'WCESTUS1', label: '库存', status: 'available' as const, observationDate: '2026-08-07', latest: 420000 }];
    const current = [{ id: 'WCESTUS1', label: '库存', status: 'available' as const, observationDate: '2026-08-14', latest: 428400 }];
    expect(compareCommodityWatchSnapshots(previous, current, 3)).toHaveLength(0);
    expect(compareCommodityWatchSnapshots(previous, current, 1)).toEqual([expect.objectContaining({ id: 'WCESTUS1', previousDate: '2026-08-07', currentDate: '2026-08-14', changePercent: 2 })]);
  });

  it('reports an availability state change without inventing a replacement value', () => {
    const previous = [{ id: 'WPULEUS3', label: '利用率', status: 'available' as const, observationDate: '2026-08-14', latest: 97.2 }];
    const current = [{ id: 'WPULEUS3', label: '利用率', status: 'unavailable' as const, observationDate: null, latest: null }];
    expect(compareCommodityWatchSnapshots(previous, current, 100)).toEqual([expect.objectContaining({ id: 'WPULEUS3', currentDate: null, currentValue: null })]);
  });
});
