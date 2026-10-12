export type BondPortfolioPosition = {
  identifier: string;
  faceValue: number;
  couponRate: number;
  maturityYears: number;
  yieldToMaturity: number;
  frequency: number;
  bidAskSpreadBps?: number;
  averageDailyVolume?: number;
  liquidityScore?: number;
  lastTradeAt?: string;
};

export type BondScenarioType = 'parallel' | 'steepener' | 'butterfly';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function bondPricePer100(position: BondPortfolioPosition) {
  const periods = Math.max(1, Math.round(position.maturityYears * position.frequency));
  const periodRate = position.yieldToMaturity / 100 / position.frequency;
  const coupon = position.couponRate / 100 / position.frequency * 100;
  if (periodRate === 0) return 100 + coupon * periods;
  return coupon * (1 - Math.pow(1 + periodRate, -periods)) / periodRate + 100 / Math.pow(1 + periodRate, periods);
}

export function modifiedDuration(position: BondPortfolioPosition, price = bondPricePer100(position)) {
  const periods = Math.max(1, Math.round(position.maturityYears * position.frequency));
  const periodRate = position.yieldToMaturity / 100 / position.frequency;
  const coupon = position.couponRate / 100 / position.frequency * 100;
  let macaulayNumerator = 0;
  for (let period = 1; period <= periods; period += 1) {
    macaulayNumerator += period / position.frequency * coupon / Math.pow(1 + periodRate, period);
  }
  macaulayNumerator += periods / position.frequency * 100 / Math.pow(1 + periodRate, periods);
  const macaulay = macaulayNumerator / price;
  return macaulay / (1 + periodRate);
}

export function convexity(position: BondPortfolioPosition, price = bondPricePer100(position)) {
  const periods = Math.max(1, Math.round(position.maturityYears * position.frequency));
  const periodRate = position.yieldToMaturity / 100 / position.frequency;
  const coupon = position.couponRate / 100 / position.frequency * 100;
  let numerator = 0;
  for (let period = 1; period <= periods; period += 1) {
    numerator += period * (period + 1) * coupon / Math.pow(1 + periodRate, period + 2);
  }
  numerator += periods * (periods + 1) * 100 / Math.pow(1 + periodRate, periods + 2);
  return numerator / (price * position.frequency * position.frequency);
}

export function scenarioShiftBp(maturityYears: number, scenario: BondScenarioType, magnitudeBp: number) {
  if (scenario === 'parallel') return magnitudeBp;
  if (scenario === 'steepener') {
    // 2Y 端下移、10Y 及更长端上移；在 2Y–10Y 间线性过渡。
    const maturityWeight = clamp((maturityYears - 2) / 8, 0, 1);
    return magnitudeBp * (-1 + 2 * maturityWeight);
  }
  // 蝶式：2Y 与 10Y 翼端上移，5Y 腹部下移；用分段线性函数表达。
  if (maturityYears <= 5) return magnitudeBp * (1 - 2 * clamp((maturityYears - 2) / 3, 0, 1));
  return magnitudeBp * (-1 + 2 * clamp((maturityYears - 5) / 5, 0, 1));
}

export function analyzeBondPortfolio(positions: BondPortfolioPosition[], scenario: BondScenarioType, magnitudeBp: number) {
  const rows = positions.map((position) => {
    const pricePer100 = bondPricePer100(position);
    const marketValue = pricePer100 / 100 * position.faceValue;
    const duration = modifiedDuration(position, pricePer100);
    const bondConvexity = convexity(position, pricePer100);
    const dv01 = marketValue * duration * 0.0001;
    const appliedShiftBp = scenarioShiftBp(position.maturityYears, scenario, magnitudeBp);
    const shiftDecimal = appliedShiftBp / 10_000;
    const estimatedPnl = marketValue * (-duration * shiftDecimal + 0.5 * bondConvexity * shiftDecimal * shiftDecimal);
    return { ...position, pricePer100, marketValue, modifiedDuration: duration, convexity: bondConvexity, dv01, appliedShiftBp, estimatedPnl };
  });
  const totalMarketValue = rows.reduce((total, row) => total + row.marketValue, 0);
  const totalDv01 = rows.reduce((total, row) => total + row.dv01, 0);
  const totalPnl = rows.reduce((total, row) => total + row.estimatedPnl, 0);
  const portfolioDuration = totalMarketValue ? rows.reduce((total, row) => total + row.marketValue * row.modifiedDuration, 0) / totalMarketValue : 0;
  const portfolioConvexity = totalMarketValue ? rows.reduce((total, row) => total + row.marketValue * row.convexity, 0) / totalMarketValue : 0;
  return { rows, totalMarketValue, totalDv01, portfolioDuration, portfolioConvexity, totalPnl, scenario, magnitudeBp };
}
