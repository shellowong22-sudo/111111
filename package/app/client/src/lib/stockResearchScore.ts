export type StockResearchScoreBar = {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number | null;
  sma5: number | null;
  sma10: number | null;
};

export type StockResearchScore = {
  available: boolean;
  total: number | null;
  label: '研究观察：偏强' | '研究观察：中性' | '研究观察：偏弱' | '样本不足';
  trend: number | null;
  momentum: number | null;
  volume: number | null;
  volatility: number | null;
  methodology: string;
  reason: string | null;
};

const round = (value: number) => Math.round(Math.max(0, Math.min(100, value)));

/**
 * 公共日频研究评分。只使用最后一个完整日频 bar 及其历史字段，
 * 不预测未来，也不包含基本面、实时盘口、资金流或个性化适配。
 */
export function calculateStockResearchScore(bars: StockResearchScoreBar[]): StockResearchScore {
  const usable = bars.filter((bar) => Number.isFinite(bar.close) && Number.isFinite(bar.high) && Number.isFinite(bar.low));
  const latest = usable.at(-1);
  if (!latest || usable.length < 11 || latest.sma5 == null || latest.sma10 == null) {
    return {
      available: false,
      total: null,
      label: '样本不足',
      trend: null,
      momentum: null,
      volume: null,
      volatility: null,
      methodology: '需要至少 11 个完整公共日频 OHLCV 观测，且最新日已可计算 MA5 与 MA10。',
      reason: '当前公共日频历史不足，或均线字段不可计算。',
    };
  }

  const closeFiveDaysAgo = usable.at(-6)?.close;
  const closeTenDaysAgo = usable.at(-11)?.close;
  const return5 = closeFiveDaysAgo ? ((latest.close - closeFiveDaysAgo) / closeFiveDaysAgo) * 100 : 0;
  const return10 = closeTenDaysAgo ? ((latest.close - closeTenDaysAgo) / closeTenDaysAgo) * 100 : 0;
  const trailing = usable.slice(-10);
  const amplitudes = trailing.map((bar) => ((bar.high - bar.low) / Math.max(bar.close, Number.EPSILON)) * 100);
  const averageAmplitude = amplitudes.reduce((sum, value) => sum + value, 0) / amplitudes.length;
  const volumes = trailing.map((bar) => bar.volume).filter((value): value is number => value != null && value > 0);
  const averageVolume = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length : null;

  const trend = round(
    (latest.close > latest.sma5 ? 14 : 4) +
    (latest.sma5 > latest.sma10 ? 16 : 4) +
    (latest.close > latest.sma10 ? 10 : 2),
  );
  const momentum = round(12.5 + Math.max(-12.5, Math.min(12.5, return5 * 1.5)) + Math.max(-12.5, Math.min(12.5, return10)));
  const volume = averageVolume == null || latest.volume == null
    ? 8
    : round(Math.max(0, Math.min(15, 7.5 + ((latest.volume / averageVolume) - 1) * 7.5)));
  const volatility = round(Math.max(0, Math.min(20, 20 - averageAmplitude * 2)));
  const total = round(trend + momentum + volume + volatility);
  const label = total >= 68 ? '研究观察：偏强' : total <= 42 ? '研究观察：偏弱' : '研究观察：中性';

  return {
    available: true,
    total,
    label,
    trend,
    momentum,
    volume,
    volatility,
    methodology: '总分 0–100：趋势 40（收盘、MA5、MA10），动量 25（5／10 日收盘变化），量能 15（相对近 10 日均量），波动风险 20（近 10 日日内振幅的反向分）。',
    reason: '仅基于当前实际读取的公共日频 OHLCV；不使用实时盘口、资金流、基本面、新闻或个人持仓，不能构成评级、买卖建议或收益预测。',
  };
}
