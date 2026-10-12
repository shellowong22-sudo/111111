export type ResearchDailyBar = { date: string; close: number };
export type ResearchHoldingPeriod = 1 | 3 | 5;
export type ResearchBacktestOptions = { holdingPeriod?: ResearchHoldingPeriod; transactionCostBps?: number; benchmarkHistory?: ResearchDailyBar[]; requireBenchmark?: boolean };
export type ResearchSignal = {
  signalDate: string;
  evaluationDate: string;
  direction: '偏强' | '偏弱';
  holdingPeriod: ResearchHoldingPeriod;
  closeAtSignal: number;
  closeAtEvaluation: number;
  nextDayReturnPct: number;
  grossResearchReturnPct: number;
  researchReturnPct: number;
  benchmarkGrossReturnPct: number | null;
  benchmarkReturnPct: number | null;
  excessReturnPct: number | null;
  transactionCostBps: number;
  roundTripCostPct: number;
  outcome: '正收益观察' | '负收益观察' | '零收益观察';
};
export type ResearchNavPoint = { date: string; strategyNetValue: number; benchmarkNetValue: number | null };
export type ResearchBacktestResult = {
  status: 'available' | 'insufficient';
  reason: string | null;
  signalRule: string;
  informationCutoff: string;
  costAssumption: string;
  sampleStart: string | null;
  sampleEnd: string | null;
  holdingPeriod: ResearchHoldingPeriod;
  transactionCostBps: number;
  benchmarkAligned: boolean;
  candidateSignalCount: number;
  excludedForBenchmarkCount: number;
  signals: ResearchSignal[];
  netValueCurve: ResearchNavPoint[];
  statistics: {
    sampleCount: number;
    positiveCount: number;
    positiveRatePct: number | null;
    averageReturnPct: number | null;
    maximumAdverseReturnPct: number | null;
    maximumDrawdownPct: number | null;
    strategyCumulativeReturnPct: number | null;
    benchmarkCumulativeReturnPct: number | null;
    cumulativeExcessReturnPct: number | null;
  };
};

