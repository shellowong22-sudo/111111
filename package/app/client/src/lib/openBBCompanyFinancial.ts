import type { ModuleLiveFeedItem } from "@/hooks/useModuleLiveFeed";

export type CompanyFinancialRow = {
  periodEnding: string;
  fiscalPeriod: string;
  fiscalYear: number | null;
  currency: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  pretaxIncome: number | null;
  netIncome: number | null;
  basicEps: number | null;
  dilutedEps: number | null;
  rdExpense: number | null;
  sgaExpense: number | null;
  dividendsPerShare: number | null;
  raw: Record<string, string | number | boolean | null>;
};

export type CompanyFinancialDelivery = {
  item: ModuleLiveFeedItem;
  symbol: string;
  rows: CompanyFinancialRow[];
};

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function scalarText(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Select only a genuine provider financial statement.  A pushed news item or
 * an unrelated OpenBB dataset must never be interpreted as company accounts.
 */
export function selectCompanyFinancialDelivery(items: ModuleLiveFeedItem[]): CompanyFinancialDelivery | null {
  const item = items.find(candidate => {
    const dataset = candidate.dataset;
    if (!dataset || dataset.metadata.provider.toLowerCase() !== "sec") return false;
    const columns = new Set(dataset.columns);
    return columns.has("period_ending") && columns.has("total_revenue") && columns.has("net_income");
  });
  if (!item?.dataset) return null;

  const rows = item.dataset.rows.map(row => ({
    periodEnding: scalarText(row.period_ending),
    fiscalPeriod: scalarText(row.fiscal_period),
    fiscalYear: finiteNumber(row.fiscal_year),
    currency: scalarText(row.reported_currency),
    revenue: finiteNumber(row.total_revenue),
    grossProfit: finiteNumber(row.total_gross_profit),
    operatingIncome: finiteNumber(row.total_operating_income),
    pretaxIncome: finiteNumber(row.total_pretax_income),
    netIncome: finiteNumber(row.net_income),
    basicEps: finiteNumber(row.basic_eps),
    dilutedEps: finiteNumber(row.diluted_eps),
    rdExpense: finiteNumber(row.rd_expense),
    sgaExpense: finiteNumber(row.sga_expense),
    dividendsPerShare: finiteNumber(row.cash_dividends_per_share),
    raw: row,
  })).sort((left, right) => left.periodEnding.localeCompare(right.periodEnding));

  const titleParts = item.title.split("·").map(part => part.trim()).filter(Boolean);
  return { item, symbol: titleParts[1] || "已投递证券", rows };
}

export function financialGrowth(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

export function financialMargin(value: number | null, revenue: number | null) {
  if (value === null || revenue === null || revenue === 0) return null;
  return value / revenue * 100;
}

export function formatFinancialAmount(value: number | null, currency = "") {
  if (value === null) return "—";
  const absolute = Math.abs(value);
  const divisor = absolute >= 1e12 ? 1e12 : absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : 1;
  const suffix = divisor === 1e12 ? "tn" : divisor === 1e9 ? "bn" : divisor === 1e6 ? "mn" : "";
  return `${currency ? `${currency} ` : ""}${(value / divisor).toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

export function formatFinancialPercent(value: number | null) {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
