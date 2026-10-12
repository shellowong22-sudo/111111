import { describe, expect, it } from 'vitest';
import { discoverFedReport, parseFedFinancialPages } from './fedFinancialStatements';

// Relevant rows transcribed from the published 2025 consolidated statement, PDF pp. 7 and 62.
const operations = `Combined Statements of Operations for the years ended December 31, 2025 and December 31, 2024
(in millions)
2025 2024
Treasury securities, net 106,560 100,518
Federal agency and government-sponsored enterprise mortgage-backed securities, net 48,029 52,648
Total interest income $ 155,299 $ 158,756
Securities sold under agreements to repurchase $ 19,719 $ 40,288
Depository institutions and others 147,662 186,478
Total interest expense $ 167,381 $ 226,766
Net interest expense $ (12,082) $ (68,010)
Total other items of income $ 3,135 $ 298
Total operating expenses $ 9,800 $ 9,894
Reserve Bank net loss from operations (18,747) (77,606)
Net income after providing for remittances to the Treasury 2,484 1,483`;
const distribution = `(in millions)
2025 2024
Remittances transferred to the Treasury 1 6,281 3,533
Deferred asset increase (27,526) (82,637)
Earnings remittances to the Treasury, net (21,245) (79,104)`;
const pages = [{ num: 7, text: operations }, { num: 62, text: distribution }];

describe('annual Fed statement cleaning', () => {
  it('keeps real transfers distinct from negative accrual remittances and preserves loss signs', () => {
    const result = parseFedFinancialPages(pages, 2025);
    expect(result.rows[0]).toMatchObject({year:2025,netInterest:-12082,remittances:6281,remittanceAccrual:-21245,deferredAssetChange:-27526});
    expect(result.rows[1]).toMatchObject({year:2024,netInterest:-68010,remittances:3533});
    expect(result.pages).toEqual({operations:7,distribution:62});
  });
  it('rejects swapped units, mismatched years and missing tables', () => {
    expect(()=>parseFedFinancialPages([{...pages[0],text:operations.replace('(in millions)','(in billions)')},pages[1]],2025)).toThrow('UNITS_MISMATCH');
    expect(()=>parseFedFinancialPages(pages,2024)).toThrow('YEAR_MISMATCH');
    expect(()=>parseFedFinancialPages([pages[0]],2025)).toThrow('REQUIRED_TABLE_MISSING');
  });
  it('rejects misparsed signs or contradictory accounting totals instead of publishing success', () => {
    expect(()=>parseFedFinancialPages([{...pages[0],text:operations.replace('(12,082)','12,082')},pages[1]],2025)).toThrow('RECONCILIATION_FAILED');
    expect(()=>parseFedFinancialPages([pages[0],{...pages[1],text:distribution.replace('6,281','26,281')}],2025)).toThrow('RECONCILIATION_FAILED');
    expect(()=>parseFedFinancialPages([{...pages[0],text:operations+'\nTotal interest income 155,299 158,756'},pages[1]],2025)).toThrow('FIELD_AMBIGUOUS');
  });
  it('discovers the latest same-origin report without accepting third-party links', () => {
    expect(discoverFedReport('<a href="/aboutthefed/files/combinedfinstmt2024.pdf"><a href="https://evil.example/combinedfinstmt2029.pdf"><a href="/aboutthefed/files/combinedfinstmt2025.pdf">')).toEqual({year:2025,url:'https://www.federalreserve.gov/aboutthefed/files/combinedfinstmt2025.pdf'});
    expect(()=>discoverFedReport('<a href="https://evil.example/combinedfinstmt2025.pdf">')).toThrow('LINK_NOT_FOUND');
  });
});
