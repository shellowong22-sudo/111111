import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseFranceAftIssuanceAnnouncement, parseItalyMefBotCalendar, parseUkDmoAuctionNotice, parseUkDmoGiltsInIssue, parseUkDmoIssuanceCalendar } from './realDataService';

describe('意大利 MEF 官方融资日历解析', () => {
  it('仅将官方 BOT 年度 PDF 中明确披露的公告、拍卖和交收日转为融资事件', () => {
    const text = `MONTH AUCTION ANNOUNCEMENT DATE SUBSCRIPTION DEADLINE AUCTION DATE SETTLEMENT MATURITY N. DAYS
      half month 12 month BOTs Wednesday, January 7, 2026 Thursday, January 8, 2026 Friday, January 9, 2026 Wednesday, January 14, 2026 Thursday, January 14, 2027 365`;
    const records = parseItalyMefBotCalendar(text, 'https://official.example/Calendar-BOT-2026-ENG.pdf');

    expect(records).toHaveLength(3);
    expect(records.map((record) => [record.eventType, record.auctionDate])).toEqual([
      ['announcement', '2026-01-07'],
      ['auction', '2026-01-09'],
      ['settlement', '2026-01-14'],
    ]);
    expect(records.every((record) => record.countryCode === 'IT' && record.currency === 'EUR')).toBe(true);
    expect(records[1]).toMatchObject({ securityType: '12 month BOTs', securityTerm: '12 month', issueDate: '2026-01-14', maturityDate: '2027-01-14', offeringAmount: null });
  });

  it('忽略没有完整明示日期链的文本，不按发行规律填补事件', () => {
    expect(parseItalyMefBotCalendar('end of month t.b.d. Friday, January 23, 2026')).toEqual([]);
  });
});

describe('法国 AFT 官方发行公告解析', () => {
  it('从明确披露的 OAT 公告中读取公告、拍卖与交收日，不把规模区间伪造成实际发行规模', () => {
    const text = `# 14 August 2026: AFT’s next issuance of medium-term OATs: Thursday 20 August 2026
      | Auction date | 20/08/2026 |
      | Settlement date | 24/08/2026 |
      | Volume announced* | < 10,500 -- 12,500 > |`;
    const records = parseFranceAftIssuanceAnnouncement(text, 'https://www.aft.gouv.fr/en/publications/communiques-presse/14-august-2026-next-issuance-oats');

    expect(records.map((record) => [record.eventType, record.auctionDate])).toEqual([
      ['announcement', '2026-08-14'],
      ['auction', '2026-08-20'],
      ['settlement', '2026-08-24'],
    ]);
    expect(records.every((record) => record.countryCode === 'FR' && record.currency === 'EUR' && record.offeringAmount === null)).toBe(true);
    expect(records[0].securityType).toBe('OAT issuance announcement');
  });

  it('拒绝非“next issuance”公告和未明确拍卖日期的文本', () => {
    expect(parseFranceAftIssuanceAnnouncement('# AFT’s issuance: results', 'https://official.example/a')).toEqual([]);
    expect(parseFranceAftIssuanceAnnouncement('# 14 August 2026: AFT’s next issuance of OATs', 'https://official.example/b')).toEqual([]);
  });
});

describe('英国 DMO 官方 D5D 发行日历解析', () => {
  it('仅将 DMO XLS 中明确为 Outright Auction 的 gilt 记录映射为英镑拍卖事件', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Data Date: 18-Aug-2026'], [], [], [],
      ['', 'Operation Date', 'Auction Close', 'Gilt Name', 'Nominal Amount Issued  (£ million)', 'Cash Raised', 'Issuance Method'],
      ['', 46163, '10:00am', '4 7/8% Treasury Gilt 2036', 4000, 3952.5, 'Outright Auction'],
      ['', 46126, '', '4 7/8% Treasury Gilt 2036', 15000, 14929.5, 'Syndication'],
      ['', 46170, '11:30am', '1 1/8% Index-linked Treasury Gilt 2039', 1000, 633.3, 'Outright Tender'],
    ]);
    const records = parseUkDmoIssuanceCalendar({ SheetNames: ['Sheet1'], Sheets: { Sheet1: sheet } } as XLSX.WorkBook);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ countryCode: 'GB', currency: 'GBP', auctionDate: '2026-05-21', securityType: '4 7/8% Treasury Gilt 2036', offeringAmount: 4_000_000_000, eventType: 'auction' });
  });

  it('拒绝缺少 DMO 列标题或没有明确 Outright Auction 标识的表格', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Operation Date', 'Security'], [46163, 'Gilt']]);
    expect(parseUkDmoIssuanceCalendar({ SheetNames: ['Sheet1'], Sheets: { Sheet1: sheet } } as XLSX.WorkBook)).toEqual([]);
  });

  it('从 D1A 官方 Gilts in Issue 报告读取与证券名称对应的赎回到期日', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['GILT MARKET'], [],
      ['Conventional Gilts', 'ISIN Code', 'Redemption Date', 'First Issue Date'],
      ['4 7/8% Treasury Gilt 2036', 'GB00BWBR1N39', 49780, 46126],
    ]);
    const entries = parseUkDmoGiltsInIssue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: sheet } } as XLSX.WorkBook);
    expect([...entries.values()]).toContainEqual({ maturityDate: '2036-04-15', sourceUrl: 'https://www.dmo.gov.uk/data/pdfdatareport?reportCode=D1A', isin: 'GB00BWBR1N39' });
  });

  it('仅在官方 auction notice 同时明示拍卖与交收日期时读取交收日', () => {
    const notice = `Auction of £4,000 million of 4 7/8% Treasury Gilt 2036 (ISIN Code: GB00BWBR1N39)
      Auction Date Tuesday, 18 August 2026
      Issue and Settlement Date Wednesday, 19 August 2026`;
    expect(parseUkDmoAuctionNotice(notice, 'https://www.dmo.gov.uk/media/example/notice.pdf')).toMatchObject({ securityType: '4 7/8% Treasury Gilt 2036', isin: 'GB00BWBR1N39', auctionDate: '2026-08-18', settlementDate: '2026-08-19' });
    expect(parseUkDmoAuctionNotice('Auction of £4,000 million of 4 7/8% Treasury Gilt 2036', 'https://official.example')).toBeNull();
  });
});
