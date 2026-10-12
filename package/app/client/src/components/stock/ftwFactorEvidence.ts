export type QualityMetric = {
  id: string;
  unit?: string;
  observations: Array<{
    start?: string | null;
    end?: string | null;
    value: number;
    periodType?: string;
    accessionNumber?: string | null;
    accn?: string | null;
    filed?: string | null;
    form?: string | null;
  }>;
};

/** Derive only same-period, same-filing ratios; no mixing later revisions. */
export function annualQualityEvidence(
  metrics: QualityMetric[],
  asOf = new Date().toISOString().slice(0, 10)
) {
  if (!validDate(asOf)) return [];
  const metric = (id: string) => {
    const matches = metrics.filter(row => row.id === id);
    if (!matches.length || matches.some(row => row.unit !== matches[0].unit)) return null;
    return { ...matches[0], observations: matches.flatMap(row => row.observations) };
  };
  const income = metric("NetIncomeLoss");
  const revenue =
    metric("RevenueFromContractWithCustomerExcludingAssessedTax") ?? metric("Revenues");
  const equity = metric("StockholdersEquity");
  const assets = metric("Assets");
  if (!income || !revenue || !revenue.unit || !/^[A-Z]{3}$/.test(revenue.unit) || income.unit !== revenue.unit) return [];
  type Fact = QualityMetric['observations'][number];
  const accessionOf = (row: Fact) => {
    if (row.accessionNumber && row.accn && row.accessionNumber !== row.accn) return null;
    return row.accessionNumber?.trim() || row.accn?.trim() || null;
  };
  const knownFact = (row: Fact) => !!row.end && validDate(row.end) && !!row.filed && validDate(row.filed) && row.end <= row.filed && row.filed <= asOf && Number.isFinite(row.value) && ['10-K', '10-K/A'].includes(row.form ?? '') && !!accessionOf(row);
  const uniqueFact = (rows: Fact[]) => {
    if (!rows.length || rows.some(row => !knownFact(row))) return null;
    const signatures = new Set(rows.map(row => JSON.stringify([row.value, row.filed, row.form])));
    return signatures.size === 1 ? rows[0] : null;
  };
  const result = (revenue.observations ?? [])
    .filter(
      row =>
        row.periodType === "annual" &&
        row.start &&
        row.end &&
        knownFact(row) && validDate(row.start) &&
        (Date.parse(row.end) - Date.parse(row.start)) / 86_400_000 + 1 >= 330 &&
        (Date.parse(row.end) - Date.parse(row.start)) / 86_400_000 + 1 <= 385
    )
    .flatMap(row => {
      const accession = accessionOf(row);
      if (!accession || !Number.isFinite(row.value) || row.value <= 0)
        return [];
      const revenueFact = uniqueFact(revenue.observations.filter(other => other.start === row.start && other.end === row.end && accessionOf(other) === accession));
      if (!revenueFact) return [];
      const profit = uniqueFact(income.observations.filter(
        other =>
          other.start === row.start &&
          other.end === row.end &&
          accessionOf(other) === accession &&
          other.periodType === "annual"
      ));
      if (!profit || profit.filed !== row.filed || profit.form !== row.form || !Number.isFinite(profit.value / row.value * 100)) return [];
      const eq =
        equity && equity.unit === income.unit
          ? uniqueFact(equity.observations.filter(
              other =>
                other.end === row.end &&
                !other.start &&
                accessionOf(other) === accession
            ))
          : null;
      const asset =
        assets && assets.unit === income.unit
          ? uniqueFact(assets.observations.filter(
              other =>
                other.end === row.end &&
                !other.start &&
                accessionOf(other) === accession
            ))
          : null;
      return [
        {
          start: row.start!,
          end: row.end!,
          accession,
          filed: row.filed ?? null,
          form: row.form ?? "10-K",
          revenueId: revenue.id,
          unit: revenue.unit ?? "未返回",
          revenue: row.value,
          netIncome: profit.value,
          netMargin: (profit.value / row.value) * 100,
          equityRatio:
            eq &&
            asset &&
            Number.isFinite(eq.value) &&
            Number.isFinite(asset.value) &&
            asset.value > 0 && eq.filed === row.filed && asset.filed === row.filed && eq.form === row.form && asset.form === row.form && Number.isFinite(eq.value / asset.value * 100)
              ? (eq.value / asset.value) * 100
              : null,
          revisionCount: 1,
        },
      ];
    });
  const latest = new Map<string, (typeof result)[number]>();
  const versions = new Map<string, Set<string>>();
  for (const row of result) {
    const key = JSON.stringify([row.start, row.end]);
    const accessions = versions.get(key) ?? new Set<string>();
    accessions.add(row.accession);
    versions.set(key, accessions);
    const previous = latest.get(key);
    if (!previous) {
      latest.set(key, row);
      continue;
    }
    const count = accessions.size;
    latest.set(
      key,
      `${row.filed}/${row.accession}` > `${previous.filed}/${previous.accession}`
        ? { ...row, revisionCount: count }
        : { ...previous, revisionCount: count }
    );
  }
  return [...latest.values()].sort((a, b) => a.end.localeCompare(b.end));
}

