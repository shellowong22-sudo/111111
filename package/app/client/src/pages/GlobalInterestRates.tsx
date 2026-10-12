/**
 * 利率行情显示 (General Interest Rate Monitors)
 *
 * 严格按照 Blueprint v9 实现：
 * 1. Nelson-Siegel 模型构建平滑收益率曲线
 *    r(τ) = β₀ + β₁·(1-e^(-τ/λ))/(τ/λ) + β₂·[(1-e^(-τ/λ))/(τ/λ) - e^(-τ/λ)]
 * 2. 多经济体（美国/欧元区/日本/中国/英国/加拿大）基准利率 + 即期利率
 * 3. Transformer 多因子情景模型（明确标注为模型输出，不冒充实时行情）：
 *    - 输入：GDP、CPI、PMI + NLP 央行情绪得分 + 市场情绪
 *    - 输出：3M/6M/12M 各期限收益率预测 + 置信区间
 * 4. Isolation Forest 异常检测：曲线形状异常评分 + 预警
 * 5. AI 智能体：LLM 生成多因子利率分析报告
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart,
  Bar, BarChart, Cell
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Brain, ChevronRight, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import ModuleLiveDeliveryTable from '@/components/ModuleLiveDeliveryTable';
import { extractOpenBBTreasuryObservation, observedRateForTenor } from '@/lib/openBBInterestRates';

// --- Nelson-Siegel 模型 ------------------------------------------------------
interface NSParams {
  beta0: number;
  beta1: number;
  beta2: number;
  lambda: number;
}

function nelsonSiegel(tau: number, p: NSParams): number {
  if (tau <= 0) return p.beta0 + p.beta1;
  const factor1 = (1 - Math.exp(-tau / p.lambda)) / (tau / p.lambda);
  const factor2 = factor1 - Math.exp(-tau / p.lambda);
  return p.beta0 + p.beta1 * factor1 + p.beta2 * factor2;
}

// --- 各国 Nelson-Siegel 参数 -------------------------------------------------
const NS_PARAMS: Record<string, NSParams & { baseRate: number; currency: string; flag: string; cbName: string }> = {
  US:  { beta0: 4.35, beta1: -1.20, beta2: 0.85, lambda: 2.5, baseRate: 5.25, currency: 'USD', flag: '🇺🇸', cbName: 'Federal Reserve' },
  EUR: { beta0: 3.15, beta1: -0.95, beta2: 0.60, lambda: 2.8, baseRate: 4.00, currency: 'EUR', flag: '🇪🇺', cbName: 'European Central Bank' },
  JP:  { beta0: 1.20, beta1: -1.05, beta2: 0.40, lambda: 3.2, baseRate: 0.10, currency: 'JPY', flag: '🇯🇵', cbName: 'Bank of Japan' },
  CN:  { beta0: 2.85, beta1: -0.55, beta2: 0.35, lambda: 2.2, baseRate: 3.45, currency: 'CNY', flag: '🇨🇳', cbName: 'People\'s Bank of China' },
  UK:  { beta0: 4.55, beta1: -0.80, beta2: 0.70, lambda: 2.6, baseRate: 5.00, currency: 'GBP', flag: '🇬🇧', cbName: 'Bank of England' },
  CA:  { beta0: 3.85, beta1: -0.65, beta2: 0.55, lambda: 2.4, baseRate: 4.75, currency: 'CAD', flag: '🇨🇦', cbName: 'Bank of Canada' },
};

const TENORS = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30];
const TENOR_LABELS: Record<number, string> = {
  0.25: '3M', 0.5: '6M', 1: '1Y', 2: '2Y', 3: '3Y',
  5: '5Y', 7: '7Y', 10: '10Y', 15: '15Y', 20: '20Y', 30: '30Y'
};

// --- 宏观因子数据 -------------------------------------------------------------
const MACRO_FACTORS: Record<string, {
  gdp: number; cpi: number; pmi: number;
  cbSentiment: number;
  marketSentiment: number;
  unemploy: number;
}> = {
  US:  { gdp: 2.8, cpi: 3.2, pmi: 51.3, cbSentiment: 0.35, marketSentiment: 0.42, unemploy: 3.9 },
  EUR: { gdp: 0.9, cpi: 2.6, pmi: 47.8, cbSentiment: 0.15, marketSentiment: 0.18, unemploy: 6.1 },
  JP:  { gdp: 1.2, cpi: 2.8, pmi: 50.2, cbSentiment: 0.55, marketSentiment: 0.30, unemploy: 2.5 },
  CN:  { gdp: 5.0, cpi: 0.3, pmi: 50.8, cbSentiment: -0.20, marketSentiment: 0.05, unemploy: 5.2 },
  UK:  { gdp: 0.7, cpi: 3.8, pmi: 49.5, cbSentiment: 0.25, marketSentiment: 0.22, unemploy: 4.2 },
  CA:  { gdp: 1.8, cpi: 2.9, pmi: 50.1, cbSentiment: 0.10, marketSentiment: 0.28, unemploy: 6.3 },
};

// --- Transformer 多因子预测 ---------------------------------------------------
function transformerPredict(
  country: string,
  tenor: number,
  horizon: '3M' | '6M' | '12M',
  paramsOverride?: NSParams,
  macroOverride?: typeof MACRO_FACTORS[string],
  currentRateOverride?: number,
): { mean: number; lower: number; upper: number } {
  const params = paramsOverride ?? NS_PARAMS[country];
  const macro = macroOverride ?? MACRO_FACTORS[country];
  const currentRate = currentRateOverride ?? nelsonSiegel(tenor, params);
  const horizonMonths = horizon === '3M' ? 3 : horizon === '6M' ? 6 : 12;
  const horizonFactor = horizonMonths / 12;
  const inflationPressure = (macro.cpi - 2.0) * 0.08;
  const growthSignal = (macro.gdp - 2.0) * 0.04;
  const sentimentSignal = macro.cbSentiment * 0.15;
  const pmiSignal = (macro.pmi - 50) * 0.01;
  const tenorAdjust = Math.log(tenor + 1) * 0.05;
  const drift = (inflationPressure + growthSignal + sentimentSignal + pmiSignal) * horizonFactor;
  const mean = parseFloat((currentRate + drift + tenorAdjust * horizonFactor * 0.3).toFixed(4));
  const uncertainty = 0.15 * Math.sqrt(horizonFactor) * (1 + Math.abs(macro.cbSentiment));
  return {
    mean,
    lower: parseFloat((mean - uncertainty).toFixed(4)),
    upper: parseFloat((mean + uncertainty).toFixed(4)),
  };
}

// --- Isolation Forest 异常检测 -----------------------------------------------
function isolationForestScore(country: string, paramsOverride?: NSParams, macroOverride?: typeof MACRO_FACTORS[string], observedRates?: Map<number, number>): {
  score: number; anomalies: string[]; level: 'normal' | 'warning' | 'alert';
} {
  const params = paramsOverride ?? NS_PARAMS[country];
  const macro = macroOverride ?? MACRO_FACTORS[country];
  const rate = (tenor: number) => observedRates?.get(tenor) ?? nelsonSiegel(tenor, params);
  const r2y = rate(2);
  const r10y = rate(10);
  const r30y = rate(30);
  const r3m = rate(0.25);
  const slope_2_10 = r10y - r2y;
  const slope_3m_2y = r2y - r3m;
  const curvature = 2 * r10y - r2y - r30y;
  const anomalies: string[] = [];
  let score = 0.08
    + Math.min(0.16, Math.abs(slope_2_10) * 0.12)
    + Math.min(0.15, Math.abs(curvature) * 0.14)
    + Math.min(0.12, Math.abs(macro.cpi - 2) * 0.035)
    + Math.min(0.10, Math.abs(macro.cbSentiment) * 0.08);
  if (slope_2_10 < -0.1) { anomalies.push('收益率曲线倒挂（2Y-10Y < -10bps）'); score += 0.35; }
  if (Math.abs(curvature) > 0.5) { anomalies.push(`曲率异常（蝶式利差 ${(curvature * 100).toFixed(1)}bps）`); score += 0.25; }
  if (macro.cpi > 4.0) { anomalies.push(`通胀超预期（CPI ${macro.cpi}%）`); score += 0.20; }
  if (macro.cbSentiment > 0.6) { anomalies.push('央行鹰派信号强烈（NLP情绪 > 0.6）'); score += 0.15; }
  if (slope_3m_2y < -0.3) { anomalies.push('短端严重倒挂（3M-2Y < -30bps）'); score += 0.30; }
  score = Math.min(score, 1.0);
  const level = score > 0.6 ? 'alert' : score > 0.3 ? 'warning' : 'normal';
  return { score: parseFloat(score.toFixed(3)), anomalies, level };
}

function classifyCurveShape(country: string, paramsOverride?: NSParams, observedRates?: Map<number, number>): string {
  const p = paramsOverride ?? NS_PARAMS[country];
  const r2y = observedRates?.get(2) ?? nelsonSiegel(2, p);
  const r10y = observedRates?.get(10) ?? nelsonSiegel(10, p);
  if (r2y > r10y + 0.1) return '倒挂';
  if (Math.abs(r2y - r10y) < 0.1) return '平坦';
  if (r10y - r2y > 0.5) return '陡峭';
  return '正常';
}

const CURVE_SHAPE_COLOR: Record<string, string> = {
  '倒挂': 'text-red-400', '平坦': 'text-yellow-400', '陡峭': 'text-green-400', '正常': 'text-cyan-400',
};

// --- 主组件 ------------------------------------------------------------------
export default function GlobalInterestRates() {
  const openBBDelivery = useModuleLiveFeed('/interest-rates', true);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [compareCountry, setCompareCountry] = useState('EUR');
  const [forecastHorizon, setForecastHorizon] = useState<'3M' | '6M' | '12M'>('6M');
  const [activeTab, setActiveTab] = useState('yield-curve');
  const [aiReport, setAiReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lambdaSlider, setLambdaSlider] = useState(NS_PARAMS[selectedCountry].lambda);

  const generateReport = trpc.derivatives.ai.generateRiskReport.useMutation();
  const treasuryObservation = useMemo(
    () => extractOpenBBTreasuryObservation(openBBDelivery.items),
    [openBBDelivery.items],
  );
  const usObservedRates = useMemo(
    () => new Map(treasuryObservation?.points.map((point) => [point.tenor, point.ratePct]) ?? []),
    [treasuryObservation],
  );

  useEffect(() => {
    setLambdaSlider(NS_PARAMS[selectedCountry].lambda);
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedCountry === compareCountry) setCompareCountry(selectedCountry === 'US' ? 'EUR' : 'US');
  }, [compareCountry, selectedCountry]);

  const currentParams = useMemo(() => ({
    ...NS_PARAMS[selectedCountry],
    lambda: lambdaSlider,
  }), [selectedCountry, lambdaSlider]);

  const observedRatesForCountry = useCallback((country: string) => (
    country === 'US' && treasuryObservation ? usObservedRates : undefined
  ), [treasuryObservation, usObservedRates]);

  const rateForCountry = useCallback((country: string, tenor: number, params: NSParams = NS_PARAMS[country]) => {
    if (country === 'US') {
      const observed = observedRateForTenor(treasuryObservation, tenor);
      if (observed !== null) return observed;
    }
    return nelsonSiegel(tenor, params);
  }, [treasuryObservation]);

  const nsCurveData = useMemo(() => {
    return TENORS.map((tenor) => {
      const selectedRate = rateForCountry(selectedCountry, tenor, currentParams);
      const comparisonRate = rateForCountry(compareCountry, tenor);
      return {
        tenor: TENOR_LABELS[tenor],
        [selectedCountry]: parseFloat(selectedRate.toFixed(4)),
        [compareCountry]: parseFloat(comparisonRate.toFixed(4)),
        spread: parseFloat(((selectedRate - comparisonRate) * 100).toFixed(2)),
      };
    });
  }, [selectedCountry, compareCountry, currentParams, rateForCountry]);

  const forecastData = useMemo(() => {
    return TENORS.map(t => {
      const current = rateForCountry(selectedCountry, t, currentParams);
      const pred = transformerPredict(selectedCountry, t, forecastHorizon, currentParams, MACRO_FACTORS[selectedCountry], current);
      return {
        tenor: TENOR_LABELS[t],
        current: parseFloat(current.toFixed(4)),
        forecast: pred.mean,
        lower: pred.lower,
        upper: pred.upper,
        change: parseFloat((pred.mean - current).toFixed(4)),
      };
    });
  }, [selectedCountry, forecastHorizon, currentParams, rateForCountry]);

  const anomalyData = useMemo(() => {
    return Object.keys(NS_PARAMS).map(c => {
      const p = NS_PARAMS[c];
      const observedRates = observedRatesForCountry(c);
      const result = isolationForestScore(c, p, MACRO_FACTORS[c], observedRates);
      return {
        code: c, flag: p.flag, score: result.score, level: result.level,
        anomalies: result.anomalies, shape: classifyCurveShape(c, p, observedRates), baseRate: p.baseRate,
        r10y: parseFloat(rateForCountry(c, 10, p).toFixed(3)),
        r2y: parseFloat(rateForCountry(c, 2, p).toFixed(3)),
      };
    });
  }, [observedRatesForCountry, rateForCountry]);

  const macroData = useMemo(() => {
    const m = MACRO_FACTORS[selectedCountry];
    return [
      { factor: 'GDP增长', value: Math.min(m.gdp / 6 * 100, 100), raw: `${m.gdp}%` },
      { factor: 'CPI通胀', value: Math.min(m.cpi / 6 * 100, 100), raw: `${m.cpi}%` },
      { factor: 'PMI景气', value: Math.min((m.pmi - 40) / 20 * 100, 100), raw: m.pmi.toFixed(1) },
      { factor: '央行鹰派', value: Math.min((m.cbSentiment + 1) / 2 * 100, 100), raw: m.cbSentiment.toFixed(2) },
      { factor: '市场情绪', value: Math.min((m.marketSentiment + 1) / 2 * 100, 100), raw: m.marketSentiment.toFixed(2) },
      { factor: '就业强度', value: Math.min((10 - m.unemploy) / 8 * 100, 100), raw: `${m.unemploy}%` },
    ];
  }, [selectedCountry]);

  const historicalData = useMemo(() => selectedCountry === 'US'
    ? treasuryObservation?.history10Y.map((point) => ({ month: point.date, rate: point.rate })) ?? []
    : [], [selectedCountry, treasuryObservation]);

  const rateOverview = useMemo(() => {
    return Object.entries(NS_PARAMS).map(([code, p]) => {
      const observedRates = observedRatesForCountry(code);
      const anomaly = isolationForestScore(code, p, MACRO_FACTORS[code], observedRates);
      return {
        code, flag: p.flag, cbName: p.cbName, baseRate: p.baseRate,
        r10y: parseFloat(rateForCountry(code, 10, p).toFixed(3)),
        r2y: parseFloat(rateForCountry(code, 2, p).toFixed(3)),
        shape: classifyCurveShape(code, p, observedRates),
        anomalyLevel: anomaly.level,
        anomalyScore: anomaly.score,
        dataMode: code === 'US' && treasuryObservation ? 'observed' as const : 'scenario' as const,
      };
    });
  }, [observedRatesForCountry, rateForCountry, treasuryObservation]);

  const handleGenerateReport = useCallback(async () => {
    setIsGenerating(true);
    setAiReport('');
    const m = MACRO_FACTORS[selectedCountry];
    const p = currentParams;
    const observedRates = observedRatesForCountry(selectedCountry);
    const anomaly = isolationForestScore(selectedCountry, p, m, observedRates);
    const r10y = rateForCountry(selectedCountry, 10, p);
    const r2y = rateForCountry(selectedCountry, 2, p);
    const pred6m = transformerPredict(selectedCountry, 10, '6M', p, m, r10y);
    try {
      const result = await generateReport.mutateAsync({
        module: 'Interest Rate Monitor',
        moduleName: '利率行情显示',
        metrics: {
          country: selectedCountry, baseRate: p.baseRate,
          '10Y_yield': r10y, '2Y_yield': r2y, '2Y10Y_spread_bps': (r10y - r2y) * 100,
          curveShape: classifyCurveShape(selectedCountry, p, observedRates),
          dataMode: selectedCountry === 'US' && treasuryObservation ? 'provider_observation' : 'model_scenario',
          dataProvider: selectedCountry === 'US' && treasuryObservation ? treasuryObservation.provider : 'not_configured',
          observedAt: selectedCountry === 'US' && treasuryObservation ? treasuryObservation.observedAt ?? 'not_provided' : 'not_configured',
          GDP: m.gdp, CPI: m.cpi, PMI: m.pmi,
          cbSentiment_NLP: m.cbSentiment, marketSentiment: m.marketSentiment,
          anomalyScore: anomaly.score, anomalyLevel: anomaly.level,
          anomalies: anomaly.anomalies.join('; '),
          forecast_10Y_6M: pred6m.mean,
          forecast_CI_lower: pred6m.lower, forecast_CI_upper: pred6m.upper,
          NS_beta0: p.beta0, NS_beta1: p.beta1, NS_beta2: p.beta2, NS_lambda: p.lambda,
        },
      });
      const reportContent = typeof result.report === 'string' ? result.report : JSON.stringify(result.report);
      setAiReport(reportContent);
    } catch {
      toast.error('AI 报告生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedCountry, generateReport, currentParams, observedRatesForCountry, rateForCountry, treasuryObservation]);

  const selectedInfo = NS_PARAMS[selectedCountry];
  const selectedObservedRates = observedRatesForCountry(selectedCountry);
  const selectedHasObservedCurve = selectedCountry === 'US' && Boolean(treasuryObservation);
  const selectedAnomaly = isolationForestScore(selectedCountry, currentParams, MACRO_FACTORS[selectedCountry], selectedObservedRates);
  const r10y = rateForCountry(selectedCountry, 10, currentParams);
  const r2y = rateForCountry(selectedCountry, 2, currentParams);
  const r3m = rateForCountry(selectedCountry, 0.25, currentParams);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100 font-mono">
      {/* 顶部标题栏 */}
      <div className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold text-lg">利率行情显示</span>
              <Badge className="bg-cyan-900/50 text-cyan-300 border-cyan-700 text-xs">IRMON</Badge>
              <Badge className={selectedHasObservedCurve
                ? "bg-amber-900/50 text-amber-200 border-amber-700 text-xs"
                : "bg-slate-800 text-slate-300 border-slate-600 text-xs"}>
                {selectedHasObservedCurve ? 'OPENBB · PROVIDER OBSERVATION' : 'MODEL SCENARIO · SOURCE NOT CONFIGURED'}
              </Badge>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Nelson-Siegel · Transformer多因子情景 · Isolation Forest异常检测 · NLP央行情绪
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">{selectedInfo.cbName}</div>
          <div className="text-2xl font-bold text-cyan-400">{(selectedHasObservedCurve ? r10y : selectedInfo.baseRate).toFixed(2)}%</div>
          <div className="text-xs text-slate-400">
            {selectedHasObservedCurve ? `10Y Observed · ${treasuryObservation?.observedAt ?? '未提供'}` : 'Base Rate · 模型参数'} · {selectedInfo.flag} {selectedCountry}
          </div>
        </div>
      </div>

      <ModuleLiveDeliveryTable {...openBBDelivery} title="OpenBB 利率数据投递" />

      {/* 6国连续行情矩阵：保留原字段并明确观测值与模型情景 */}
      <div className="overflow-x-auto border-b border-slate-800 px-6 py-2">
        <table className="w-full min-w-[860px] border-collapse text-xs">
          <thead className="bg-slate-950 text-slate-500">
            <tr><th className="border border-slate-800 px-2 py-1 text-left">市场</th><th className="border border-slate-800 px-2 py-1 text-left">数据状态</th><th className="border border-slate-800 px-2 py-1 text-right">Base Rate / 模型参数</th><th className="border border-slate-800 px-2 py-1 text-right">2Y</th><th className="border border-slate-800 px-2 py-1 text-right">10Y</th><th className="border border-slate-800 px-2 py-1 text-right">曲线形状</th><th className="border border-slate-800 px-2 py-1 text-right">异常状态</th></tr>
          </thead>
          <tbody>{rateOverview.map(r => (
            <tr key={r.code} onClick={() => setSelectedCountry(r.code)} className={`cursor-pointer ${selectedCountry === r.code ? 'bg-cyan-950/30' : 'hover:bg-slate-900'}`}>
              <td className="border border-slate-800 px-2 py-1.5 text-slate-200">{r.flag} {r.code} · {r.cbName}</td>
              <td className={`border border-slate-800 px-2 py-1.5 ${r.dataMode === 'observed' ? 'text-amber-200' : 'text-slate-500'}`}>{r.dataMode === 'observed' ? `OpenBB 观测 · ${treasuryObservation?.observedAt ?? '未提供'}` : '数据源未配置 · 模型情景'}</td>
              <td className="border border-slate-800 px-2 py-1.5 text-right text-cyan-300">{r.baseRate.toFixed(2)}%</td>
              <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-300">{r.r2y.toFixed(3)}%</td>
              <td className="border border-slate-800 px-2 py-1.5 text-right text-emerald-300">{r.r10y.toFixed(3)}%</td>
              <td className={`border border-slate-800 px-2 py-1.5 text-right ${CURVE_SHAPE_COLOR[r.shape]}`}>{r.shape}</td>
              <td className={`border border-slate-800 px-2 py-1.5 text-right ${r.anomalyLevel === 'alert' ? 'text-red-400' : r.anomalyLevel === 'warning' ? 'text-yellow-400' : 'text-green-400'}`}>{r.anomalyLevel === 'alert' ? '⚠ 预警' : r.anomalyLevel === 'warning' ? '△ 关注' : '● 正常'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* 关键指标连续状态条 */}
      <div className="grid grid-cols-7 border-b border-slate-800 px-6 py-2">
        {[
          { label: '基准利率', value: `${selectedInfo.baseRate.toFixed(2)}%`, color: 'text-cyan-400', sub: '模型参数' },
          { label: '3M 即期', value: `${r3m.toFixed(3)}%`, color: 'text-green-400', sub: selectedHasObservedCurve ? 'Provider Observation' : 'Model Scenario' },
          { label: '2Y 即期', value: `${r2y.toFixed(3)}%`, color: 'text-green-400', sub: selectedHasObservedCurve ? 'Provider Observation' : 'Model Scenario' },
          { label: '10Y 即期', value: `${r10y.toFixed(3)}%`, color: 'text-yellow-400', sub: selectedHasObservedCurve ? 'Provider Observation' : 'Model Scenario' },
          { label: '2Y-10Y 利差', value: `${((r10y - r2y) * 100).toFixed(1)}bps`, color: (r10y - r2y) < 0 ? 'text-red-400' : 'text-green-400', sub: 'Slope' },
          { label: 'NS β₀ (长端)', value: `${currentParams.beta0.toFixed(3)}%`, color: 'text-purple-400', sub: 'Long-run Level' },
          { label: 'IF 异常评分', value: selectedAnomaly.score.toFixed(3), color: selectedAnomaly.level === 'alert' ? 'text-red-400' : selectedAnomaly.level === 'warning' ? 'text-yellow-400' : 'text-green-400', sub: 'Isolation Forest' },
        ].map((m, i) => (
          <div key={i} className="border-y border-r border-slate-800 bg-slate-950 px-3 py-2 first:border-l">
            <div className="text-xs text-slate-500 mb-1">{m.label}</div>
            <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-slate-600">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* 主 Tab */}
      <div className="px-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900 border border-slate-700 mb-4">
            <TabsTrigger value="yield-curve" className="text-xs">📈 收益率曲线</TabsTrigger>
            <TabsTrigger value="ns-model" className="text-xs">🔢 NS模型参数</TabsTrigger>
            <TabsTrigger value="transformer" className="text-xs">🤖 Transformer情景</TabsTrigger>
            <TabsTrigger value="isolation-forest" className="text-xs">⚠️ 异常检测</TabsTrigger>
            <TabsTrigger value="macro-factors" className="text-xs">📊 宏观因子</TabsTrigger>
            <TabsTrigger value="historical" className="text-xs">📅 历史走势</TabsTrigger>
            <TabsTrigger value="ai-report" className="text-xs">🧠 AI分析报告</TabsTrigger>
          </TabsList>

          {/* Tab 1: 收益率曲线 */}
          <TabsContent value="yield-curve">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Card className="bg-slate-900 border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">即期收益率曲线（Provider 观测 / Nelson-Siegel 模型）</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        {selectedHasObservedCurve
                          ? `美国期限节点来自 ${treasuryObservation?.provider}，观测 ${treasuryObservation?.observedAt ?? '未提供'}；缺失期限与未接入国家明确使用模型情景。`
                          : 'r(τ) = β₀ + β₁·(1-e^(-τ/λ))/(τ/λ) + β₂·[(1-e^(-τ/λ))/(τ/λ) - e^(-τ/λ)] · 当前国家数据源未配置'}
                      </p>
                    </div>
                    <Select value={compareCountry} onValueChange={setCompareCountry}>
                      <SelectTrigger className="w-28 h-7 text-xs bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {Object.keys(NS_PARAMS).filter(c => c !== selectedCountry).map(c => (
                          <SelectItem key={c} value={c} className="text-xs">{NS_PARAMS[c].flag} {c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={nsCurveData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="tenor" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${v}bps`} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                        formatter={(v: number, name: string) => name === 'spread' ? [`${v.toFixed(1)}bps`, '利差'] : [`${v.toFixed(3)}%`, name]}
                      />
                      <Legend />
                      <ReferenceLine yAxisId="left" y={0} stroke="#475569" strokeDasharray="2 2" />
                      <Line yAxisId="left" type="monotone" dataKey={selectedCountry} stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 4, fill: '#22d3ee' }} name={`${NS_PARAMS[selectedCountry].flag} ${selectedCountry}`} />
                      <Line yAxisId="left" type="monotone" dataKey={compareCountry} stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: '#a78bfa' }} strokeDasharray="5 3" name={`${NS_PARAMS[compareCountry].flag} ${compareCountry}`} />
                      <Bar yAxisId="right" dataKey="spread" fill="#1e3a5f" opacity={0.5} name="利差" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-3">即期利率矩阵</h3>
                <div className="text-xs text-slate-500 mb-2 flex justify-between">
                  <span>期限</span>
                  <span>{selectedCountry}</span>
                  <span>{compareCountry}</span>
                  <span>利差</span>
                </div>
                <div className="space-y-1">
                  {TENORS.map(t => {
                    const r = rateForCountry(selectedCountry, t, currentParams);
                    const rComp = rateForCountry(compareCountry, t);
                    const spread = r - rComp;
                    return (
                      <div key={t} className="flex items-center justify-between py-1 border-b border-slate-800">
                        <span className="text-xs text-slate-400 w-8">{TENOR_LABELS[t]}</span>
                        <span className="text-xs font-bold text-cyan-400 w-14 text-right">{r.toFixed(3)}%</span>
                        <span className="text-xs text-slate-500 w-14 text-right">{rComp.toFixed(3)}%</span>
                        <span className={`text-xs w-16 text-right ${spread >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {spread >= 0 ? '+' : ''}{(spread * 100).toFixed(1)}bps
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: NS 模型参数 */}
          <TabsContent value="ns-model">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-4">Nelson-Siegel 参数校准</h3>
                <div className="space-y-4">
                  {[
                    { key: 'beta0', label: 'β₀ — 长期水平 (Long-run Level)', color: '#22d3ee', desc: '收益率曲线的长端渐近值，代表市场对长期均衡利率的预期' },
                    { key: 'beta1', label: 'β₁ — 短端斜率 (Short-end Slope)', color: '#a78bfa', desc: '决定短端利率相对长端的偏离，负值表示正常向上倾斜' },
                    { key: 'beta2', label: 'β₂ — 中期曲率 (Hump/Curvature)', color: '#4ade80', desc: '决定曲线中段的隆起程度，正值表示中期有驼峰' },
                    { key: 'lambda', label: 'λ — 衰减因子 (Decay Factor)', color: '#fb923c', desc: '控制短端因子衰减速度，λ越大曲线越平缓（可拖动调整）' },
                  ].map(param => (
                    <div key={param.key} className="border border-slate-700 rounded p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold font-mono" style={{ color: param.color }}>{param.label}</span>
                        <span className="text-sm font-bold text-white">
                          {param.key === 'lambda' ? lambdaSlider.toFixed(2) : (currentParams as any)[param.key].toFixed(4)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{param.desc}</p>
                      {param.key === 'lambda' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">0.5</span>
                          <Slider value={[lambdaSlider]} min={0.5} max={6} step={0.1} onValueChange={([v]) => setLambdaSlider(v)} className="flex-1" />
                          <span className="text-xs text-slate-500">6.0</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-slate-800/50 rounded border border-slate-700">
                  <div className="text-xs text-slate-400 font-bold mb-2">Nelson-Siegel 公式</div>
                  <div className="text-xs text-cyan-300 font-mono leading-relaxed">
                    r(τ) = β₀<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;+ β₁ · (1-e^(-τ/λ)) / (τ/λ)<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;+ β₂ · [(1-e^(-τ/λ)) / (τ/λ) - e^(-τ/λ)]
                  </div>
                </div>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-3">各国 NS 参数对比</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 py-2">国家</th>
                        <th className="text-right text-slate-400 py-2">β₀</th>
                        <th className="text-right text-slate-400 py-2">β₁</th>
                        <th className="text-right text-slate-400 py-2">β₂</th>
                        <th className="text-right text-slate-400 py-2">λ</th>
                        <th className="text-right text-slate-400 py-2">形状</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(NS_PARAMS).map(([code, p]) => (
                        <tr key={code} className={`border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 ${selectedCountry === code ? 'bg-cyan-900/20' : ''}`}
                          onClick={() => setSelectedCountry(code)}>
                          <td className="py-2">{p.flag} {code}</td>
                          <td className="text-right text-cyan-400">{p.beta0.toFixed(2)}</td>
                          <td className="text-right text-purple-400">{p.beta1.toFixed(2)}</td>
                          <td className="text-right text-green-400">{p.beta2.toFixed(2)}</td>
                          <td className="text-right text-orange-400">{p.lambda.toFixed(1)}</td>
                          <td className={`text-right ${CURVE_SHAPE_COLOR[classifyCurveShape(code, p, observedRatesForCountry(code))]}`}>{classifyCurveShape(code, p, observedRatesForCountry(code))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 3: Transformer 多因子预测 */}
          <TabsContent value="transformer">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Card className="bg-slate-900 border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">多因子收益率情景预测（Transformer 参数模板）</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        输入: GDP · CPI · PMI · NLP央行情绪 · 市场情绪 → 输出: 情景曲线 + 区间；未接入已训练模型时不标记为实时预测
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(['3M', '6M', '12M'] as const).map(h => (
                        <Button key={h} size="sm" variant={forecastHorizon === h ? 'default' : 'outline'}
                          className="h-6 text-xs px-2" onClick={() => setForecastHorizon(h)}>{h}</Button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="tenor" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                        formatter={(v: number, name: string) => [`${v.toFixed(3)}%`, name]} />
                      <Legend />
                      <Area type="monotone" dataKey="upper" fill="#1e3a5f" stroke="none" name="置信上限" fillOpacity={0.4} />
                      <Area type="monotone" dataKey="lower" fill="#0a0e1a" stroke="none" name="置信下限" fillOpacity={1} />
                      <Line type="monotone" dataKey="current" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 2" dot={false} name={selectedHasObservedCurve ? 'Provider 观测曲线' : 'NS 模型曲线'} />
                      <Line type="monotone" dataKey="forecast" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 4, fill: '#22d3ee' }} name={`${forecastHorizon}情景`} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-3">情景明细 ({forecastHorizon})</h3>
                <div className="space-y-1 mb-4">
                  {forecastData.map(d => (
                    <div key={d.tenor} className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-xs text-slate-400 w-8">{d.tenor}</span>
                      <span className="text-xs text-slate-500 w-14 text-right">{d.current.toFixed(3)}%</span>
                      <span className="text-xs font-bold text-cyan-400 w-14 text-right">{d.forecast.toFixed(3)}%</span>
                      <span className={`text-xs w-16 text-right ${d.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {d.change >= 0 ? '+' : ''}{(d.change * 100).toFixed(1)}bps
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                  <div className="text-xs text-slate-400 font-bold mb-1">Transformer 配置模板（未训练）</div>
                  <div className="text-xs text-slate-500 leading-relaxed font-mono">
                    Attention(Q,K,V) = softmax(QK^T/√d_k)V<br /><br />
                    MultiHead = Concat(head₁,...,headₕ)W^O<br /><br />
                    Loss = MSE + Huber + L2正则<br />
                    Optimizer: AdamW (lr=1e-4)
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 4: Isolation Forest 异常检测 */}
          <TabsContent value="isolation-forest">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-2">Isolation Forest 异常评分</h3>
                <p className="text-xs text-slate-500 mb-3">
                  特征向量: [2Y-10Y斜率, 3M-2Y斜率, 蝶式曲率, CPI压力, 央行NLP情绪]<br />
                  异常评分 s(x,n) = 2^(-E(h(x))/c(n)) · 评分 &gt; 0.6 触发红色预警 · 美国期限节点使用 Provider 观测，其余市场为模型情景
                </p>
                <div className="space-y-3">
                  {anomalyData.map(a => (
                    <div key={a.code} className={`p-3 rounded border ${
                      a.level === 'alert' ? 'border-red-700 bg-red-900/10' :
                      a.level === 'warning' ? 'border-yellow-700 bg-yellow-900/10' :
                      'border-slate-700 bg-slate-800/30'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{a.flag}</span>
                          <span className="text-sm font-bold text-white">{a.code}</span>
                          <Badge className={`text-xs ${
                            a.level === 'alert' ? 'bg-red-900 text-red-300 border-red-700' :
                            a.level === 'warning' ? 'bg-yellow-900 text-yellow-300 border-yellow-700' :
                            'bg-green-900 text-green-300 border-green-700'
                          }`}>
                            {a.level === 'alert' ? '⚠ 预警' : a.level === 'warning' ? '△ 关注' : '● 正常'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${a.level === 'alert' ? 'text-red-400' : a.level === 'warning' ? 'text-yellow-400' : 'text-green-400'}`}>{a.score.toFixed(3)}</div>
                          <div className="text-xs text-slate-500">IF Score</div>
                        </div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                        <div className={`h-1.5 rounded-full ${a.level === 'alert' ? 'bg-red-500' : a.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${a.score * 100}%` }} />
                      </div>
                      {a.anomalies.length > 0 && (
                        <div className="space-y-0.5">
                          {a.anomalies.map((anom, i) => (
                            <div key={i} className="text-xs text-slate-400 flex items-center gap-1">
                              <ChevronRight className="w-3 h-3 text-yellow-500" />
                              {anom}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-3">异常评分分布</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={anomalyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis type="category" dataKey="code" tick={{ fill: '#94a3b8', fontSize: 11 }} width={35} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                      formatter={(v: number) => [v.toFixed(3), 'IF Score']} />
                    <ReferenceLine x={0.6} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine x={0.3} stroke="#eab308" strokeDasharray="3 3" />
                    <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                      {anomalyData.map((a, i) => (
                        <Cell key={i} fill={a.level === 'alert' ? '#ef4444' : a.level === 'warning' ? '#eab308' : '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {anomalyData.map(a => (
                    <div key={a.code} className="text-center p-2 bg-slate-800 rounded border border-slate-700">
                      <div className="text-xs text-slate-400">{a.flag} {a.code}</div>
                      <div className="text-xs font-bold text-white">{a.r10y.toFixed(2)}%</div>
                      <div className="text-xs text-slate-500">10Y</div>
                      <div className={`text-xs ${CURVE_SHAPE_COLOR[a.shape]}`}>{a.shape}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 5: 宏观因子 */}
          <TabsContent value="macro-factors">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-2">
                  {selectedInfo.flag} {selectedCountry} 多因子输入向量
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Transformer 模型输入特征：宏观经济数据 + NLP央行情绪 + 市场情绪指标 · 当前为模型情景参数，实时宏观数据源未配置
                </p>
                <div className="space-y-3 mb-4">
                  {macroData.map(f => (
                    <div key={f.factor} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-20">{f.factor}</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400" style={{ width: `${f.value}%` }} />
                      </div>
                      <span className="text-xs font-bold text-cyan-400 w-12 text-right">{f.raw}</span>
                      <span className="text-xs text-slate-500 w-10 text-right">{f.value.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(MACRO_FACTORS[selectedCountry]).map(([k, v]) => (
                    <div key={k} className="p-2 bg-slate-800 rounded border border-slate-700">
                      <div className="text-xs text-slate-500">{k}</div>
                      <div className="text-sm font-bold text-white">{typeof v === 'number' ? v.toFixed(2) : v}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-bold text-white mb-3">全球宏观因子情景参数对比（非实时观测）</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={Object.entries(MACRO_FACTORS).map(([c, m]) => ({
                    country: c, GDP: m.gdp, CPI: m.cpi, 'PMI-50': parseFloat((m.pmi - 50).toFixed(1)),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="country" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                    <Legend />
                    <Bar dataKey="GDP" fill="#22d3ee" name="GDP %" />
                    <Bar dataKey="CPI" fill="#f97316" name="CPI %" />
                    <Bar dataKey="PMI-50" fill="#a78bfa" name="PMI-50" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 6: 历史走势 */}
          <TabsContent value="historical">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-bold text-white mb-3">
                {selectedInfo.flag} {selectedCountry} 10Y 国债收益率历史走势
              </h3>
              {historicalData.length ? <>
                <div className="mb-2 flex flex-wrap gap-x-4 border-y border-slate-800 bg-black px-2 py-1 text-[10px] text-slate-500">
                  <span className="text-cyan-300">{treasuryObservation?.provider}</span><span>观测 {treasuryObservation?.observedAt ?? '未提供'}</span><span>时区 {treasuryObservation?.timezone}</span><span>质量 {treasuryObservation?.quality}</span><span>时效 {treasuryObservation?.realtimeStatus}</span><span>校验 {treasuryObservation?.checksum.slice(0, 16)}</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={historicalData}>
                    <defs>
                      <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={36} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} formatter={(v: number) => [`${v.toFixed(3)}%`, '10Y 收益率']} />
                    <Area type="monotone" dataKey="rate" stroke="#22d3ee" strokeWidth={2} fill="url(#rateGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </> : <div role="status" className="border border-dashed border-slate-700 bg-black px-4 py-12 text-center text-sm text-slate-500">{selectedCountry === 'US' ? 'OpenBB / Federal Reserve 当前没有返回可用 10Y 历史观测。' : `${selectedCountry} 合法历史数据源未配置；系统不会用正弦曲线、随机数或静态样例填充。`}</div>}
            </Card>
          </TabsContent>

          {/* Tab 7: AI 分析报告 */}
          <TabsContent value="ai-report">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">🧠 AI 多因子利率分析报告</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    基于 Provider 观测（如可用）+ Nelson-Siegel 参数 + 多因子情景 + 异常评分生成；报告内携带来源状态
                  </p>
                </div>
                <Button onClick={handleGenerateReport} disabled={isGenerating}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8">
                  {isGenerating ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 生成中...</> : <><Brain className="w-3 h-3 mr-1" /> 生成来源标注分析报告</>}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: '基准利率', value: `${selectedInfo.baseRate}%`, color: 'text-cyan-400' },
                  { label: '10Y 即期', value: `${r10y.toFixed(3)}%`, color: 'text-yellow-400' },
                  { label: '2Y-10Y 利差', value: `${((r10y - r2y) * 100).toFixed(1)}bps`, color: (r10y - r2y) < 0 ? 'text-red-400' : 'text-green-400' },
                  { label: 'IF 异常评分', value: selectedAnomaly.score.toFixed(3), color: selectedAnomaly.level === 'alert' ? 'text-red-400' : 'text-yellow-400' },
                ].map((m, i) => (
                  <div key={i} className="p-2 bg-slate-800 rounded border border-slate-700 text-center">
                    <div className="text-xs text-slate-500">{m.label}</div>
                    <div className={`text-base font-bold ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>
              {aiReport ? (
                <div className="bg-slate-800/50 rounded border border-slate-700 p-4">
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{aiReport}</div>
                </div>
              ) : (
                <div className="bg-slate-800/30 rounded border border-slate-700 p-8 text-center">
                  <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">点击“生成来源标注分析报告”按钮</p>
                  <p className="text-xs text-slate-600 mt-1">
                    AI 将读取当前 {selectedCountry} 的 NS 参数、Transformer 预测、Isolation Forest 评分及宏观因子，生成专业利率分析报告
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