function average(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function emptyStatistics(): ResearchBacktestResult['statistics'] { return { sampleCount: 0, positiveCount: 0, positiveRatePct: null, averageReturnPct: null, maximumAdverseReturnPct: null, maximumDrawdownPct: null, strategyCumulativeReturnPct: null, benchmarkCumulativeReturnPct: null, cumulativeExcessReturnPct: null }; }
function normalize(history: ResearchDailyBar[]) {
  const byDate = new Map<string, ResearchDailyBar>();
  history.filter((bar) => Number.isFinite(bar.close) && Boolean(bar.date)).forEach((bar) => byDate.set(bar.date, bar));
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * 公共日频研究评估：信号 t 只使用 t 当日及此前 10 个收盘；结局严格在 t+N 的后续交易日读取。
 * 成本是每次研究样本的单边假设，按开／平两端各扣一次；不产生交易指令、订单或未来收益预测。
 */
export function runDailyTrendResearchBacktest(history: ResearchDailyBar[], options: ResearchBacktestOptions = {}): ResearchBacktestResult {
  const holdingPeriod = options.holdingPeriod ?? 1;
  const transactionCostBps = Math.max(0, Math.min(250, Number.isFinite(options.transactionCostBps) ? Number(options.transactionCostBps) : 0));
  const roundTripCostPct = (transactionCostBps * 2) / 100;
  const valid = normalize(history);
  const hasBenchmarkInput = options.benchmarkHistory !== undefined;
  const benchmarkByDate = new Map(normalize(options.benchmarkHistory ?? []).map((bar) => [bar.date, bar.close]));
  const signalRule = '日频收盘高于 MA5 且 MA5 高于 MA10 为偏强；日频收盘低于 MA5 且 MA5 低于 MA10 为偏弱。';
  const informationCutoff = `每一观察只使用信号日收盘及此前数据；结局仅在第 ${holdingPeriod} 个后续交易日收盘评估，信号日至结局至少隔 1 个交易日。`;
  const costAssumption = `成本假设：单边 ${transactionCostBps.toFixed(0)} bp，开／平两端合计 ${roundTripCostPct.toFixed(2)}%；策略与同日历 SPY 基准均按此固定成本扣减，仅作敏感性研究。`;
  const base = { signalRule, informationCutoff, costAssumption, holdingPeriod, transactionCostBps, benchmarkAligned: hasBenchmarkInput, candidateSignalCount: 0, excludedForBenchmarkCount: 0, signals: [] as ResearchSignal[], netValueCurve: [] as ResearchNavPoint[], statistics: emptyStatistics() };
  if (valid.length < 10 + holdingPeriod) return { status: 'insufficient', reason: `至少需要 ${10 + holdingPeriod} 个完整日频收盘观察，才能形成 MA10 并在第 ${holdingPeriod} 个后续交易日评估。`, sampleStart: valid[0]?.date ?? null, sampleEnd: valid.at(-1)?.date ?? null, ...base };
  if (options.requireBenchmark && !hasBenchmarkInput) return { status: 'insufficient', reason: 'SPY 公共日频基准尚未返回；为避免把不对齐的样本解释为比较结果，当前不显示策略或基准统计。', sampleStart: valid[0].date, sampleEnd: valid.at(-1)?.date ?? null, ...base };

  const candidates: ResearchSignal[] = [];
  let excludedForBenchmarkCount = 0;
  for (let index = 9; index + holdingPeriod < valid.length; index += 1) {
    const close = valid[index].close;
    const ma5 = average(valid.slice(index - 4, index + 1).map((bar) => bar.close));
    const ma10 = average(valid.slice(index - 9, index + 1).map((bar) => bar.close));
    const direction = close > ma5 && ma5 > ma10 ? '偏强' : close < ma5 && ma5 < ma10 ? '偏弱' : null;
    if (!direction) continue;
    const evaluation = valid[index + holdingPeriod];
    const underlyingReturnPct = ((evaluation.close - close) / close) * 100;
    const grossResearchReturnPct = direction === '偏强' ? underlyingReturnPct : -underlyingReturnPct;
    const benchmarkSignalClose = benchmarkByDate.get(valid[index].date);
    const benchmarkEvaluationClose = benchmarkByDate.get(evaluation.date);
    if (hasBenchmarkInput && (benchmarkSignalClose == null || benchmarkEvaluationClose == null)) { excludedForBenchmarkCount += 1; continue; }
    const benchmarkGrossReturnPct = benchmarkSignalClose != null && benchmarkEvaluationClose != null ? ((benchmarkEvaluationClose - benchmarkSignalClose) / benchmarkSignalClose) * 100 : null;
    const researchReturnPct = grossResearchReturnPct - roundTripCostPct;
    const benchmarkReturnPct = benchmarkGrossReturnPct == null ? null : benchmarkGrossReturnPct - roundTripCostPct;
    const outcome = researchReturnPct > 0 ? '正收益观察' : researchReturnPct < 0 ? '负收益观察' : '零收益观察';
    candidates.push({ signalDate: valid[index].date, evaluationDate: evaluation.date, direction, holdingPeriod, closeAtSignal: close, closeAtEvaluation: evaluation.close, nextDayReturnPct: underlyingReturnPct, grossResearchReturnPct, researchReturnPct, benchmarkGrossReturnPct, benchmarkReturnPct, excessReturnPct: benchmarkReturnPct == null ? null : researchReturnPct - benchmarkReturnPct, transactionCostBps, roundTripCostPct, outcome });
  }
  const common = { ...base, candidateSignalCount: candidates.length + excludedForBenchmarkCount, excludedForBenchmarkCount };
  if (!candidates.length) {
    const reason = hasBenchmarkInput && excludedForBenchmarkCount > 0
      ? '当前标的与 SPY 公共日频样本没有足够的信号日／结局日交集，因此不显示策略或基准统计。'
      : '当前日频样本未触发既定的 MA5／MA10 偏强或偏弱研究条件，因此不显示比率或累计表现。';
    return { status: 'insufficient', reason, sampleStart: valid[0].date, sampleEnd: valid.at(-1)?.date ?? null, ...common };
  }
  const positiveCount = candidates.filter((signal) => signal.researchReturnPct > 0).length;
  let strategyNetValue = 100; let benchmarkNetValue: number | null = hasBenchmarkInput ? 100 : null; let strategyPeak = 100; let maximumDrawdown = 0;
  const netValueCurve: ResearchNavPoint[] = [{ date: candidates[0].signalDate, strategyNetValue, benchmarkNetValue }];
  for (const signal of candidates) {
    strategyNetValue *= 1 + signal.researchReturnPct / 100;
    strategyPeak = Math.max(strategyPeak, strategyNetValue);
    maximumDrawdown = Math.min(maximumDrawdown, ((strategyNetValue - strategyPeak) / strategyPeak) * 100);
    if (benchmarkNetValue != null && signal.benchmarkReturnPct != null) benchmarkNetValue *= 1 + signal.benchmarkReturnPct / 100;
    netValueCurve.push({ date: signal.evaluationDate, strategyNetValue, benchmarkNetValue });
  }
  const returns = candidates.map((signal) => signal.researchReturnPct);
  const strategyCumulativeReturnPct = strategyNetValue - 100;
  const benchmarkCumulativeReturnPct = benchmarkNetValue == null ? null : benchmarkNetValue - 100;
  return { status: 'available', reason: null, sampleStart: valid[0].date, sampleEnd: valid.at(-1)?.date ?? null, ...common, signals: candidates, netValueCurve, statistics: { sampleCount: candidates.length, positiveCount, positiveRatePct: positiveCount / candidates.length * 100, averageReturnPct: average(returns), maximumAdverseReturnPct: Math.min(...returns), maximumDrawdownPct: maximumDrawdown, strategyCumulativeReturnPct, benchmarkCumulativeReturnPct, cumulativeExcessReturnPct: benchmarkCumulativeReturnPct == null ? null : strategyCumulativeReturnPct - benchmarkCumulativeReturnPct } };
}
