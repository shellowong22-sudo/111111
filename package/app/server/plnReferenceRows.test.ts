import { describe, expect, it } from 'vitest';
import { derivePlnCrossHistory, derivePlnCrossRate, parsePlnReferenceDatasets } from '../client/src/lib/plnReferenceRows';

describe('FXC PLN reference archive mapping', () => {
  it('keeps one observed pair per day, with no unrelated or unit-mismatched rows', () => {
    const rows = parsePlnReferenceDatasets([
      { dataset: { label: '美元兑兹罗提日频参考汇率', rows: [
        { date: '2026-09-28', symbol: 'USD/PLN', value: 3.8478, 单位: 'PLN/USD' },
      ] } },
      { dataset: { label: '多币种兑兹罗提日频参考汇率', rows: [
        { date: '2026-09-25', symbol: 'EUR/PLN', value: 4.31, 单位: 'PLN/EUR' },
        { date: '2026-09-28', symbol: 'EUR/PLN', value: 4.3769, 单位: 'PLN/EUR' },
        { date: '2026-09-28', symbol: 'EUR/PLN', value: 4.3769, 单位: 'PLN/EUR' },
        { date: '2026-09-28', symbol: 'JPY/PLN', value: 0.024523, 单位: 'PLN/USD' },
      ] } },
      { dataset: { label: '其他功能数据', rows: [
        { date: '2026-09-28', symbol: 'CHF/PLN', value: 4.6, 单位: 'PLN/CHF' },
      ] } },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ pair: 'USD/PLN', date: '2026-09-28', value: 3.8478 });
    expect(rows[1]).toMatchObject({ pair: 'EUR/PLN', date: '2026-09-28', value: 4.3769, unit: 'PLN/EUR' });
    expect(rows[1].history).toEqual([
      { date: '2026-09-25', value: 4.31 },
      { date: '2026-09-28', value: 4.3769 },
    ]);
  });
  it('derives only same-day reference crosses and keeps missing or stale legs empty', () => {
    const pairs = parsePlnReferenceDatasets([
      { dataset: { label: '美元兑兹罗提日频参考汇率', rows: [
        { date: '2026-09-28', symbol: 'USD/PLN', value: 4, 单位: 'PLN/USD' },
      ] } },
      { dataset: { label: '多币种兑兹罗提日频参考汇率', rows: [
        { date: '2026-09-28', symbol: 'EUR/PLN', value: 5, 单位: 'PLN/EUR' },
        { date: '2026-09-25', symbol: 'JPY/PLN', value: 0.03, 单位: 'PLN/JPY' },
      ] } },
    ]);
    expect(derivePlnCrossRate(pairs, 'EUR', 'USD')).toBe(1.25);
    expect(derivePlnCrossRate(pairs, 'USD', 'PLN')).toBe(4);
    expect(derivePlnCrossRate(pairs, 'PLN', 'EUR')).toBe(0.2);
    expect(derivePlnCrossRate(pairs, 'USD', 'JPY')).toBeNull();
    expect(derivePlnCrossRate(pairs, 'GBP', 'PLN')).toBeNull();
  });
  it('plots only shared observed days in the existing FXC detail, including inverse PLN pairs', () => {
    const pairs = parsePlnReferenceDatasets([
      { dataset: { label: '美元兑兹罗提日频参考汇率', rows: [
        { date: '2026-09-25', symbol: 'USD/PLN', value: 4, 单位: 'PLN/USD' },
        { date: '2026-09-28', symbol: 'USD/PLN', value: 3.8, 单位: 'PLN/USD' },
      ] } },
      { dataset: { label: '多币种兑兹罗提日频参考汇率', rows: [
        { date: '2026-09-24', symbol: 'EUR/PLN', value: 4.2, 单位: 'PLN/EUR' },
        { date: '2026-09-28', symbol: 'EUR/PLN', value: 4.56, 单位: 'PLN/EUR' },
      ] } },
    ]);
    expect(derivePlnCrossHistory(pairs, 'EUR', 'USD')).toEqual([{ date: '2026-09-28', value: 1.2 }]);
    expect(derivePlnCrossHistory(pairs, 'PLN', 'USD')).toEqual([
      { date: '2026-09-25', value: 0.25 },
      { date: '2026-09-28', value: 1 / 3.8 },
    ]);
    expect(derivePlnCrossHistory(pairs, 'USD', 'GBP')).toEqual([]);
  });
});
