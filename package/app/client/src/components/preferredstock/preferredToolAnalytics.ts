export type PreferredTermInput = {
  id: number;
  securityIdentifier: string;
  securityName?: string | null;
  issuerName: string;
  cik?: string | null;
  dividendType: string;
  couponRatePct?: string | number | null;
  paymentFrequency?: string | null;
  firstCallDate?: Date | string | null;
  asOfDate?: Date | string | null;
  sourceReference?: string | null;
};
export type TermRule = {
  id: string;
  label: string;
  value: string;
  state: "passed" | "failed" | "unknown" | "not_requested";
  reason: string;
};
const finiteDecimal = (value: unknown): number | null => {
  if (
    value == null ||
    String(value).trim() === "" ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim())
  )
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const day = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? date.toISOString().slice(0, 10)
    : null;
};
export function evaluatePreferredTerm(
  term: PreferredTermInput,
  rules: {
    asOf: string;
    minimumCoupon: number | null;
    minimumCallDays: number | null;
    maximumAgeDays: number | null;
  }
) {
  const reference = Date.parse(`${rules.asOf}T00:00:00Z`);
  const coupon = finiteDecimal(term.couponRatePct);
  const observed = day(term.asOfDate);
  const call = day(term.firstCallDate);
  const ageDays =
    observed && Number.isFinite(reference)
      ? Math.floor((reference - Date.parse(`${observed}T00:00:00Z`)) / 86400000)
      : null;
  const callDays =
    call && Number.isFinite(reference)
      ? Math.floor((Date.parse(`${call}T00:00:00Z`) - reference) / 86400000)
      : null;
  const result: TermRule[] = [
    {
      id: "source",
      label: "来源证据",
      value: term.sourceReference?.trim() ? "已记录" : "未提供",
      state: term.sourceReference?.trim() ? "passed" : "unknown",
      reason: "只核验来源字段是否存在，不代表原文已被审定。",
    },
    {
      id: "identity",
      label: "发行主体关联",
      value: term.cik || "未提供",
      state: term.cik && /^\d{1,10}$/.test(term.cik) ? "passed" : "unknown",
      reason: "以合法 CIK 支持 SEC 主体关联，不是证券评级。",
    },
    {
      id: "coupon",
      label: "票面分配率门槛",
      value: coupon == null ? "未提供" : `${coupon}%`,
      state:
        rules.minimumCoupon == null
          ? "not_requested"
          : coupon == null
            ? "unknown"
            : coupon >= rules.minimumCoupon
              ? "passed"
              : "failed",
      reason:
        rules.minimumCoupon == null
          ? "未启用门槛。票面率不是市场收益率。"
          : `用户门槛 ≥ ${rules.minimumCoupon}%；浮动条款当前分配率无法由参考指数自动推断。`,
    },
    {
      id: "call",
      label: "首次可赎回保护期",
      value: callDays == null ? "未提供" : `${callDays} 天`,
      state:
        rules.minimumCallDays == null
          ? "not_requested"
          : callDays == null
            ? "unknown"
            : callDays >= rules.minimumCallDays
              ? "passed"
              : "failed",
      reason:
        rules.minimumCallDays == null
          ? "未启用保护期筛选。"
          : `距评估日需至少 ${rules.minimumCallDays} 天；首赎日不是保证赎回日。`,
    },
    {
      id: "freshness",
      label: "条款快照时效",
      value: ageDays == null ? "未提供" : `${ageDays} 天`,
      state:
        ageDays == null
          ? "unknown"
          : ageDays < 0
            ? "failed"
            : rules.maximumAgeDays == null
              ? "not_requested"
              : ageDays <= rules.maximumAgeDays
                ? "passed"
                : "failed",
      reason:
        ageDays != null && ageDays < 0
          ? "条款观察日期晚于评估日，不允许前视使用。"
          : rules.maximumAgeDays == null
            ? "未启用时效上限。"
            : `用户门槛 ≤ ${rules.maximumAgeDays} 天；不等同来源最新交易时间。`,
    },
  ];
  const failed = result.filter(rule => rule.state === "failed").length;
  const unknown = result.filter(rule => rule.state === "unknown").length;
  const evidenceFields = [
    Boolean(term.sourceReference?.trim()),
    Boolean(term.cik && /^\d{1,10}$/.test(term.cik)),
    coupon !== null,
    Boolean(term.paymentFrequency && term.paymentFrequency !== "other"),
    Boolean(observed),
  ];
  return {
    term,
    rules: result,
    failed,
    unknown,
    status: failed ? "不符合" : unknown ? "待补证" : "符合当前规则",
    completenessPct:
      (evidenceFields.filter(Boolean).length / evidenceFields.length) * 100,
  };
}

