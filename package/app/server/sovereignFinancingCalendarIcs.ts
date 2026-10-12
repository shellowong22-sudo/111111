import type { OfficialFinancingCalendarRecord } from './realDataService';

function escapeIcs(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n');
}

function allDayDate(value: string) {
  return value.replaceAll('-', '');
}

export function renderSovereignFinancingCalendarIcs(records: OfficialFinancingCalendarRecord[]) {
  const events = records.map((record) => {
    const date = allDayDate(record.auctionDate);
    const eventType = record.eventType === 'announcement' ? '发行公告' : record.eventType === 'settlement' ? '交收' : '拍卖';
    const title = `${record.country} · ${eventType} · ${record.securityType}`;
    const isin = record.isin ? `｜ISIN：${record.isin}` : '';
    const cusip = record.cusip ? `｜CUSIP：${record.cusip}` : '';
    const settlement = record.issueDate ? `｜交收：${record.issueDate}` : '';
    const maturity = record.maturityDate ? `｜到期：${record.maturityDate}` : '';
    const description = `${record.sourceLabel}｜${eventType}｜${record.securityTerm ?? '期限待披露'}${cusip}${isin}${settlement}${maturity}｜规模：${record.offeringAmount ?? '待披露'} ${record.currency}｜一级市场官方融资事件，不代表二级市场可成交报价。`;
    return ['BEGIN:VEVENT', `UID:${escapeIcs(record.id)}@finance-hub`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART;VALUE=DATE:${date}`, `SUMMARY:${escapeIcs(title)}`, `DESCRIPTION:${escapeIcs(description)}`, `URL:${escapeIcs(record.sourceUrl)}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Finance Hub//Official Sovereign Financing Calendar//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:主权债官方融资日历', ...events, 'END:VCALENDAR', ''].join('\r\n');
}
