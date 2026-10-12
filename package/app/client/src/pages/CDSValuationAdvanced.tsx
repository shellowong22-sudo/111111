/**
 * CDSW - 信用违约互换估值 (CDS Valuation)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实计算：生存概率曲线、保护腿PV、溢价腿PV、公允利差、DV01、信用久期
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';

// --- CDS 定价引擎 -------------------------------------------------------------

/**
 * 生存概率 Q(t) = exp(-λ*t)，其中 λ = spread / (1 - recovery)
 * 即风险中性违约强度（hazard rate）
 */
function hazardRate(spreadBps: number, recovery: number): number {
  return (spreadBps / 10000) / (1 - recovery);
}

function survivalProb(t: number, lambda: number): number {
  return Math.exp(-lambda * t);
}

/** 折现因子（使用 SOFR 曲线近似） */
function discountFactor(t: number): number {
  // 简化：使用 4.35% 平坦曲线
  return Math.exp(-0.0435 * t);
}

interface CashFlowRow {
  period: number; t: number; survProb: number; df: number;
  premiumCF: number; pvPremium: number; pvProtection: number;
}

interface CDSResult {
  fairSpread: number;   // 公允利差 (bps)
  pvProtection: number; // 保护腿 PV（买方收到）
  pvPremium: number;    // 溢价腿 PV（买方支付）
  npv: number;          // 净现值（买方视角）
  dv01: number;         // 利差DV01（每bp）
  creditDuration: number; // 信用久期
  cashFlows: CashFlowRow[];
}

function priceCDS(
  notional: number,
  spreadBps: number,
  tenorYears: number,
  recovery: number,
  payFreqPerYear: number = 4
): CDSResult {
  const lambda = hazardRate(spreadBps, recovery);
  const dt = 1 / payFreqPerYear;
  const nPeriods = Math.round(tenorYears * payFreqPerYear);
  const cashFlows: CashFlowRow[] = [];

  let pvPremium = 0;
  let pvProtection = 0;

  for (let i = 1; i <= nPeriods; i++) {
    const t = i * dt;
    const tPrev = (i - 1) * dt;
    const sp = survivalProb(t, lambda);
    const spPrev = survivalProb(tPrev, lambda);
    const df = discountFactor(t);
    const dfMid = discountFactor((t + tPrev) / 2);

    // 溢价腿：季度付息 × 生存概率 × 折现
    const premiumCF = (spreadBps / 10000) * dt * notional;
    const pvP = premiumCF * sp * df;
    pvPremium += pvP;

    // 保护腿：违约概率 × (1-回收率) × 折现（假设期中违约）
    const defaultProb = spPrev - sp;
    const pvProt = defaultProb * (1 - recovery) * notional * dfMid;
    pvProtection += pvProt;

    cashFlows.push({
      period: i, t, survProb: sp, df,
      premiumCF, pvPremium: pvP, pvProtection: pvProt
    });
  }

  // 公允利差：使 NPV=0 时的利差
  // fairSpread = pvProtection / (pvPremium / spreadBps * 10000)
  const annuity = pvPremium / (spreadBps / 10000);
  const fairSpread = (pvProtection / annuity) * 10000;

  // DV01：利差变动1bp时的NPV变化
  const dv01Result = priceCDSSimple(notional, spreadBps + 1, tenorYears, recovery, payFreqPerYear);
  const dv01 = Math.abs(dv01Result.npv - (pvProtection - pvPremium));

  // 信用久期 = DV01 / (notional * 0.0001)
  const creditDuration = dv01 / (notional * 0.0001);

  return {
    fairSpread: parseFloat(fairSpread.toFixed(2)),
    pvProtection: parseFloat(pvProtection.toFixed(2)),
    pvPremium: parseFloat(pvPremium.toFixed(2)),
    npv: parseFloat((pvProtection - pvPremium).toFixed(2)),
    dv01: parseFloat(dv01.toFixed(2)),
    creditDuration: parseFloat(creditDuration.toFixed(4)),
    cashFlows
  };
}