export type ExecutionFill = {
  orderId: string;
  fillId: string;
  instrumentId: string;
  timestamp: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  benchmark: number;
  fee: number;
  currency: string;
  source: string;
};
export function parseExecutionFills(text: string) {
  const rows: ExecutionFill[] = [],
    errors: string[] = [],
    seen = new Set<string>();
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length > 2000) return { rows, errors: ["最多载入 2000 条成交。"] };
  lines.forEach((line, index) => {
    const parts = line.split("\t").map(value => value.trim());
    if (index === 0 && parts[0] === "orderId") return;
    const [
      orderId,
      fillId,
      instrumentId,
      timestamp,
      side,
      quantityText,
      priceText,
      benchmarkText,
      feeText,
      currency,
      source,
    ] = parts;
    const bad = (reason: string) =>
      errors.push(`第 ${index + 1} 行：${reason}`);
    if (
      parts.length !== 11 ||
      !orderId ||
      !fillId ||
      !instrumentId ||
      !source ||
      !["BUY", "SELL"].includes(side) ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      bad("需要11列及非空委托/成交/证券/来源、BUY或SELL和三位币种。");
      return;
    }
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        timestamp
      ) ||
      !Number.isFinite(Date.parse(timestamp))
    ) {
      bad("成交时间必须有效且包含时区。");
      return;
    }
    const quantity = finiteDecimal(quantityText),
      price = finiteDecimal(priceText),
      benchmark = finiteDecimal(benchmarkText),
      fee = finiteDecimal(feeText);
    if (
      quantity == null ||
      price == null ||
      benchmark == null ||
      fee == null ||
      quantity <= 0 ||
      price <= 0 ||
      benchmark <= 0 ||
      fee < 0
    ) {
      bad("数量、价格和基准必须为正数，费用必须明确填写且非负。");
      return;
    }
    const key = `${orderId}:${fillId}`;
    if (seen.has(key)) {
      bad("同一委托的成交ID重复或冲突，不覆盖已有成交。");
      return;
    }
    seen.add(key);
    rows.push({
      orderId,
      fillId,
      instrumentId,
      timestamp: new Date(timestamp).toISOString(),
      side: side as "BUY" | "SELL",
      quantity,
      price,
      benchmark,
      fee,
      currency,
      source,
    });
  });
  const orders = new Map<string, string>();
  rows.forEach(row => {
    const identity = `${row.instrumentId}|${row.side}|${row.currency}|${row.benchmark}`;
    if (orders.has(row.orderId) && orders.get(row.orderId) !== identity)
      errors.push(`委托 ${row.orderId} 的证券、方向、币种或决策基准不一致。`);
    orders.set(row.orderId, identity);
  });
  if (!rows.length && !errors.length) errors.push("没有有效的成交记录。");
  return {
    rows: errors.length
      ? []
      : rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    errors,
  };
}

export function executionAnalysis(fills: ExecutionFill[]) {
  const scopes = new Set(
    fills.map(row => `${row.instrumentId}|${row.currency}`)
  );
  if (!fills.length || scopes.size !== 1) return null;
  let cumulativeCost = 0;
  const rows = fills.map(row => {
    const benchmarkNotional = row.quantity * row.benchmark;
    const slippage =
      (row.side === "BUY" ? 1 : -1) *
      (row.price - row.benchmark) *
      row.quantity;
    const totalCost = slippage + row.fee;
    cumulativeCost += totalCost;
    return {
      ...row,
      benchmarkNotional,
      slippage,
      totalCost,
      costBps: (totalCost / benchmarkNotional) * 10000,
      cumulativeCost,
    };
  });
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const benchmarkNotional = rows.reduce(
    (sum, row) => sum + row.benchmarkNotional,
    0
  );
  const slippage = rows.reduce((sum, row) => sum + row.slippage, 0);
  const fees = rows.reduce((sum, row) => sum + row.fee, 0);
  const totalCost = slippage + fees;
  return {
    rows,
    quantity,
    benchmarkNotional,
    slippage,
    fees,
    totalCost,
    slippageBps: (slippage / benchmarkNotional) * 10000,
    feeBps: (fees / benchmarkNotional) * 10000,
    totalBps: (totalCost / benchmarkNotional) * 10000,
    executedVwap:
      new Set(rows.map(row => row.side)).size === 1
        ? rows.reduce((sum, row) => sum + row.price * row.quantity, 0) /
          quantity
        : null,
  };
}
