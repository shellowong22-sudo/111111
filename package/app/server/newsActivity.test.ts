import { describe, expect, it } from 'vitest';
import { buildNewsActivity } from '../shared/newsActivity';
describe('actual publication activity', () => {
  it('counts observations in UTC and excludes invalid, future and previous-day rows', () => {
    const at = Date.parse('2026-09-19T12:00:30Z');
    const rows = ['2026-09-19T12:00:00Z','2026-09-19T12:00:20Z','2026-09-19T11:59:00Z','2026-09-19T03:00:00Z','2026-09-18T12:00:00Z','2026-09-19T13:00:00Z','invalid',null].map(publishedAt => ({ publishedAt }));
    const result = buildNewsActivity(rows, at);
    expect(result.today).toBe(4);
    expect(result.peak).toBe(2);
    expect(result.minutes.at(-1)?.count).toBe(2);
    expect(result.minutes.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    expect(result.hourly.reduce((sum, row) => sum + row.count, 0)).toBe(4);
  });
  it('does not invent activity without observations', () => {
    const result = buildNewsActivity([], Date.parse('2026-09-19T00:00:00Z'));
    expect(result.today).toBe(0);
    expect(result.peak).toBe(0);
    expect(result.minutes.every(row => row.count === 0)).toBe(true);
  });
});