const validDate = (text: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(text) &&
  Number.isFinite(Date.parse(text)) &&
  new Date(text).toISOString().slice(0, 10) === text;
const finite = (value: string) =>
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value));
export type IcInput = {
  date: string;
  instrumentId: string;
  factorId: string;
  factorValue: number;
  forwardReturn: number;
  returnEnd: string;
  source: string;
  factorUnit: string;
  currency: string;
  modelVersion: string;
  availableDate: string;
};
export type FactorReturnInput = {
  date: string;
  factorId: string;
  returnPct: number;
  weightPct: number;
  source: string;
  periodStart: string;
  currency: string;
  modelVersion: string;
};

function parseTable(text: string, headers: string[]) {
  if (text.length > 1_000_000)
    return { rows: [] as string[][], error: "输入超过1 MB上限。" };
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2)
    return {
      rows: [] as string[][],
      error: "请粘贴包含表头与至少一行数据的 TSV。",
    };
  const actual = lines[0].trim().split("\t");
  if (actual.join("|") !== headers.join("|"))
    return {
      rows: [] as string[][],
      error: `表头必须按此顺序：${headers.join(" / ")}`,
    };
  if (lines.length > 10001)
    return { rows: [] as string[][], error: "最多接收10000行。" };
  const rows = lines
    .slice(1)
    .filter(line => line.trim())
    .map(line => line.split("\t").map(value => value.trim()));
  if (rows.some(row => row.length !== headers.length))
    return {
      rows: [] as string[][],
      error: "列数不匹配；请使用制表符分列，不要在单元格中包含换行或制表符。",
    };
  return { rows, error: "" };
}

export function parseIcEvidence(
  text: string,
  today = new Date().toISOString().slice(0, 10)
) {
  const parsed = parseTable(text, [
    "date",
    "instrumentId",
    "factorId",
    "factorValue",
    "forwardReturn",
    "returnEnd",
    "source",
    "factorUnit",
    "currency",
    "modelVersion",
    "availableDate",
  ]);
  if (parsed.error)
    return { rows: [] as IcInput[], error: parsed.error, duplicates: 0 };
  const rows = new Map<string, IcInput>();
  let duplicates = 0;
  for (const [index, row] of parsed.rows.entries()) {
    const [date, instrumentId, factorId, value, forward, returnEnd, source, factorUnit, currency, modelVersion, availableDate] =
      row;
    if (
      !validDate(date) ||
      !validDate(returnEnd) ||
      returnEnd <= date ||
      returnEnd >= today ||
      !validDate(availableDate) || availableDate > date ||
      !factorUnit || !/^[A-Z]{3}$/.test(currency) || !modelVersion ||
      !instrumentId ||
      !factorId ||
      !source ||
      !finite(value) ||
      !finite(forward) || Number(forward) < -100
    )
      return {
        rows: [] as IcInput[],
        error: `第${index + 2}行无效：须有来源、单位、币种、模型版本及观察日已可获得的数据；收益须≥−100%，收益末须早于今日。`,
        duplicates: 0,
      };
    const item = {
      date,
      instrumentId,
      factorId,
      factorValue: Number(value),
      forwardReturn: Number(forward),
      returnEnd,
      source,
      factorUnit, currency, modelVersion, availableDate,
    };
    const key = JSON.stringify([date, instrumentId, factorId, returnEnd]);
    const previous = rows.get(key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(item))
        return {
          rows: [] as IcInput[],
          error: `第${index + 2}行与同一证券/因子/收益区间存在冲突，未应用输入。`,
          duplicates: 0,
        };
      duplicates++;
    } else rows.set(key, item);
  }
  const definitions = new Map<string, string>();
  for (const row of rows.values()) {
    const definition = JSON.stringify([row.factorUnit, row.currency, row.modelVersion]);
    if (definitions.has(row.factorId) && definitions.get(row.factorId) !== definition) return { rows: [] as IcInput[], error: `${row.factorId} 存在不同单位、币种或模型版本；请分开分析。`, duplicates: 0 };
    definitions.set(row.factorId, definition);
  }
  return { rows: [...rows.values()], error: "", duplicates };
}