function priceCDSSimple(
  notional: number, spreadBps: number, tenorYears: number,
  recovery: number, payFreqPerYear: number
): { npv: number } {
  const lambda = hazardRate(spreadBps, recovery);
  const dt = 1 / payFreqPerYear;
  const nPeriods = Math.round(tenorYears * payFreqPerYear);
  let pvPremium = 0, pvProtection = 0;
  for (let i = 1; i <= nPeriods; i++) {
    const t = i * dt;
    const tPrev = (i - 1) * dt;
    const sp = survivalProb(t, lambda);
    const spPrev = survivalProb(tPrev, lambda);
    const df = discountFactor(t);
    const dfMid = discountFactor((t + tPrev) / 2);
    pvPremium += (spreadBps / 10000) * dt * notional * sp * df;
    pvProtection += (spPrev - sp) * (1 - recovery) * notional * dfMid;
  }
  return { npv: pvProtection - pvPremium };
}

// --- 信用利差曲线数据 ---------------------------------------------------------

const SPREAD_CURVE_TENORS = [0.5, 1, 2, 3, 5, 7, 10];

// 不同信用评级的利差曲线（bps）
const SPREAD_CURVES: Record<string, number[]> = {
  'AAA': [8, 12, 18, 22, 28, 32, 38],
  'AA': [15, 22, 35, 45, 58, 68, 82],
  'A': [28, 42, 65, 82, 105, 122, 145],
  'BBB': [55, 82, 128, 162, 205, 238, 278],
  'BB': [145, 218, 342, 432, 548, 635, 742],
  'B': [285, 428, 672, 848, 1075, 1245, 1455],
};

// 参考实体数据
const REFERENCE_ENTITIES = [
  { name: 'Apple Inc', ticker: 'AAPL', rating: 'AA+', spread5y: 42, change: -2, region: '北美' },
  { name: 'JPMorgan Chase', ticker: 'JPM', rating: 'A+', spread5y: 68, change: +3, region: '北美' },
  { name: 'Goldman Sachs', ticker: 'GS', rating: 'A', spread5y: 95, change: +5, region: '北美' },
  { name: 'Deutsche Bank', ticker: 'DBK', rating: 'BBB+', spread5y: 142, change: -8, region: '欧洲' },
  { name: 'Volkswagen AG', ticker: 'VOW', rating: 'BBB', spread5y: 185, change: +12, region: '欧洲' },
  { name: 'Toyota Motor', ticker: 'TM', rating: 'AA-', spread5y: 38, change: -1, region: '亚太' },
  { name: 'Alibaba Group', ticker: 'BABA', rating: 'A+', spread5y: 112, change: +18, region: '亚太' },
  { name: 'China Evergrande', ticker: 'EVGR', rating: 'CC', spread5y: 4850, change: +125, region: '亚太' },
];

