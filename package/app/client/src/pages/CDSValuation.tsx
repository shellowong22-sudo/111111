/**
 * CDSW - CDS 估值 (Credit Default Swap Valuation)
 * 真实 CDS 定价：Hazard Rate 模型、生存概率曲线、保护腿/溢价腿 PV、公平利差
 */
import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// --- CDS 定价引擎 --------------------------------------------------------------

function riskFreeDF(t: number, riskFreeRate: number): number {
  return Math.exp(-riskFreeRate * t);
}

function survivalProb(t: number, hazardRate: number): number {
  return Math.exp(-hazardRate * t);
}

function defaultDensity(t: number, hazardRate: number): number {
  return hazardRate * Math.exp(-hazardRate * t);
}

interface CDSResult {
  fairSpread: number;
  npv: number;
  protectionLegPV: number;
  premiumLegPV: number;
  dv01: number;
  hazardRate: number;
  survivalProbs: Array<{ t: number; Q: number; pd: number; label: string }>;
  cashFlows: Array<{
    period: number; date: string; t: number;
    premiumCF: number; protectionCF: number;
    df: number; Q: number; pvPremium: number; pvProtection: number;
  }>;
}

function priceCDS(
  notional: number,
  spread: number,
  tenor: number,
  recoveryRate: number,
  riskFreeRate: number,
  payFreq: number
): CDSResult {
  const spreadDecimal = spread / 10000;
  const hazardRate = spreadDecimal / (1 - recoveryRate);
  const dt = 1 / payFreq;
  const nPeriods = Math.round(tenor * payFreq);

  let protectionLegPV = 0;
  let premiumLegPV = 0;
  const cashFlows = [];

  for (let i = 1; i <= nPeriods; i++) {
    const t = i * dt;
    const tPrev = (i - 1) * dt;
    const df = riskFreeDF(t, riskFreeRate);
    const Q_t = survivalProb(t, hazardRate);
    const Q_prev = survivalProb(tPrev, hazardRate);

    const pvPremium = notional * spreadDecimal * dt * Q_t * df;
    premiumLegPV += pvPremium;

    const tMid = (t + tPrev) / 2;
    const dfMid = riskFreeDF(tMid, riskFreeRate);
    const pd = Q_prev - Q_t;
    const pvProtection = notional * (1 - recoveryRate) * pd * dfMid;
    protectionLegPV += pvProtection;

    const yr = 2024 + Math.floor(t);
    const mo = Math.round((t % 1) * 12) + 1;
    cashFlows.push({
      period: i,
      date: `${yr}-${String(mo).padStart(2, '0')}`,
      t: parseFloat(t.toFixed(3)),
      premiumCF: parseFloat((notional * spreadDecimal * dt).toFixed(2)),
      protectionCF: parseFloat((notional * (1 - recoveryRate) * pd).toFixed(2)),
      df: parseFloat(df.toFixed(6)),
      Q: parseFloat(Q_t.toFixed(6)),
      pvPremium: parseFloat(pvPremium.toFixed(2)),
      pvProtection: parseFloat(pvProtection.toFixed(2)),
    });
  }

  const annuity = premiumLegPV / spreadDecimal / notional;
  const fairSpread = protectionLegPV / (notional * annuity) * 10000;
  const npv = protectionLegPV - premiumLegPV;
  const dv01 = notional * annuity / 10000;

  const survivalProbs = Array.from({ length: Math.round(tenor * 4) + 1 }, (_, i) => {
    const t = i * 0.25;
    return {
      t,
      Q: parseFloat(survivalProb(t, hazardRate).toFixed(6)),
      pd: parseFloat(defaultDensity(t, hazardRate).toFixed(6)),
      label: t % 1 === 0 ? `${t}Y` : '',
    };
  });

  return {
    fairSpread: parseFloat(fairSpread.toFixed(2)),
    npv: parseFloat(npv.toFixed(2)),
    protectionLegPV: parseFloat(protectionLegPV.toFixed(2)),
    premiumLegPV: parseFloat(premiumLegPV.toFixed(2)),
    dv01: parseFloat(dv01.toFixed(2)),
    hazardRate: parseFloat((hazardRate * 10000).toFixed(2)),
    survivalProbs,
    cashFlows,
  };
}

