import { describe, expect, it } from 'vitest';
import { isFinancingCalendarReminderDue } from './db';

describe('融资日历提醒窗口', () => {
  it('在事件日前配置的提前天数窗口内触发', () => {
    expect(isFinancingCalendarReminderDue('2026-08-20', 3, new Date('2026-08-17T00:00:00.000Z'))).toBe(true);
    expect(isFinancingCalendarReminderDue('2026-08-20', 3, new Date('2026-08-19T23:59:59.000Z'))).toBe(true);
  });

  it('在窗口开始前、事件日及之后不触发', () => {
    expect(isFinancingCalendarReminderDue('2026-08-20', 3, new Date('2026-08-16T23:59:59.000Z'))).toBe(false);
    expect(isFinancingCalendarReminderDue('2026-08-20', 3, new Date('2026-08-20T00:00:00.000Z'))).toBe(false);
    expect(isFinancingCalendarReminderDue('2026-08-20', 3, new Date('2026-08-21T00:00:00.000Z'))).toBe(false);
  });

  it('拒绝非法事件日期与非正提前天数', () => {
    expect(isFinancingCalendarReminderDue('invalid', 3, new Date('2026-08-17T00:00:00.000Z'))).toBe(false);
    expect(isFinancingCalendarReminderDue('2026-08-20', 0, new Date('2026-08-17T00:00:00.000Z'))).toBe(false);
  });
});
