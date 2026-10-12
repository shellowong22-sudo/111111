import { seriesHistory, type EconomicPoint, type EconomicSnapshot } from './economicObservations';

// Match calendar periods, never adjacent array positions: a missing release must
// remain a gap, not silently become a one-month or one-quarter growth rate.
function offset(date: string, months: number) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function lookup(points: EconomicPoint[]) { return new Map(points.map(p => [p.date, p.value])); }
function growth(value: number | undefined, base: number | undefined) {
  return value !== undefined && base !== undefined && base > 0 ? (value / base - 1) * 100 : null;
}

export function inventoryAnalytics(data?: EconomicSnapshot) {
  const ratios = seriesHistory(data, 'ISRATIO');
  const ratioMap = lookup(ratios);
  const amounts = lookup(seriesHistory(data, 'BUSINV'));
  const dates = [...new Set([...ratioMap.keys(), ...amounts.keys()])].sort();
  return dates.map(date => {
    const ratio = ratioMap.get(date), prior = ratioMap.get(offset(date, -1));
    const inventory = amounts.get(date), priorInventory = amounts.get(offset(date, -1));
    return {
      date, ratio: ratio ?? null,
      change: ratio !== undefined && prior !== undefined ? ratio - prior : null,
      inventoryBillions: inventory === undefined ? null : inventory / 1000,
      inventoryChange: inventory !== undefined && priorInventory !== undefined ? (inventory - priorInventory) / 1000 : null,
      inventoryYoy: growth(inventory, amounts.get(offset(date, -12))),
    };
  });
}

export function laborAnalytics(data?: EconomicSnapshot) {
  const vacancies = lookup(seriesHistory(data, 'JTSJOL'));
  const unemployed = lookup(seriesHistory(data, 'UNEMPLOY'));
  const rates = lookup(seriesHistory(data, 'UNRATE'));
  return [...new Set([...vacancies.keys(), ...unemployed.keys(), ...rates.keys()])].sort().map(date => {
    const jobs = vacancies.get(date), people = unemployed.get(date);
    return {
      date, vacancies: jobs === undefined ? null : jobs / 1000,
      unemployed: people === undefined ? null : people / 1000,
      unemployment: rates.get(date) ?? null,
      tightness: jobs !== undefined && people !== undefined && people > 0 ? jobs / people : null,
      vacancyGap: jobs !== undefined && people !== undefined ? (jobs - people) / 1000 : null,
    };
  });
}

export function productivityAnalytics(data?: EconomicSnapshot) {
  const productivity = lookup(seriesHistory(data, 'OPHNFB'));
  const output = lookup(seriesHistory(data, 'OUTNFB'));
  const hours = lookup(seriesHistory(data, 'HOANBS'));
  return [...new Set([...productivity.keys(), ...output.keys(), ...hours.keys()])].sort().map(date => {
    const p = productivity.get(date), o = output.get(date), h = hours.get(date);
    const reconstructed = o !== undefined && h !== undefined && h > 0 ? o / h * 100 : null;
    const baseDate = offset(date, -3);
    const po = output.get(baseDate), ph = hours.get(baseDate);
    // Log changes are additive and do not confuse annualized growth with a
    // quarter-on-quarter rate. Rounded published indexes leave a small residual.
    const outputContribution = o !== undefined && o > 0 && po !== undefined && po > 0 ? Math.log(o / po) * 100 : null;
    const hoursContribution = h !== undefined && h > 0 && ph !== undefined && ph > 0 ? -Math.log(h / ph) * 100 : null;
    return {
      date, laborProductivity: p ?? null, yoy: growth(p, productivity.get(offset(date, -12))),
      outputIndex: o ?? null, hoursIndex: h ?? null, reconstructed,
      residual: p !== undefined && reconstructed !== null ? p - reconstructed : null,
      outputContribution, hoursContribution,
      netLogGrowth: outputContribution !== null && hoursContribution !== null ? outputContribution + hoursContribution : null,
    };
  });
}
