export type Holding = {
  instrumentId: string;
  issuer: string;
  marketValue: number;
  targetWeightPct: number | null;
  currency: string;
};

export function parseHoldings(text: string) {
  const rows: Holding[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length > 500) return { rows, errors: ["最多载入 500 条持仓。"] };
  for (const [index, line] of lines.entries()) {
    if (index === 0 && line.startsWith("instrumentId\t")) continue;
    const parts = line.split("\t").map(value => value.trim());
    const [instrumentId, issuer, amount, target, currency] = parts;
    const invalid = (reason: string) =>
      errors.push(`第 ${index + 1} 行：${reason}`);
    if (
      parts.length !== 5 ||
      !instrumentId ||
      !issuer ||
      !/^[A-Z]{3}$/.test(currency ?? "")
    ) {
      invalid("需要证券 ID、发行人、市值、目标权重、三位币种共五列。");
      continue;
    }
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      invalid("市值必须为明确填写的非负数（此视图为多头账簿）。");
      continue;
    }
    if (
      target &&
      (!Number.isFinite(Number(target)) ||
        Number(target) < 0 ||
        Number(target) > 100)
    ) {
      invalid("目标权重必须在 0–100 之间，未设定时留空。");
      continue;
    }
    if (seen.has(instrumentId)) {
      invalid(`证券 ${instrumentId} 重复，需先合并持仓。`);
      continue;
    }
    seen.add(instrumentId);
    rows.push({
      instrumentId,
      issuer,
      marketValue: Number(amount),
      targetWeightPct: target ? Number(target) : null,
      currency,
    });
  }
  if (new Set(rows.map(row => row.currency)).size > 1)
    errors.push("多币种不能直接合计；请先使用已核验汇率折算为同一基准币种。");
  if (!rows.length && !errors.length) errors.push("没有可载入的持仓记录。");
  return { rows: errors.length ? [] : rows, errors };
}

export function portfolioAnalysis(holdings: Holding[]) {
  const total = holdings.reduce((sum, row) => sum + row.marketValue, 0);
  const positions = holdings.map(row => ({
    ...row,
    weightPct: total > 0 ? (row.marketValue / total) * 100 : null,
  }));
  const issuerValues = new Map<string, number>();
  for (const row of holdings)
    issuerValues.set(
      row.issuer,
      (issuerValues.get(row.issuer) ?? 0) + row.marketValue
    );
  const issuers = [...issuerValues]
    .map(([issuer, marketValue]) => ({
      issuer,
      marketValue,
      weightPct: total > 0 ? (marketValue / total) * 100 : null,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
  const hhi =
    total > 0
      ? issuers.reduce((sum, row) => sum + (row.weightPct! / 100) ** 2, 0)
      : null;
  const missingTargets = holdings
    .filter(row => row.targetWeightPct == null)
    .map(row => row.instrumentId);
  const targetTotal = holdings.reduce(
    (sum, row) => sum + (row.targetWeightPct ?? 0),
    0
  );
  const targetValid =
    holdings.length > 0 &&
    total > 0 &&
    !missingTargets.length &&
    Math.abs(targetTotal - 100) <= 0.000001;
  const rebalance = positions.map(row => ({
    ...row,
    deviationPct: targetValid ? row.targetWeightPct! - row.weightPct! : null,
    targetValue: targetValid ? (total * row.targetWeightPct!) / 100 : null,
    adjustmentValue: targetValid
      ? (total * row.targetWeightPct!) / 100 - row.marketValue
      : null,
  }));
  const turnover = targetValid
    ? (rebalance.reduce((sum, row) => sum + Math.abs(row.adjustmentValue!), 0) /
        (2 * total)) *
      100
    : null;
  return {
    total,
    positions,
    issuers,
    hhi,
    targetTotal,
    missingTargets,
    targetValid,
    rebalance,
    turnover,
  };
}

export function validTimestamp(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) && Number.isFinite(Date.parse(value))
  );
}
