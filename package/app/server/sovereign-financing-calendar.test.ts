import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const issuanceSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/IssuancePanel.tsx'), 'utf8');
const calendarSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/SovereignFinancingCalendar.tsx'), 'utf8');
const dataServiceSource = readFileSync(resolve(import.meta.dirname, '../server/realDataService.ts'), 'utf8');

describe('国家级财政融资日历', () => {
  it('在新发行主面板提供融资日历入口与可操作筛选', () => {
    expect(issuanceSource).toContain('{ id: "financing-calendar", label: "融资日历" }');
    expect(issuanceSource).toContain('getOfficialFinancingCalendar.useQuery(');
    expect(calendarSource).toContain('setCountryCodes');
    expect(calendarSource).toContain('setFrom');
    expect(calendarSource).toContain('setTo');
    expect(calendarSource).toContain('setBondType');
    expect(calendarSource).toContain('setIsinQuery');
    expect(calendarSource).toContain('future30Only');
    expect(calendarSource).toContain('未来 30 天');
    expect(calendarSource).toContain('ISIN');
    expect(calendarSource).toContain('copyIsin');
    expect(calendarSource).toContain('document.execCommand("copy")');
    expect(calendarSource).toContain('officialSecurityHref');
    expect(calendarSource).toContain('打开英国 DMO 官方证券资料');
    expect(calendarSource).toContain('重置');
  });

  it('接入英国 DMO、意大利 MEF 与法国 AFT 的官方日历，并对其他来源保持真实状态', () => {
    expect(dataServiceSource).toContain('fetchGermanFederalIssuanceCalendar');
    expect(dataServiceSource).toContain("countryCode: 'US'");
    expect(dataServiceSource).toContain("countryCode: 'DE'");
    expect(dataServiceSource).toContain("countryCode: 'GB'");
    expect(dataServiceSource).toContain("countryCode: 'JP'");
    expect(dataServiceSource).toContain("countryCode: 'FR'");
    expect(dataServiceSource).toContain("countryCode: 'IT'");
    expect(dataServiceSource).toContain("countryCode: 'EU'");
    expect(dataServiceSource).toContain('fetchJapanMofWeeklyJgbEvents');
    expect(dataServiceSource).toContain('fetchItalyMefAuctions');
    expect(dataServiceSource).toContain('parseItalyMefBotCalendar');
    expect(dataServiceSource).toContain('fetchUkDmoGiltAuctions');
    expect(dataServiceSource).toContain('parseUkDmoIssuanceCalendar');
    expect(dataServiceSource).toContain('UK_DMO_D5D_REPORT_URL');
    expect(dataServiceSource).toContain("eventType: 'auction'");
    expect(calendarSource).toContain('不以规律或推测填充');
    expect(calendarSource).toContain('仅包含已读取的一级市场官方事件与来源链接');
  });

  it('提供按事件类型的账户提醒规则和可订阅 WebCal 链接', () => {
    expect(calendarSource).toContain('FinancingReminderSettings');
    expect(calendarSource).toContain('saveFinancingCalendarReminderRule');
    expect(calendarSource).toContain('提前天数');
    expect(calendarSource).toContain('webcal://');
    expect(calendarSource).toContain('订阅 WebCal');
    expect(calendarSource).toContain('复制链接');
    expect(calendarSource).toContain('setFinancingCalendarReminderRuleActive');
    expect(calendarSource).toContain('历史发送记录');
    expect(calendarSource).toContain('暂停');
    expect(calendarSource).toContain('恢复');
    expect(calendarSource).toContain('导出 CSV');
    expect(calendarSource).toContain('exportHistoryCsv');
  });
});