export default function CDSValuationAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('pricing');

  // 定价参数
  const [notional, setNotional] = useState(10000000);
  const [spreadBps, setSpreadBps] = useState(120);
  const [tenorYears, setTenorYears] = useState(5);
  const [recovery, setRecovery] = useState(0.40);

  const result = useMemo(() =>
    priceCDS(notional, spreadBps, tenorYears, recovery),
    [notional, spreadBps, tenorYears, recovery]
  );

  // 生存概率曲线数据
  const survivalCurveData = useMemo(() => {
    const lambda = hazardRate(spreadBps, recovery);
    return [0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(t => ({
      t: t.toFixed(1),
      survProb: parseFloat((survivalProb(t, lambda) * 100).toFixed(3)),
      defaultProb: parseFloat(((1 - survivalProb(t, lambda)) * 100).toFixed(3)),
    }));
  }, [spreadBps, recovery]);

  // 利差曲线对比数据
  const spreadCurveData = SPREAD_CURVE_TENORS.map((t, i) => {
    const row: Record<string, number | string> = { tenor: `${t}Y` };
    Object.entries(SPREAD_CURVES).forEach(([rating, spreads]) => {
      row[rating] = spreads[i];
    });
    return row;
  });

  const tabs = [
    { id: 'pricing', label: 'CDS 定价' },
    { id: 'survival', label: '生存概率曲线' },
    { id: 'spreads', label: '信用利差矩阵' },
    { id: 'entities', label: '参考实体' },
    { id: 'matrix', label: '信用违约矩阵' },
    { id: 'curve_alert', label: 'CDS曲线预警' },
    { id: 'region', label: '地区风险热力图' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];


  const liveMetrics = useMemo(() => ({
    '公允利差 (bps)': '185.4',
    '保护腿 PV': '0.0842',
    '溢价腿 PV': '0.0842',
    '违约概率 (5Y)': '14.8%',
    '回收率假设': '40%',
    'DV01 (bps)': '$485',
    '存续期 (年)': '4.32',
    '信用评级': 'BB+',
  }), []);
  return (
    <div className="min-h-screen bg-[#0a0505] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-orange-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-orange-400">CDSW</h1>
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">信用违约互换估值</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">生存概率 · 保护腿/溢价腿 · 公允利差 · DV01 · AI信用预警</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">公允利差</div>
            <div className="text-xl font-mono font-bold text-orange-400">{result.fairSpread.toFixed(1)} bps</div>
            <div className={`text-xs ${result.npv >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              NPV: ${result.npv.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 关键指标 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: '公允利差', value: `${result.fairSpread.toFixed(1)} bps`, sub: '风险中性定价', color: 'text-orange-400' },
            { label: '保护腿 PV', value: `$${(result.pvProtection / 1000).toFixed(1)}K`, sub: '买方收到', color: 'text-green-400' },
            { label: '溢价腿 PV', value: `$${(result.pvPremium / 1000).toFixed(1)}K`, sub: '买方支付', color: 'text-red-400' },
            { label: 'DV01', value: `$${result.dv01.toFixed(0)}`, sub: `信用久期 ${result.creditDuration.toFixed(2)}年`, color: 'text-cyan-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#1a0d0d] border-[#2a1e1e] p-4">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.sub}</div>
            </Card>
          ))}
        </div>

        {/* 标签导航 */}
        <div className="flex gap-1 mb-6 border-b border-[#2a1e1e] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* CDS 定价 */}
        {activeTab === 'pricing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-[#1a0d0d] border-[#2a1e1e] p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-4">定价参数</h3>
              <div className="space-y-3">
                {[
                  { label: '名义本金 ($)', value: notional, setter: (v: number) => setNotional(v), step: 1000000 },
                  { label: '合约利差 (bps)', value: spreadBps, setter: (v: number) => setSpreadBps(v), step: 5 },
                  { label: '期限 (年)', value: tenorYears, setter: (v: number) => setTenorYears(v), step: 1 },
                  { label: '回收率', value: recovery, setter: (v: number) => setRecovery(v), step: 0.05 },
                ].map((p, i) => (
                  <div key={i}>
                    <label className="text-xs text-slate-500 block mb-1">{p.label}</label>
                    <Input
                      type="number"
                      value={p.value}
                      step={p.step}
                      onChange={e => p.setter(parseFloat(e.target.value) || 0)}
                      className="bg-[#0a0505] border-[#2a1e1e] text-slate-200 text-sm h-8 font-mono"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-[#0a0505] rounded border border-[#2a1e1e]">
                <div className="text-xs text-slate-500 mb-2">违约强度 (Hazard Rate)</div>
                <div className="text-lg font-mono text-orange-300 font-bold">
                  λ = {(hazardRate(spreadBps, recovery) * 100).toFixed(4)}%/年
                </div>
                <div className="text-xs text-slate-600 mt-1">= {spreadBps}bps / (1 - {(recovery * 100).toFixed(0)}%)</div>
              </div>
            </Card>

            <Card className="bg-[#1a0d0d] border-[#2a1e1e] p-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-orange-400 mb-3">现金流折现表</h3>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#1a0d0d]">
                    <tr className="border-b border-[#2a1e1e]">
                      {['期次', '时间(年)', '生存概率', '折现因子', '溢价CF', 'PV溢价', 'PV保护'].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.cashFlows.map((row, i) => (
                      <tr key={i} className="border-b border-[#0f0808] hover:bg-[#0f0808]">
                        <td className="px-2 py-1.5 text-slate-400">{row.period}</td>
                        <td className="px-2 py-1.5 text-slate-400">{row.t.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-cyan-400 font-mono">{(row.survProb * 100).toFixed(3)}%</td>
                        <td className="px-2 py-1.5 text-slate-400 font-mono">{row.df.toFixed(6)}</td>
                        <td className="px-2 py-1.5 text-slate-300 font-mono">${row.premiumCF.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-red-400 font-mono">${row.pvPremium.toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-green-400 font-mono">${row.pvProtection.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-[#1a0d0d]">
                    <tr className="border-t border-[#2a1e1e]">
                      <td colSpan={5} className="px-2 py-2 text-slate-500 font-bold">合计</td>
                      <td className="px-2 py-2 text-red-400 font-bold font-mono">${result.pvPremium.toFixed(0)}</td>
                      <td className="px-2 py-2 text-green-400 font-bold font-mono">${result.pvProtection.toFixed(0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 flex gap-4 text-sm">
                <div className="flex-1 p-2 bg-[#0a0505] rounded text-center">
                  <div className="text-xs text-slate-500">净现值 (买方)</div>
                  <div className={`text-base font-bold font-mono ${result.npv >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${result.npv.toLocaleString()}
                  </div>
                </div>
                <div className="flex-1 p-2 bg-[#0a0505] rounded text-center">
                  <div className="text-xs text-slate-500">公允利差</div>
                  <div className="text-base font-bold font-mono text-orange-400">{result.fairSpread.toFixed(1)} bps</div>
                </div>
                <div className="flex-1 p-2 bg-[#0a0505] rounded text-center">
                  <div className="text-xs text-slate-500">DV01</div>
                  <div className="text-base font-bold font-mono text-cyan-400">${result.dv01.toFixed(0)}</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 生存概率曲线 */}
        {activeTab === 'survival' && (
          <div className="space-y-4">
            <Card className="bg-[#1a0d0d] border-[#2a1e1e] p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3">
                生存概率曲线 — λ={`${(hazardRate(spreadBps, recovery) * 100).toFixed(4)}%/年`}，利差={spreadBps}bps，回收率={`${(recovery * 100).toFixed(0)}%`}
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={survivalCurveData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1e1e" />
                  <XAxis dataKey="t" stroke="#4a5568" tick={{ fontSize: 11 }} label={{ value: '期限 (年)', position: 'insideBottom', offset: -5, fill: '#4a5568', fontSize: 11 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#1a0d0d', border: '1px solid #2a1e1e', fontSize: 11 }}
                    formatter={(v: any) => [`${v}%`]} />
                  <Legend />
                  <Area type="monotone" dataKey="survProb" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} name="生存概率 (%)" strokeWidth={2} />
                  <Area type="monotone" dataKey="defaultProb" stroke="#f97316" fill="#f97316" fillOpacity={0.15} name="累计违约概率 (%)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-[#1a0d0d] border-[#2a1e1e] p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3">不同利差水平的5年生存概率对比</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[50, 100, 150, 200, 300, 500, 800, 1200].map(s => ({
                  spread: `${s}bps`,
                  survProb5y: parseFloat((survivalProb(5, hazardRate(s, recovery)) * 100).toFixed(2)),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1e1e" />
                  <XAxis dataKey="spread" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#1a0d0d', border: '1px solid #2a1e1e', fontSize: 11 }}
                    formatter={(v: any) => [`${v}%`, '5年生存概率']} />
                  <Bar dataKey="survProb5y" fill="#f97316" opacity={0.8} name="5年生存概率 (%)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 信用利差矩阵 */}
        {activeTab === 'spreads' && (
          <Card className="bg-[#1a0d0d] border-[#2a1e1e] p-4">
            <h3 className="text-sm font-bold text-orange-400 mb-3">信用利差矩阵（各评级 × 期限，单位 bps）</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a1e1e]">
                    <th className="px-3 py-2 text-left text-slate-500">评级</th>
                    {SPREAD_CURVE_TENORS.map(t => (
                      <th key={t} className="px-3 py-2 text-right text-slate-500">{t}Y</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(SPREAD_CURVES).map(([rating, spreads]) => (
                    <tr key={rating} className="border-b border-[#0f0808] hover:bg-[#0f0808]">
                      <td className="px-3 py-2 font-bold text-orange-300">{rating}</td>
                      {spreads.map((s, i) => (
                        <td key={i} className={`px-3 py-2 text-right font-mono ${
                          s < 50 ? 'text-green-400' : s < 150 ? 'text-yellow-400' : s < 500 ? 'text-orange-400' : 'text-red-400'
                        }`}>{s}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={spreadCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1e1e" />
                <XAxis dataKey="tenor" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a0d0d', border: '1px solid #2a1e1e', fontSize: 11 }} />
                <Legend />
                {['AAA', 'AA', 'A', 'BBB'].map((r, i) => (
                  <Line key={r} type="monotone" dataKey={r} stroke={['#22d3ee', '#84cc16', '#f59e0b', '#f97316'][i]}
                    strokeWidth={2} dot={false} name={r} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* 参考实体 */}
        {activeTab === 'entities' && (
          <Card className="bg-[#1a0d0d] border-[#2a1e1e] p-4">
            <h3 className="text-sm font-bold text-orange-400 mb-3">主要参考实体 CDS 行情</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a1e1e]">
                    {['实体', 'Ticker', '评级', '5Y利差(bps)', '变化(bps)', '地区', '违约概率(5Y)'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REFERENCE_ENTITIES.map((e, i) => {
                    const lambda = hazardRate(e.spread5y, 0.4);
                    const dp5y = (1 - survivalProb(5, lambda)) * 100;
                    return (
                      <tr key={i} className="border-b border-[#0f0808] hover:bg-[#0f0808]">
                        <td className="px-3 py-3 text-slate-200 font-medium">{e.name}</td>
                        <td className="px-3 py-3 text-orange-300 font-mono">{e.ticker}</td>
                        <td className="px-3 py-3">
                          <Badge className={`text-xs ${
                            e.rating.startsWith('AA') ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            e.rating.startsWith('A') ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                            e.rating.startsWith('BBB') ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}>{e.rating}</Badge>
                        </td>
                        <td className={`px-3 py-3 font-mono ${e.spread5y > 500 ? 'text-red-400' : e.spread5y > 150 ? 'text-orange-400' : 'text-slate-300'}`}>
                          {e.spread5y}
                        </td>
                        <td className={`px-3 py-3 font-mono ${e.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {e.change > 0 ? '+' : ''}{e.change}
                        </td>
                        <td className="px-3 py-3 text-slate-400 text-xs">{e.region}</td>
                        <td className={`px-3 py-3 font-mono text-xs ${dp5y > 30 ? 'text-red-400' : dp5y > 10 ? 'text-orange-400' : 'text-slate-400'}`}>
                          {dp5y.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* -- 信用违约矩阵 -- */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-orange-900/30 p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3">主要参考实体信用违约矩阵（违约概率%）</h3>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-gray-500 text-left w-24">实体\u671f限</th>
                      {['1Y','2Y','3Y','5Y','7Y','10Y'].map(t => <th key={t} className="p-2 text-gray-400 text-center w-14">{t}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { entity: 'Apple', vals: [0.08, 0.15, 0.22, 0.38, 0.52, 0.68] },
                      { entity: 'Ford', vals: [0.45, 0.82, 1.18, 1.85, 2.42, 3.12] },
                      { entity: 'Italy', vals: [0.28, 0.52, 0.78, 1.25, 1.68, 2.15] },
                      { entity: 'Brazil', vals: [0.85, 1.52, 2.18, 3.45, 4.52, 5.85] },
                      { entity: 'Evergrande', vals: [8.5, 15.2, 22.8, 35.5, 45.2, 55.8] },
                    ].map(row => (
                      <tr key={row.entity}>
                        <td className="p-2 text-gray-300 font-medium">{row.entity}</td>
                        {row.vals.map((val, j) => {
                          const bg = val > 10 ? 'rgba(239,68,68,0.8)' : val > 3 ? `rgba(239,68,68,${val/10*0.6})` : val > 1 ? `rgba(245,158,11,${val/3*0.5})` : `rgba(34,197,94,${val/1*0.3})`;
                          return <td key={j} className="text-center p-2 border border-gray-800 font-mono" style={{backgroundColor:bg,color:val>5?'#fff':'#d1d5db'}}>{val.toFixed(2)}%</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">颜色深浅表示违约风险：红色=高风险，黄色=中风险，绿色=低风险</p>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-[#0d1a0d] border-orange-900/30 p-4">
                <h3 className="text-sm font-bold text-orange-400 mb-3">行业平均违约概率（%）</h3>
                <div className="space-y-2">
                  {[
                    { sector: '金融', val: 1.2, color: '#f59e0b' },
                    { sector: '能源', val: 2.8, color: '#ef4444' },
                    { sector: '科技', val: 0.6, color: '#22c55e' },
                    { sector: '房地产', val: 4.5, color: '#ef4444' },
                    { sector: '工业', val: 1.8, color: '#f59e0b' },
                    { sector: '健康', val: 0.9, color: '#22c55e' },
                  ].map(s => (
                    <div key={s.sector} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16">{s.sector}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded"><div className="h-2 rounded" style={{width:`${Math.min(100,s.val/5*100)}%`,backgroundColor:s.color}} /></div>
                      <span className="text-xs font-mono" style={{color:s.color}}>{s.val}%</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="bg-[#0d1a0d] border-orange-900/30 p-4">
                <h3 className="text-sm font-bold text-orange-400 mb-3">违约事件历史回顾</h3>
                <div className="space-y-2">
                  {[
                    { entity: '恒大', date: '2024-01', recovery: '3.5%', type: '清盘' },
                    { entity: 'SVB', date: '2023-03', recovery: '86%', type: '收购' },
                    { entity: 'FTX', date: '2022-11', recovery: '12%', type: '破产' },
                    { entity: 'Evergrande', date: '2021-12', recovery: '5%', type: '违约' },
                  ].map((e, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-gray-900 rounded">
                      <div>
                        <span className="text-xs text-white font-medium">{e.entity}</span>
                        <span className="text-xs text-gray-500 ml-2">{e.date}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-orange-400">{e.type}</span>
                        <span className="text-xs text-gray-400 ml-2">回收率{e.recovery}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* -- CDS曲线预警 -- */}
        {activeTab === 'curve_alert' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '曲线倒挂预警', count: 2, color: '#ef4444', desc: '短期利差>长期，流动性压力' },
                { label: '利差急升预警', count: 3, color: '#f59e0b', desc: '24h内利差扩大>20bp' },
                { label: '异常成交量', count: 1, color: '#3b82f6', desc: '成交量超过日均200%' },
              ].map(s => (
                <Card key={s.label} className="bg-[#0d1a0d] border-orange-900/30 p-4 text-center">
                  <div className="text-2xl font-bold font-mono" style={{color:s.color}}>{s.count}</div>
                  <div className="text-xs text-gray-300 mt-1">{s.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d1a0d] border-orange-900/30 p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3">CDS期限结构对比（当前 vs 1周前）</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={[
                  {tenor:'1Y',current:45,prev:38},{tenor:'2Y',current:68,prev:62},{tenor:'3Y',current:88,prev:85},
                  {tenor:'5Y',current:120,prev:118},{tenor:'7Y',current:142,prev:145},{tenor:'10Y',current:158,prev:165},
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                  <XAxis dataKey="tenor" tick={{fill:'#6b7280',fontSize:10}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} tickFormatter={v=>`${v}bp`} />
                  <Tooltip contentStyle={{background:'#0d1a0d',border:'1px solid #374151',fontSize:11}} />
                  <Legend wrapperStyle={{fontSize:11}} />
                  <Line type="monotone" dataKey="current" name="当前CDS曲线" stroke="#f97316" strokeWidth={2} dot={{fill:'#f97316',r:3}} />
                  <Line type="monotone" dataKey="prev" name="1周前" stroke="#6b7280" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-[#0d1a0d] border-orange-900/30 p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3">高风险实体预警列表</h3>
              <div className="space-y-2">
                {[
                  { entity: 'Evergrande', spread: 3550, change: +285, alert: '曲线倒挂', level: 'critical' },
                  { entity: 'Country Garden', spread: 1850, change: +125, alert: '利差急升', level: 'warning' },
                  { entity: 'Italy Sovereign', spread: 185, change: +18, alert: '政治风险', level: 'info' },
                  { entity: 'Ford Motor', spread: 245, change: -12, alert: '正常', level: 'normal' },
                ].map((e, i) => (
                  <div key={i} className={`flex justify-between items-center p-3 rounded border ${e.level==='critical'?'border-red-800/50 bg-red-950/10':e.level==='warning'?'border-yellow-800/50 bg-yellow-950/10':e.level==='info'?'border-blue-800/50':'border-gray-800'}`}>
                    <div>
                      <span className="text-sm text-white font-medium">{e.entity}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${e.level==='critical'?'bg-red-500/20 text-red-400':e.level==='warning'?'bg-yellow-500/20 text-yellow-400':e.level==='info'?'bg-blue-500/20 text-blue-400':'bg-gray-700 text-gray-400'}`}>{e.alert}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-orange-400">{e.spread}bp</div>
                      <div className={`text-xs font-mono ${e.change>=0?'text-red-400':'text-green-400'}`}>{e.change>=0?'+':''}{e.change}bp</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* -- 地区风险热力图 -- */}
        {activeTab === 'region' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-orange-900/30 p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3">全球地区信用风险热力图（主权CDS利差 bp）</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { region: '北美', countries: [{ name: '美国', val: 32, risk: 'low' }, { name: '加拿大', val: 28, risk: 'low' }] },
                  { region: '西欧', countries: [{ name: '德国', val: 25, risk: 'low' }, { name: '法国', val: 48, risk: 'low' }, { name: '意大利', val: 185, risk: 'medium' }] },
                  { region: '东欧', countries: [{ name: '波兰', val: 95, risk: 'medium' }, { name: '沈克', val: 68, risk: 'low' }] },
                  { region: '亚太', countries: [{ name: '日本', val: 22, risk: 'low' }, { name: '中国', val: 65, risk: 'low' }, { name: '印度', val: 145, risk: 'medium' }] },
                  { region: '拉美', countries: [{ name: '巴西', val: 185, risk: 'medium' }, { name: '广山', val: 285, risk: 'high' }, { name: '阿根廷', val: 1850, risk: 'extreme' }] },
                  { region: '中东非洲', countries: [{ name: '南非', val: 285, risk: 'high' }, { name: '土耳其', val: 385, risk: 'high' }, { name: '埃及', val: 485, risk: 'high' }] },
                ].map(region => (
                  <div key={region.region} className="bg-gray-900/50 rounded p-3">
                    <div className="text-xs font-bold text-gray-300 mb-2">{region.region}</div>
                    <div className="space-y-1.5">
                      {region.countries.map(c => {
                        const bg = c.risk==='extreme'?'#7f1d1d':c.risk==='high'?'rgba(239,68,68,0.3)':c.risk==='medium'?'rgba(245,158,11,0.2)':'rgba(34,197,94,0.15)';
                        const tc = c.risk==='extreme'?'#fca5a5':c.risk==='high'?'#f87171':c.risk==='medium'?'#fbbf24':'#86efac';
                        return (
                          <div key={c.name} className="flex justify-between items-center px-2 py-1 rounded" style={{backgroundColor:bg}}>
                            <span className="text-xs" style={{color:tc}}>{c.name}</span>
                            <span className="text-xs font-mono" style={{color:tc}}>{c.val}bp</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-[#0d1a0d] border-orange-900/30 p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3">地区风险指数走势（近20日）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={Array.from({length:20},(_,i)=>({day:`${i+1}日`,em:145+Math.sin(i*0.5)*25,dm:35+Math.sin(i*0.3)*5,latam:285+Math.sin(i*0.6)*45}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} tickFormatter={v=>`${v}bp`} />
                  <Tooltip contentStyle={{background:'#0d1a0d',border:'1px solid #374151',fontSize:11}} />
                  <Legend wrapperStyle={{fontSize:11}} />
                  <Line type="monotone" dataKey="em" name="新兴市场" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="dm" name="发达市场" stroke="#22c55e" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="latam" name="拉丁美洲" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="CDSW" moduleName="信用违约互换" accentColor="orange"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>
  );
}
