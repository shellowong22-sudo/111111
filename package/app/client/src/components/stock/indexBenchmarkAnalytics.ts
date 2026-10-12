import { normalizeObservationHistory } from "./stockObservationModel";

export type BenchmarkSeries = {
  id: string;
  label: string;
  group?: string;
  unit?: string;
  source?: string;
  status?: string;
  observationDate?: string | null;
  history?: unknown;
};

/** The environment endpoint also carries yields and volatility. Re-basing
 * those to 100 does not make them comparable equity investment returns. */
export function equityPriceBenchmarks(series: BenchmarkSeries[]) {
  const ids = new Set<string>();
  return series.filter(row => {
    if (row.group !== "equity" || row.unit !== "index_points" || ids.has(row.id)) return false;
    ids.add(row.id);
    return true;
  });
}

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function compareIndexBenchmarks(
  left: BenchmarkSeries | undefined,
  right: BenchmarkSeries | undefined,
  start = "",
  end = "",
) {
  let reason: string | null = null;
  if (!left || !right) reason = "第二个股票价格指数数据源未配置；不以利率或波动率替代。";
  else if (left.id === right.id) reason = "请选择两个不同的价格指数，避免比较同一数据。";
  else if (equityPriceBenchmarks([left, right]).length !== 2) reason = "仅接受股票价格指数，不将利率、波动率或信用利差当作价格回报。";
  else if (left.source !== "FRED" || right.source !== "FRED") reason = "指数来源未通过本工作台的 FRED 来源校验。";
  else if (left.status !== "available" || right.status !== "available") reason = "所选指数来源暂不可用，请重新读取；不生成替代序列。";
  else if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) reason = "起止日期无效；结束日期不得早于开始日期。";

  const inRange = (date: string) => (!start || date >= start) && (!end || date <= end);
  const lhs = !reason ? normalizeObservationHistory(left?.history).filter(row => row.value > 0 && inRange(row.date)) : [];
  const rhs = !reason ? normalizeObservationHistory(right?.history).filter(row => row.value > 0 && inRange(row.date)) : [];
  const rightByDate = new Map(rhs.map(row => [row.date, row.value]));
  const paired = lhs.flatMap(row => {
    const other = rightByDate.get(row.date);
    return other == null ? [] : [{ date: row.date, left: row.value, right: other }];
  });
  const base = paired[0];
  const rows = paired.map((row, index) => {
    const previous = paired[index - 1];
    const leftIndex = row.left / base.left * 100;
    const rightIndex = row.right / base.right * 100;
    return {
      ...row,
      intervalStart: previous?.date ?? null,
      calendarDays: previous ? (Date.parse(row.date) - Date.parse(previous.date)) / 86_400_000 : null,
      leftIndex,
      rightIndex,
      excessReturnPp: leftIndex - rightIndex,
      relativePerformancePct: (leftIndex / rightIndex - 1) * 100,
      leftIntervalReturnPct: previous ? (row.left / previous.left - 1) * 100 : null,
      rightIntervalReturnPct: previous ? (row.right / previous.right - 1) * 100 : null,
    };
  });
  if (!reason && rows.length < 2) reason = "选定日期范围的共同观察少于两条，不能计算区间表现；请调整范围或检查来源。";
  return {
    rows,
    reason,
    count: rows.length,
    leftCount: lhs.length,
    rightCount: rhs.length,
    unmatchedLeft: lhs.length - rows.length,
    unmatchedRight: rhs.length - rows.length,
    start: rows[0]?.date ?? null,
    end: rows.at(-1)?.date ?? null,
    leftReturnPct: rows.length >= 2 ? rows.at(-1)!.leftIndex - 100 : null,
    rightReturnPct: rows.length >= 2 ? rows.at(-1)!.rightIndex - 100 : null,
  };
}

/** Exports the exact filtered calculation inputs and outputs, never a second
 * data query. Guard spreadsheet formulas in untrusted string metadata. */
export function indexBenchmarkCsv(
  result: ReturnType<typeof compareIndexBenchmarks>,
  left: BenchmarkSeries,
  right: BenchmarkSeries,
  retrievedAt: string,
) {
  const lines: unknown[][] = [["date", "intervalStart", "calendarDays", "leftIndicatorId", "rightIndicatorId", "leftPoints", "rightPoints", "leftBase100", "rightBase100", "excessReturnPp", "relativePerformancePct", "leftIntervalReturnPct", "rightIntervalReturnPct", "baseDate", "source", "retrievedAt", "observationFrequency", "returnDefinition"]];
  if (!result.reason) for (const row of result.rows) lines.push([
    row.date, row.intervalStart, row.calendarDays, `fred:${left.id}`, `fred:${right.id}`,
    row.left, row.right, row.leftIndex, row.rightIndex, row.excessReturnPp,
    row.relativePerformancePct, row.leftIntervalReturnPct, row.rightIntervalReturnPct,
    result.start, "FRED", retrievedAt, "daily", "price-only; excludes reinvested dividends; not total return",
  ]);
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + lines.map(row => row.map(cell).join(",")).join("\r\n");
}
