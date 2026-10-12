import { alignedPricePaths, changeCorrelation } from "./stockRiskAnalytics";
import { normalizeObservationHistory } from "./stockObservationModel";

/** ETF comparison uses common observed dates. Neither missing prices nor NAV
 * are inferred from exchange-traded prices. Percentages are price-only. */
export function compareEtfPrices(
  fundHistory: unknown,
  referenceHistory: unknown
) {
  const aligned = alignedPricePaths(fundHistory, referenceHistory);
  const rows = aligned.map((row, index) => {
    const previous = aligned[index - 1];
    const fundReturn = previous ? (row.left / previous.left - 1) * 100 : null;
    const referenceReturn = previous
      ? (row.right / previous.right - 1) * 100
      : null;
    return {
      ...row,
      fundReturn,
      referenceReturn,
      activeReturn:
        fundReturn != null && referenceReturn != null
          ? fundReturn - referenceReturn
          : null,
    };
  });
  const active = rows.flatMap(row =>
    row.activeReturn == null ? [] : [row.activeReturn]
  );
  const meanActive = active.length
    ? active.reduce((sum, value) => sum + value, 0) / active.length
    : null;
  const activeDispersion =
    active.length >= 2 && meanActive != null
      ? Math.sqrt(
          active.reduce((sum, value) => sum + (value - meanActive) ** 2, 0) /
            (active.length - 1)
        )
      : null;
  return {
    rows,
    count: rows.length,
    start: rows[0]?.date ?? null,
    end: rows.at(-1)?.date ?? null,
    fundReturn: rows.length >= 2 ? rows.at(-1)!.leftIndex - 100 : null,
    referenceReturn: rows.length >= 2 ? rows.at(-1)!.rightIndex - 100 : null,
    relativeReturn: rows.length >= 2 ? rows.at(-1)!.relativeReturn : null,
    intervalCount: active.length,
    meanActive,
    activeDispersion,
  };
}

export type RelationSeries = {
  id: string;
  label: string;
  unit?: string;
  group?: string;
  history?: unknown;
  observationDate?: string | null;
  status?: string;
};

/** Every cell uses matching start/end observation dates. The same source
 * series is shared with WEI; IMAP alone owns the cross-series relation. */
export function environmentRelationMatrix(
  series: RelationSeries[],
  days: number,
  minimumPairs: number
) {
  const histories = series.map(row => normalizeObservationHistory(row.history));
  const latestDates = histories.flatMap(history =>
    history.at(-1) ? [history.at(-1)!.date] : []
  );
  const latest = latestDates.sort().at(-1);
  const cutoff = latest ? Date.parse(latest) - days * 86_400_000 : Infinity;
  const windows = histories.map(history =>
    history.filter(row => Date.parse(row.date) >= cutoff)
  );
  return series.flatMap((left, index) =>
    series.slice(index + 1).map((right, offset) => {
      const column = index + 1 + offset;
      const result = changeCorrelation(windows[index], windows[column]);
      const sufficient =
        result.count >= minimumPairs && result.correlation != null;
      return {
        leftId: left.id,
        rightId: right.id,
        ...result,
        correlation: sufficient ? result.correlation : null,
        state:
          result.count < minimumPairs
            ? ("insufficient" as const)
            : result.correlation == null
              ? ("constant" as const)
              : ("available" as const),
      };
    })
  );
}
