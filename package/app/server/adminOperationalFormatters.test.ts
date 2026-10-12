import { describe, expect, it } from 'vitest';
import { formatOperationalMetricNumber } from '../client/src/components/admin/adminOperationalFormatters';

describe('管理员运营图表数值格式化', () => {
  it('格式化有限数值，同时不把未知聚合字段伪装成零或数值', () => {
    expect(formatOperationalMetricNumber(1234567)).toBe('1,234,567');
    expect(formatOperationalMetricNumber(0)).toBe('0');
    expect(formatOperationalMetricNumber(undefined)).toBe('—');
    expect(formatOperationalMetricNumber({})).toBe('—');
    expect(formatOperationalMetricNumber(Number.NaN)).toBe('—');
  });
});
