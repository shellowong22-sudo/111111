import { describe, expect, it } from 'vitest';
import { parseOfficialRateDecision } from './forexCentralBankArchiveDb';

describe('forex official central-bank archive parser', () => {
  it('parses an official FOMC target range and vote without inventing a rate change', () => {
    const result = parseOfficialRateDecision('July 29, 2026 Federal Reserve issues FOMC statement The Committee approved the following statement for release by a 9 – 3 vote: The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent. Three members preferred to raise the target range.', { centralBankId: 'FED', centralBankName: '美联储 FOMC', currency: 'USD', sourceUrl: 'https://www.federalreserve.gov/example' });
    expect(result).toMatchObject({ decisionDate: '2026-07-29', decision: 'hold', voteSummary: '9–3', policyRates: [{ minRatePct: 3.5, maxRatePct: 3.75 }] });
    expect(result?.changeBps).toBeNull();
  });

  it('parses an official ECB rate increase, the three rate fields and its effective date', () => {
    const result = parseOfficialRateDecision('11 June 2026 The Governing Council today decided to raise the three key ECB interest rates by 25 basis points. The interest rates on the deposit facility, the main refinancing operations and the marginal lending facility will be increased to 2.25%, 2.40% and 2.65% respectively, with effect from 17 June 2026.', { centralBankId: 'ECB', centralBankName: '欧洲央行', currency: 'EUR', sourceUrl: 'https://www.ecb.europa.eu/example' });
    expect(result).toMatchObject({ decisionDate: '2026-06-11', decision: 'raise', changeBps: 25, effectiveDate: '2026-06-17' });
    expect(result?.policyRates.map((rate) => rate.ratePct)).toEqual([2.25, 2.4, 2.65]);
  });

  it('parses an official Bank Rate hold and vote, but preserves true empty state for non-decision text', () => {
    const source = { centralBankId: 'BOE' as const, centralBankName: '英格兰银行 MPC', currency: 'GBP' as const, sourceUrl: 'https://www.bankofengland.co.uk/example' };
    const result = parseOfficialRateDecision('At its meeting ending on 17 June 2026, the Monetary Policy Committee voted by a majority of 7&ndash;2 to maintain Bank Rate at 3.75%. Two members preferred to increase Bank Rate by 0.25 percentage points.', source);
    expect(result).toMatchObject({ decisionDate: '2026-06-17', decision: 'hold', voteSummary: '7–2', policyRates: [{ ratePct: 3.75 }] });
    expect(parseOfficialRateDecision('Official communications page with no rate decision fields.', source)).toBeNull();
  });

  it('parses an official Bank of Japan policy guideline and Policy Board vote', () => {
    const result = parseOfficialRateDecision('July 31, 2026 Bank of Japan Statement on Monetary Policy. At the Monetary Policy Meeting held today, the Policy Board of the Bank of Japan decided, by an 8-1 majority vote, to set the following guideline. The Bank will encourage the uncollateralized overnight call rate to remain at around 1.0 percent.', { centralBankId: 'BOJ', centralBankName: '日本银行', currency: 'JPY', decisionDate: '2026-07-31', sourceUrl: 'https://www.boj.or.jp/example.pdf', format: 'pdf' });
    expect(result).toMatchObject({ decisionDate: '2026-07-31', decision: 'hold', voteSummary: '8–1', policyRates: [{ key: 'overnight_call_rate', ratePct: 1 }] });
  });

  it('parses official SNB and BOC hold decisions without inventing undisclosed votes', () => {
    const snb = parseOfficialRateDecision('Monetary policy assessment of 18 June 2026. The Swiss National Bank is leaving the SNB policy rate unchanged at 0%.', { centralBankId: 'SNB', centralBankName: '瑞士国家银行', currency: 'CHF', decisionDate: '2026-06-18', sourceUrl: 'https://www.snb.ch/example' });
    const boc = parseOfficialRateDecision('July 15, 2026. The Bank of Canada today held its target for the overnight rate at 2.25%, with the Bank Rate at 2.5% and the deposit rate at 2.20%.', { centralBankId: 'BOC', centralBankName: '加拿大银行', currency: 'CAD', decisionDate: '2026-07-15', sourceUrl: 'https://www.bankofcanada.ca/example' });
    expect(snb).toMatchObject({ decision: 'hold', voteSummary: null, policyRates: [{ key: 'snb_policy_rate', ratePct: 0 }] });
    expect(boc).toMatchObject({ decision: 'hold', voteSummary: null });
    expect(boc?.policyRates.map((rate) => rate.ratePct)).toEqual([2.25, 2.5, 2.2]);
  });

  it('parses RBA unanimous cash-rate holds and RBNZ OCR hold and increase decisions', () => {
    const rba = parseOfficialRateDecision('11 August 2026. At its meeting today, the Board decided to leave the cash rate target unchanged at 4.35 per cent. Today’s policy decision was unanimous.', { centralBankId: 'RBA', centralBankName: '澳洲联储', currency: 'AUD', decisionDate: '2026-08-11', sourceUrl: 'https://www.rba.gov.au/example' });
    const rbnzHold = parseOfficialRateDecision('On Wednesday 27 May, the Monetary Policy Committee agreed to hold the Official Cash Rate at 2.25%.', { centralBankId: 'RBNZ', centralBankName: '新西兰联储', currency: 'NZD', decisionDate: '2026-05-27', sourceUrl: 'https://www.rbnz.govt.nz/example' });
    const rbnzRaise = parseOfficialRateDecision('The Monetary Policy Committee today reached consensus to increase the OCR by 25 basis points to 2.50 percent.', { centralBankId: 'RBNZ', centralBankName: '新西兰联储', currency: 'NZD', decisionDate: '2026-07-08', sourceUrl: 'https://www.rbnz.govt.nz/example-raise' });
    expect(rba).toMatchObject({ decision: 'hold', voteSummary: '一致通过', policyRates: [{ key: 'cash_rate_target', ratePct: 4.35 }] });
    expect(rbnzHold).toMatchObject({ decision: 'hold', voteSummary: null, policyRates: [{ key: 'official_cash_rate', ratePct: 2.25 }] });
    expect(rbnzRaise).toMatchObject({ decision: 'raise', changeBps: 25, voteSummary: '共识', policyRates: [{ key: 'official_cash_rate', ratePct: 2.5 }] });
  });
});