function ranks(values: number[]) {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const output = new Array<number>(values.length);
  let i = 0;
  while (i < sorted.length) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].value === sorted[i].value) end++;
    const rank = (i + 1 + end) / 2;
    for (let j = i; j < end; j++) output[sorted[j].index] = rank;
    i = end;
  }
  return output;
}
function correlation(x: number[], y: number[]) {
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  const numerator = x.reduce(
    (sum, value, index) => sum + (value - mx) * (y[index] - my),
    0
  );
  const denominator = Math.sqrt(
    x.reduce((sum, value) => sum + (value - mx) ** 2, 0) *
      y.reduce((sum, value) => sum + (value - my) ** 2, 0)
  );
  return denominator
    ? Math.max(-1, Math.min(1, numerator / denominator))
    : null;
}
export function computeIcEvidence(rows: IcInput[]) {
  const groups = new Map<string, IcInput[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.factorId, row.date, row.returnEnd, row.factorUnit, row.currency, row.modelVersion]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()]
    .map(group => ({
      factorId: group[0].factorId,
      date: group[0].date,
      returnEnd: group[0].returnEnd,
      factorUnit: group[0].factorUnit,
      currency: group[0].currency,
      modelVersion: group[0].modelVersion,
      count: group.length,
      ic:
        group.length >= 3
          ? correlation(
              ranks(group.map(row => row.factorValue)),
              ranks(group.map(row => row.forwardReturn))
            )
          : null,
      source: [...new Set(group.map(row => row.source))].join(" / "),
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.returnEnd.localeCompare(b.returnEnd) || a.factorId.localeCompare(b.factorId)
    );
}

export function parseFactorReturns(
  text: string,
  today = new Date().toISOString().slice(0, 10)
) {
  const parsed = parseTable(text, [
    "date",
    "factorId",
    "returnPct",
    "weightPct",
    "source",
    "periodStart",
    "currency",
    "modelVersion",
  ]);
  if (parsed.error)
    return {
      rows: [] as FactorReturnInput[],
      error: parsed.error,
      duplicates: 0,
    };
  const rows = new Map<string, FactorReturnInput>();
  let duplicates = 0;
  for (const [index, row] of parsed.rows.entries()) {
    const [date, factorId, ret, weight, source, periodStart, currency, modelVersion] = row;
    if (
      !validDate(date) ||
      date >= today || !validDate(periodStart) || periodStart >= date ||
      !/^[A-Z]{3}$/.test(currency) || !modelVersion ||
      !factorId ||
      !source ||
      !finite(ret) ||
      Number(ret) < -100 ||
      !finite(weight) ||
      Number(weight) < 0 ||
      Number(weight) > 100
    )
      return {
        rows: [] as FactorReturnInput[],
        error: `第${index + 2}行无效：须有起止日、币种、模型版本、因子及来源，期间末早于今日；收益≥−100%，长仓权重0–100%。`,
        duplicates: 0,
      };
    const item = {
      date,
      factorId,
      returnPct: Number(ret),
      weightPct: Number(weight),
      source,
      periodStart, currency, modelVersion,
    };
    const key = JSON.stringify([date, factorId]);
    const previous = rows.get(key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(item))
        return {
          rows: [] as FactorReturnInput[],
          error: `第${index + 2}行有同日因子冲突，未应用输入。`,
          duplicates: 0,
        };
      duplicates++;
    } else rows.set(key, item);
  }
  const result = [...rows.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.factorId.localeCompare(b.factorId)
  );
  for (const date of new Set(result.map(row => row.date))) {
    const periodRows = result.filter(row => row.date === date);
    if (new Set(periodRows.map(row => JSON.stringify([row.periodStart, row.currency, row.modelVersion]))).size !== 1) return { rows: [] as FactorReturnInput[], error: `${date} 存在不同起始日、币种或模型版本，不能合并比较或归因。`, duplicates: 0 };
    if (
      result
        .filter(row => row.date === date)
        .reduce((sum, row) => sum + row.weightPct, 0) > 100.000001
    )
      return {
        rows: [] as FactorReturnInput[],
        error: `${date} 权重合计超过100%，未应用输入。`,
        duplicates: 0,
      };
  }
  return { rows: result, error: "", duplicates };
}
export function factorAttribution(rows: FactorReturnInput[]) {
  return rows.map(row => ({
    ...row,
    contributionPct: (row.weightPct / 100) * row.returnPct,
  }));
}
