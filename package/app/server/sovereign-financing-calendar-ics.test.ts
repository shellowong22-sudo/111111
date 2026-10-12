import { describe, expect, it } from 'vitest';
import { renderSovereignFinancingCalendarIcs } from './sovereignFinancingCalendarIcs';

describe('主权债融资日历 ICS 导出', () => {
  it('将已读取的官方一级市场事件、来源和边界说明编码为可订阅日历', () => {
    const ics = renderSovereignFinancingCalendarIcs([{
      id: 'DE-2026-08-19-Bund-0', countryCode: 'DE', country: '德国', currency: 'EUR', auctionDate: '2026-08-19', eventType: 'auction',
      securityType: 'Bund', securityTerm: '10-year', issueDate: '2026-08-19', maturityDate: '2036-08-15', offeringAmount: 6_000_000_000, couponRate: 3, isin: 'DE0001102598',
      sourceLabel: 'Deutsche Finanzagentur', sourceUrl: 'https://example.test/official',
    }]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260819');
    expect(ics).toContain('SUMMARY:德国 · 拍卖 · Bund');
    expect(ics).toContain('DESCRIPTION:Deutsche Finanzagentur｜拍卖｜10-year');
    expect(ics).toContain('ISIN：DE0001102598');
    expect(ics).toContain('交收：2026-08-19');
    expect(ics).toContain('到期：2036-08-15');
    expect(ics).toContain('URL:https://example.test/official');
    expect(ics).toContain('一级市场官方融资事件');
    expect(ics).not.toContain('bid/ask');
  });
});