// --- 参考实体数据 --------------------------------------------------------------

const REFERENCE_ENTITIES = [
  { name: 'Apple Inc', ticker: 'AAPL', rating: 'Aaa', spread5Y: 28, recovery: 0.40 },
  { name: 'JPMorgan Chase', ticker: 'JPM', rating: 'A1', spread5Y: 62, recovery: 0.40 },
  { name: 'Ford Motor', ticker: 'F', rating: 'Ba2', spread5Y: 185, recovery: 0.40 },
  { name: 'Tesla Inc', ticker: 'TSLA', rating: 'Ba1', spread5Y: 142, recovery: 0.40 },
  { name: 'US Treasury', ticker: 'UST', rating: 'Aaa', spread5Y: 8, recovery: 0.50 },
  { name: 'Italy Sovereign', ticker: 'ITALY', rating: 'Baa3', spread5Y: 135, recovery: 0.35 },
];

const TENOR_OPTIONS = [1, 2, 3, 5, 7, 10];

export default function CDSValuation() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'pricer' | 'survival' | 'cashflows' | 'scenarios' | 'ai'>('pricer');
  const [entityIdx, setEntityIdx] = useState(1);
  const [notional, setNotional] = useState('10000000');
  const [spread, setSpread] = useState('62');
  const [tenor, setTenor] = useState(5);
  const [recoveryRate, setRecoveryRate] = useState('40');
  const [riskFreeRate, setRiskFreeRate] = useState('5.25');
  const [payFreq] = useState(4);
  const [isBuyer, setIsBuyer] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const generateStrategy = trpc.derivatives.ai.generateStrategy.useMutation();

  const result = useMemo<CDSResult | null>(() => {
    const N = parseFloat(notional), s = parseFloat(spread), R = parseFloat(recoveryRate) / 100;
    const r = parseFloat(riskFreeRate) / 100;
    if ([N, s, R, r].some(v => isNaN(v)) || N <= 0 || s <= 0 || R < 0 || R >= 1) return null;
    return priceCDS(N, s, tenor, R, r, payFreq);
  }, [notional, spread, tenor, recoveryRate, riskFreeRate, payFreq]);

  const scenarioData = useMemo(() => {
    const N = parseFloat(notional), R = parseFloat(recoveryRate) / 100, r = parseFloat(riskFreeRate) / 100;
    const baseSpread = parseFloat(spread);
    if ([N, R, r, baseSpread].some(v => isNaN(v))) return [];
    return [-100, -50, -25, 0, 25, 50, 100, 200].map(bump => {
      const s = Math.max(1, baseSpread + bump);
      const res = priceCDS(N, s, tenor, R, r, payFreq);
      const sign = isBuyer ? 1 : -1;
      return {
        spread: `${s}bp`,
        npv: parseFloat((sign * res.npv / 1000).toFixed(1)),
      };
    });
  }, [notional, spread, tenor, recoveryRate, riskFreeRate, payFreq, isBuyer]);

  const termStructureData = useMemo(() => {
    const N = parseFloat(notional), s = parseFloat(spread), R = parseFloat(recoveryRate) / 100, r = parseFloat(riskFreeRate) / 100;
    if ([N, s, R, r].some(v => isNaN(v))) return [];
    return TENOR_OPTIONS.map(t => {
      const res = priceCDS(N, s, t, R, r, payFreq);
      return { tenor: `${t}Y`, fairSpread: res.fairSpread, hazardRate: res.hazardRate };
    });
  }, [notional, spread, recoveryRate, riskFreeRate, payFreq]);

  const handleAI = useCallback(async () => {
    if (!result) return;
    setAiLoading(true);
    try {
      const entity = REFERENCE_ENTITIES[entityIdx];
      const causalEvent = aiPrompt || `${entity.name} (${entity.rating}) CDS ${tenor}Y，利差 ${spread}bp，公平利差 ${result.fairSpread}bp，Hazard Rate ${result.hazardRate}bp，回收率 ${recoveryRate}%，分析信用风险和 CDS 策略`;
      const res = await generateStrategy.mutateAsync({ module: 'CDSW', moduleName: 'CDS估值', causalEvent });
      setAiResult(typeof res.strategy === 'string' ? res.strategy : JSON.stringify(res.strategy));
    } catch { toast.error('AI 分析失败'); }
    finally { setAiLoading(false); }
  }, [result, entityIdx, tenor, spread, recoveryRate, isBuyer, aiPrompt, generateStrategy]);

  const tabs = [
    { id: 'pricer' as const, label: '定价引擎' },
    { id: 'survival' as const, label: '生存概率曲线' },
    { id: 'cashflows' as const, label: '现金流' },
    { id: 'scenarios' as const, label: '情景分析' },
    { id: 'ai' as const, label: '🧠 AI 智能体' },
  ];

  const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(3)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0);
  const sign = isBuyer ? 1 : -1;
  const displayNPV = result ? sign * result.npv : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <div className="border-b border-[#1a1a2e] bg-[#0d0d1a] px-4 py-2 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-cyan-400 p-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-cyan-400 font-bold text-sm">CDSW</span>
        <span className="text-gray-500 text-xs">CDS 估值 · Credit Default Swap Valuation</span>
        <Badge variant="outline" className={`text-xs ml-auto ${isBuyer ? 'border-red-800 text-red-400' : 'border-green-800 text-green-400'}`}>
          {isBuyer ? '买保护方（空信用）' : '卖保护方（多信用）'}
        </Badge>
      </div>

      <div className="border-b border-[#1a1a2e] px-4 flex">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'pricer' && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 space-y-3">
              <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-4 space-y-3">
                <div className="text-cyan-400 text-xs font-bold">CDS 参数</div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">方向</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => setIsBuyer(true)} className={`px-2 py-1.5 text-xs rounded border ${isBuyer ? 'border-red-500 text-red-400 bg-red-950' : 'border-gray-700 text-gray-500'}`}>买保护</button>
                    <button onClick={() => setIsBuyer(false)} className={`px-2 py-1.5 text-xs rounded border ${!isBuyer ? 'border-green-500 text-green-400 bg-green-950' : 'border-gray-700 text-gray-500'}`}>卖保护</button>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">参考实体</div>
                  <div className="space-y-1">
                    {REFERENCE_ENTITIES.map((e, i) => (
                      <button key={i} onClick={() => { setEntityIdx(i); setSpread(e.spread5Y.toString()); setRecoveryRate((e.recovery * 100).toString()); }}
                        className={`w-full px-2 py-1 text-xs rounded border text-left flex justify-between ${entityIdx === i ? 'border-cyan-500 text-cyan-400 bg-cyan-950' : 'border-gray-700 text-gray-500'}`}>
                        <span>{e.ticker} ({e.rating})</span>
                        <span>{e.spread5Y}bp</span>
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { label: '名义本金', val: notional, set: setNotional },
                  { label: '信用利差 (bp)', val: spread, set: setSpread },
                  { label: '回收率 (%)', val: recoveryRate, set: setRecoveryRate },
                  { label: '无风险利率 (%)', val: riskFreeRate, set: setRiskFreeRate },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <div className="text-gray-500 text-xs mb-1">{label}</div>
                    <Input value={val} onChange={e => set(e.target.value)}
                      className="bg-[#0a0a0a] border-[#1a1a2e] text-cyan-300 text-xs h-7 font-mono" />
                  </div>
                ))}
                <div>
                  <div className="text-gray-500 text-xs mb-1">期限</div>
                  <div className="flex flex-wrap gap-1">
                    {TENOR_OPTIONS.map(t => (
                      <button key={t} onClick={() => setTenor(t)}
                        className={`px-3 py-1 text-xs rounded border ${tenor === t ? 'border-cyan-500 text-cyan-400 bg-cyan-950' : 'border-gray-700 text-gray-500'}`}>
                        {t}Y
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="col-span-8 space-y-3">
              {result ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'NPV', value: `${displayNPV >= 0 ? '+' : ''}$${fmt(displayNPV)}`, sub: isBuyer ? '买保护方视角' : '卖保护方视角', color: displayNPV >= 0 ? 'text-green-400' : 'text-red-400' },
                      { label: '公平利差', value: `${result.fairSpread} bp`, sub: `输入 ${spread}bp，差 ${(parseFloat(spread) - result.fairSpread).toFixed(1)}bp`, color: 'text-cyan-400' },
                      { label: 'DV01 (每1bp)', value: `$${fmt(result.dv01)}`, sub: '利差变动1bp的NPV变化', color: 'text-yellow-400' },
                    ].map(item => (
                      <Card key={item.label} className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
                        <div className="text-gray-500 text-xs">{item.label}</div>
                        <div className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</div>
                        <div className="text-gray-500 text-xs mt-1">{item.sub}</div>
                      </Card>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: '保护腿 PV', value: `$${fmt(result.protectionLegPV)}`, sub: `(1-R)×N×∫q(t)×df(t)dt`, color: 'text-green-400' },
                      { label: '溢价腿 PV', value: `$${fmt(result.premiumLegPV)}`, sub: `s×N×∑Q(t)×df(t)×dt`, color: 'text-red-400' },
                    ].map(item => (
                      <Card key={item.label} className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
                        <div className="text-gray-500 text-xs">{item.label}</div>
                        <div className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</div>
                        <div className="text-gray-500 text-xs mt-1 font-mono">{item.sub}</div>
                      </Card>
                    ))}
                  </div>
                  <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
                    <div className="text-cyan-400 text-xs font-bold mb-2">CDS 确认书</div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[
                        ['参考实体', REFERENCE_ENTITIES[entityIdx].ticker],
                        ['评级', REFERENCE_ENTITIES[entityIdx].rating],
                        ['名义本金', `$${(parseFloat(notional) / 1e6).toFixed(1)}M`],
                        ['利差', `${spread}bp`],
                        ['期限', `${tenor}年`],
                        ['回收率', `${recoveryRate}%`],
                        ['Hazard Rate', `${result.hazardRate}bp/年`],
                        ['违约概率', `${((1 - (result.survivalProbs[result.survivalProbs.length - 1]?.Q || 1)) * 100).toFixed(2)}%`],
                        ['公平利差', `${result.fairSpread}bp`],
                        ['DV01', `$${fmt(result.dv01)}`],
                        ['付款频率', '季付'],
                        ['方向', isBuyer ? '买保护' : '卖保护'],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-[#0a0a0a] rounded p-2">
                          <div className="text-gray-500">{k}</div>
                          <div className="text-gray-200 font-mono">{v}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-8 text-center">
                  <div className="text-gray-500 text-sm">请输入有效参数以计算 CDS 定价</div>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'survival' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
                <div className="text-cyan-400 text-xs font-bold mb-1">生存概率曲线 Q(t) = exp(-h×t)</div>
                <div className="text-gray-500 text-xs mb-2">h = {result.hazardRate}bp/年（Hazard Rate）</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.survivalProbs} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="t" tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={v => `${v}Y`} />
                      <YAxis domain={[0, 1]} tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 9 }} formatter={(v: number) => [`${(v * 100).toFixed(3)}%`, '']} />
                      <defs>
                        <linearGradient id="survGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="Q" stroke="#06b6d4" fill="url(#survGrad)" strokeWidth={2} name="生存概率" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
                <div className="text-cyan-400 text-xs font-bold mb-1">违约概率密度 q(t) = h×exp(-h×t)</div>
                <div className="text-gray-500 text-xs mb-2">累积违约概率 = 1 - Q(t)</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.survivalProbs} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="t" tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={v => `${v}Y`} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 9 }} />
                      <defs>
                        <linearGradient id="pdGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="pd" stroke="#f59e0b" fill="url(#pdGrad)" strokeWidth={2} name="违约密度" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-cyan-400 text-xs font-bold mb-2">期限结构（不同期限的公平利差）</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={termStructureData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="tenor" tick={{ fill: '#6b7280', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => `${v}bp`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 9 }} formatter={(v: number) => [`${v}bp`, '']} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line type="monotone" dataKey="fairSpread" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="公平利差(bp)" />
                    <Line type="monotone" dataKey="hazardRate" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} name="Hazard Rate(bp)" strokeDasharray="3 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'cashflows' && result && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-cyan-400 text-xs font-bold mb-2">保护腿 vs 溢价腿（PV）</div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.cashFlows.slice(0, 20)} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 8 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={v => fmt(v)} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 9 }} formatter={(v: number) => [fmt(v), '']} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar dataKey="pvProtection" name="保护腿PV" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="pvPremium" name="溢价腿PV" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-cyan-400 text-xs font-bold mb-2">现金流明细（前20期）</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#1a1a2e]">
                      {['期数', '日期', 'T', '折现因子', '生存概率Q', '溢价CF', '保护CF', 'PV溢价', 'PV保护'].map(h => (
                        <th key={h} className="text-right py-1 px-2 first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.cashFlows.slice(0, 20).map(cf => (
                      <tr key={cf.period} className="border-b border-[#0d0d1a] hover:bg-[#1a1a2e]/30">
                        <td className="py-1 px-2 text-gray-400">{cf.period}</td>
                        <td className="py-1 px-2 text-right text-gray-300">{cf.date}</td>
                        <td className="py-1 px-2 text-right text-gray-400">{cf.t}</td>
                        <td className="py-1 px-2 text-right text-gray-400">{cf.df.toFixed(4)}</td>
                        <td className="py-1 px-2 text-right text-cyan-400">{(cf.Q * 100).toFixed(3)}%</td>
                        <td className="py-1 px-2 text-right text-red-400">{fmt(cf.premiumCF)}</td>
                        <td className="py-1 px-2 text-right text-green-400">{fmt(cf.protectionCF)}</td>
                        <td className="py-1 px-2 text-right text-red-300">{fmt(cf.pvPremium)}</td>
                        <td className="py-1 px-2 text-right text-green-300">{fmt(cf.pvProtection)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-cyan-800 text-cyan-400 font-bold">
                      <td colSpan={7} className="py-1 px-2">合计</td>
                      <td className="py-1 px-2 text-right">{fmt(result.premiumLegPV)}</td>
                      <td className="py-1 px-2 text-right">{fmt(result.protectionLegPV)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-cyan-400 text-xs font-bold mb-1">NPV 对利差变化的敏感性</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="spread" tick={{ fill: '#6b7280', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => `${v}K`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 10 }} formatter={(v: number) => [`$${v}K`, 'NPV']} />
                    <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
                    <Bar dataKey="npv" name="NPV ($K)" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            {result && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '+50bp 利差扩大', value: `${isBuyer ? '+' : '-'}$${fmt(result.dv01 * 50)}`, color: isBuyer ? 'text-green-400' : 'text-red-400' },
                  { label: '-50bp 利差收窄', value: `${isBuyer ? '-' : '+'}$${fmt(result.dv01 * 50)}`, color: isBuyer ? 'text-red-400' : 'text-green-400' },
                  { label: '违约损失', value: `-$${fmt(parseFloat(notional) * (1 - parseFloat(recoveryRate) / 100))}`, color: 'text-red-400' },
                  { label: '年化保费', value: `$${fmt(parseFloat(notional) * parseFloat(spread) / 10000)}`, color: 'text-yellow-400' },
                ].map(item => (
                  <Card key={item.label} className="bg-[#0d0d1a] border-[#1a1a2e] p-3 text-center">
                    <div className="text-gray-500 text-xs">{item.label}</div>
                    <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            {result && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'NPV', value: `$${fmt(displayNPV)}`, color: displayNPV >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: '公平利差', value: `${result.fairSpread}bp`, color: 'text-cyan-400' },
                  { label: 'Hazard Rate', value: `${result.hazardRate}bp`, color: 'text-yellow-400' },
                  { label: 'DV01', value: `$${fmt(result.dv01)}`, color: 'text-purple-400' },
                ].map(item => (
                  <Card key={item.label} className="bg-[#0d0d1a] border-[#1a1a2e] p-2 text-center">
                    <div className="text-gray-500 text-xs">{item.label}</div>
                    <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
                  </Card>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '感知层（信用信号）', items: [`${REFERENCE_ENTITIES[entityIdx].name} 评级：${REFERENCE_ENTITIES[entityIdx].rating}`, `5Y CDS 利差：${spread}bp（${parseFloat(spread) > 100 ? '高风险' : parseFloat(spread) > 50 ? '中等风险' : '低风险'}）`, `公平利差 ${result?.fairSpread}bp vs 市场 ${spread}bp：${parseFloat(spread) > (result?.fairSpread || 0) ? '偏贵（买保护有利）' : '偏便宜（卖保护有利）'}`, `Hazard Rate：${result?.hazardRate}bp/年`] },
                { label: '推理层（信用因果链）', items: [`利差扩大 → 信用恶化 → ${isBuyer ? '买保护盈利' : '卖保护亏损'}`, `DV01 = $${result ? fmt(result.dv01) : '-'}，利差每变动1bp的P&L`, `保护腿PV = $${result ? fmt(result.protectionLegPV) : '-'}（违约补偿）`, `溢价腿PV = $${result ? fmt(result.premiumLegPV) : '-'}（持续支付成本）`] },
                { label: '执行层（信用策略）', items: [`${isBuyer ? '买保护对冲信用风险，适合持有债券时' : '卖保护收取溢价，适合看好信用质量时'}`, `利差曲线策略：${tenor < 5 ? '短期 CDS 流动性好' : '长期 CDS 保护更全面'}`, `CDS-债券基差套利机会`, `建议：${parseFloat(spread) > (result?.fairSpread || 0) * 1.1 ? '利差偏高，可考虑卖保护' : '利差合理，维持当前头寸'}`] },
              ].map(panel => (
                <Card key={panel.label} className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
                  <div className="text-cyan-400 text-xs font-bold mb-2">{panel.label}</div>
                  <ul className="space-y-1">
                    {panel.items.map((item, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                        <span className="text-cyan-500 mt-0.5">›</span>{item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-4">
              <div className="text-cyan-400 text-xs font-bold mb-3">AI 信用策略分析</div>
              <div className="flex gap-2 mb-3">
                <Input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  placeholder="例：当前 CDS 利差是否合理？如何用 CDS 对冲债券信用风险？"
                  className="bg-[#0a0a0a] border-[#1a1a2e] text-gray-200 text-xs h-8"
                  onKeyDown={e => e.key === 'Enter' && handleAI()} />
                <Button onClick={handleAI} disabled={aiLoading || !result}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs h-8 px-4 shrink-0">
                  {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : '分析'}
                </Button>
              </div>
              {aiResult ? (
                <div className="bg-[#0a0a0a] rounded border border-[#1a1a2e] p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{aiResult}</div>
              ) : (
                <div className="text-gray-600 text-xs text-center py-4">输入问题后点击"分析"，AI 将基于 CDS 定价参数给出专业信用策略建议</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
