/**
 * MOSO - 活跃期权监控 (Most Active Options)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实内容：期权流监控、大单扫描、Put/Call比率、隐含波动率排名、异常活动预警
 * 多维筛选：标的搜索、Call/Put/ALL、标记类型、IV范围、多列排序
 * AI增强：二阶希腊字母实时分析（服务端BSM计算，前端只展示结果）
 */
import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, AlertTriangle, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';
import { OptionChainHeatmap } from '@/components/OptionChainHeatmap';
import { trpc } from '@/lib/trpc';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';
import { useModuleLiveFeed, type ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import { displayTaiwanDerivativeUnderlyingName, formatTaiwanContractMonth, taiwanDerivativeUnderlying, taiwanOptionContractName, taiwanTradingSession } from '@shared/taiwanDerivativeNames';

// --- 活跃期权数据 -------------------------------------------------------------

type ActiveOption = {
  key: string;
  ticker: string;
  underlyingName: string;
  contractName: string;
  session: string;
  type: 'CALL' | 'PUT' | '未提供';
  strike: number | null;
  expiry: string;
  vol: number | null;
  oi: number | null;
  iv: number | null;
  premium: number | null;
  delta: number | null;
  change: number | null;
  flag: string | null;
  timestamp: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | '未提供';
  totalPremium: number | null;
  observedAt: string | null;
  quality: string;
  realtimeStatus: string;
};

type BlockTrade = {
  id: string;
  time: string;
  ticker: string;
  type: 'Call' | 'Put' | '未提供';
  strike: number | null;
  expiry: string;
  qty: number | null;
  premium: number | null;
  totalPremium: number | null;
  side: 'Buy' | 'Sell' | 'Unknown';
  iv: number | null;
  delta: number | null;
  flag: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
};

function parseOccContract(value: string) {
  const match = value.replaceAll(' ', '').toUpperCase().match(/^([A-Z.]{1,6})(\d{6})([CP])(\d{8})$/);
  if (!match) return { type: '未提供' as const, strike: null, expiry: '' };
  const [, , date, right, strike] = match;
  return {
    type: right === 'C' ? 'CALL' as const : 'PUT' as const,
    strike: Number(strike) / 1000,
    expiry: `20${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`,
  };
}

function sentimentValue(value: string): ActiveOption['sentiment'] {
  const normalized = value.toLocaleLowerCase();
  if (normalized === 'bullish' || normalized === 'bearish' || normalized === 'neutral') return normalized;
  return '未提供';
}

function mapMosoRows(items: ModuleLiveFeedItem[]) {
  const options = collectOpenBBDatasetRows(items).flatMap(row => {
    const values = row.values;
    const contract = readDatasetText(values, ['contract_symbol', 'contract', 'option_symbol'], '');
    const parsed = parseOccContract(contract);
    const ticker = readDatasetText(values, ['underlying_symbol', 'underlying', 'symbol', 'ticker'], '').toUpperCase();
    if (!ticker) return [];
    const right = readDatasetText(values, ['option_type', 'right', 'put_call', 'type'], '').toUpperCase();
    const type = right === 'CALL' || right === 'C' ? 'CALL' : right === 'PUT' || right === 'P' ? 'PUT' : parsed.type;
    const timestamp = readDatasetText(values, ['trade_timestamp', 'timestamp', 'datetime', 'date'], row.observedAt ?? '');
    const expiry = readDatasetText(values, ['expiration', 'expiry', 'expiration_date', 'contract_date', 'contract_month'], parsed.expiry);
    const strike = readDatasetNumber(values, ['strike', 'strike_price']) ?? parsed.strike;
    const tradeType = readDatasetText(values, ['trade_type', 'activity_type', 'flag'], '').toUpperCase();
    const averagePrice = readDatasetNumber(values, ['average_price', 'premium', 'price', 'last', 'close', 'value']);
    const bid = readDatasetNumber(values, ['bid_at_execution', 'bid']);
    const ask = readDatasetNumber(values, ['ask_at_execution', 'ask']);
    const sentiment = sentimentValue(readDatasetText(values, ['sentiment'], ''));
    return [{
      key: row.key,
      ticker,
      underlyingName: displayTaiwanDerivativeUnderlyingName(readDatasetText(values, ['underlying_name'], taiwanDerivativeUnderlying(ticker))),
      contractName: readDatasetText(values, ['contract_name'], taiwanOptionContractName(ticker, expiry, strike, type)),
      session: readDatasetText(values, ['trading_session', 'session'], ''),
      type,
      strike,
      expiry,
      vol: readDatasetNumber(values, ['total_size', 'volume', 'size', 'contracts']),
      oi: readDatasetNumber(values, ['open_interest', 'oi']),
      iv: readDatasetNumber(values, ['implied_volatility', 'iv']),
      premium: averagePrice,
      delta: readDatasetNumber(values, ['delta']),
      change: readDatasetNumber(values, ['change_percent', 'change_pct', 'change']),
      flag: tradeType || null,
      timestamp,
      sentiment,
      totalPremium: readDatasetNumber(values, ['total_value', 'total_premium', 'notional']),
      observedAt: row.observedAt,
      quality: row.quality,
      realtimeStatus: row.realtimeStatus,
      executionSide: averagePrice !== null && ask !== null && averagePrice >= ask ? 'Buy' as const : averagePrice !== null && bid !== null && averagePrice <= bid ? 'Sell' as const : 'Unknown' as const,
      ivRank: readDatasetNumber(values, ['iv_rank', 'ivr']),
      averageIv: readDatasetNumber(values, ['average_iv', 'avg_iv', 'iv_52w_avg']),
      benchmark: readDatasetNumber(values, ['spx', 'benchmark_value', 'underlying_index_value']),
    }];
  });
  const unique = new Map<string, (typeof options)[number]>();
  options.forEach(option => {
    const identity = `${option.ticker}:${option.timestamp}:${option.expiry}:${option.type}:${option.strike ?? ''}:${option.session}`;
    if (!unique.has(identity)) unique.set(identity, option);
  });
  const activeOptions = [...unique.values()];
  const ratioByDate = new Map<string, { date: string; calls: number; puts: number; spx: number | null }>();
  activeOptions.forEach(option => {
    const date = option.timestamp ? option.timestamp.slice(0, 10) : '';
    if (!date || !option.vol || option.type === '未提供') return;
    const point = ratioByDate.get(date) ?? { date, calls: 0, puts: 0, spx: option.benchmark };
    if (option.type === 'CALL') point.calls += option.vol;
    else point.puts += option.vol;
    if (point.spx === null) point.spx = option.benchmark;
    ratioByDate.set(date, point);
  });
  const pcRatioHistory = [...ratioByDate.values()]
    .filter(point => point.calls > 0)
    .map(point => ({ date: point.date, pcRatio: point.puts / point.calls, spx: point.spx }))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const ivRank = activeOptions
    .filter(option => option.iv !== null && (option.ivRank !== null || option.averageIv !== null))
    .map(option => ({ ticker: option.ticker, ivr: option.ivRank, iv: option.iv, avgIv: option.averageIv }))
    .sort((a, b) => (b.ivr ?? Number.NEGATIVE_INFINITY) - (a.ivr ?? Number.NEGATIVE_INFINITY));
  const blockTrades: BlockTrade[] = activeOptions.map(option => ({
    id: option.key,
    time: option.timestamp,
    ticker: option.ticker,
    type: option.type === 'CALL' ? 'Call' : option.type === 'PUT' ? 'Put' : '未提供',
    strike: option.strike,
    expiry: option.expiry,
    qty: option.vol,
    premium: option.premium,
    totalPremium: option.totalPremium,
    side: option.executionSide,
    iv: option.iv,
    delta: option.delta,
    flag: option.flag ?? '未提供',
    sentiment: option.sentiment === '未提供' ? 'neutral' : option.sentiment,
  }));
  return { activeOptions, pcRatioHistory, ivRank, blockTrades };
}

// --- 二阶希腊字母描述（仅文字，无公式）----------------------------------------
// 公式计算在服务端 server/routers/futuresOptions.ts 中完成
const GREEK_META: Record<string, { label: string; desc: string; color: string; usage: string }> = {
  Vanna:  { label: 'Vanna',  color: '#8b5cf6', desc: 'Delta 对波动率的敏感度', usage: '波动率交易者核心指标，高 Vanna 期权在波动率变化时 Delta 快速变化，适合波动率方向性交易与精准对冲。' },
  Charm:  { label: 'Charm',  color: '#06b6d4', desc: 'Delta 对时间流逝的敏感度（每日 Delta 衰减量）', usage: '用于预测 Delta 随时间的漂移，对冲者需每日调整 Delta 对冲比率。' },
  Speed:  { label: 'Speed',  color: '#f59e0b', desc: 'Gamma 对标的价格的敏感度', usage: '高 Speed 意味着 Gamma 对冲需要更频繁调整，价格大幅波动时对冲成本急剧上升。' },
  Vomma:  { label: 'Vomma',  color: '#22c55e', desc: 'Vega 对波动率的敏感度（波动率凸性）', usage: '正 Vomma 表示期权具有波动率凸性，波动率上升时 Vega 加速增大，适合做多波动率。' },
  Zomma:  { label: 'Zomma',  color: '#ec4899', desc: 'Gamma 对波动率的敏感度', usage: '衡量波动率变化对 Gamma 对冲效果的影响，波动率交易者需监控此值。' },
  Color:  { label: 'Color',  color: '#f97316', desc: 'Gamma 对时间的敏感度（每日 Gamma 衰减）', usage: '预测 Gamma 随时间的变化速率，临近到期时 Color 绝对值急剧增大。' },
  Ultima: { label: 'Ultima', color: '#a78bfa', desc: 'Vomma 对波动率的三阶导数', usage: '最高阶的波动率敏感度指标，用于极端波动率情景下的风险评估。' },
};

type SortCol = 'vol' | 'oi' | 'iv' | 'premium' | 'change' | 'delta' | 'strike';
type FlagFilter = 'ALL' | 'SWEEP' | 'BLOCK' | 'UNUSUAL' | 'NONE';

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: 'asc' | 'desc' }) {
  if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-slate-600 inline ml-0.5" />;
  return sortDir === 'desc'
    ? <ArrowDown className="w-3 h-3 text-teal-400 inline ml-0.5" />
    : <ArrowUp className="w-3 h-3 text-teal-400 inline ml-0.5" />;
}

// --- 二阶希腊字母 Tab 组件 ----------------------------------------------------
function SecondOrderGreeksTab() {
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [selectedExpiry, setSelectedExpiry] = useState(30);

  const { data: chainData, isLoading } = trpc.futuresOptions.getOptionChain.useQuery(
    { symbol: selectedSymbol, expiryDays: selectedExpiry }
  );
  const { data: underlyings } = trpc.futuresOptions.getUnderlyings.useQuery();

  // ATM row
  const atmRow = useMemo(() => {
    if (!chainData?.chain?.length || !chainData.underlying) return null;
    const S = chainData.underlying.price;
    return chainData.chain.reduce((prev, curr) =>
      Math.abs(curr.strike - S) < Math.abs(prev.strike - S) ? curr : prev
    );
  }, [chainData]);

  // Radar chart data（服务端计算值，归一化显示）
  const radarData = useMemo(() => {
    if (!atmRow) return [];
    return [
      { subject: 'Vanna',  value: Math.min(5, Math.abs(atmRow.callVanna)  * 1000) },
      { subject: 'Charm',  value: Math.min(5, Math.abs(atmRow.callCharm)  * 10000) },
      { subject: 'Speed',  value: Math.min(5, Math.abs(atmRow.callSpeed)  * 1e6) },
      { subject: 'Vomma',  value: Math.min(5, Math.abs(atmRow.callVomma)  * 100) },
      { subject: 'Zomma',  value: Math.min(5, Math.abs(atmRow.callZomma)  * 1000) },
      { subject: 'Color',  value: Math.min(5, Math.abs(atmRow.callColor)  * 1e6) },
    ];
  }, [atmRow]);

  // Vanna profile across strikes
  const vannaProfile = useMemo(() => {
    if (!chainData?.chain) return [];
    return chainData.chain.map(r => ({
      strike: r.strike,
      callVanna: parseFloat((r.callVanna * 1000).toFixed(3)),
      putVanna:  parseFloat((r.putVanna  * 1000).toFixed(3)),
    }));
  }, [chainData]);

  // Charm profile across strikes
  const charmProfile = useMemo(() => {
    if (!chainData?.chain) return [];
    return chainData.chain.map(r => ({
      strike: r.strike,
      callCharm: parseFloat((r.callCharm * 10000).toFixed(4)),
      putCharm:  parseFloat((r.putCharm  * 10000).toFixed(4)),
    }));
  }, [chainData]);

    const greekKeys: Array<keyof typeof GREEK_META> = ['Vanna', 'Charm', 'Speed', 'Vomma', 'Zomma', 'Color', 'Ultima'];

  // 看涨/看跌切换
  const [callPutSide, setCallPutSide] = useState<'call' | 'put' | 'both'>('both');

  // 自定义 Tooltip：显示行权价 + 数值
  const GreekTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#0a1510] border border-teal-700/60 rounded p-2 text-xs shadow-xl min-w-36">
        <div className="text-teal-300 font-bold mb-1.5">行权价: <span className="font-mono">{label}</span></div>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono font-bold" style={{ color: p.color }}>{typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // 按切换状态过滤 dataKey
  const showCall = callPutSide === 'call' || callPutSide === 'both';
  const showPut  = callPutSide === 'put'  || callPutSide === 'both';

  return (
    <OpenBBModuleDataBand path="/moso" title="活跃期权数据">
    {() => <div className="space-y-4">
      {/* 标的 & 到期选择 */}
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">标的</span>
            <div className="flex gap-1 flex-wrap">
              {(underlyings || []).map(u => (
                <button key={u.symbol} onClick={() => setSelectedSymbol(u.symbol)}
                  className={`px-2.5 py-1 text-xs rounded font-bold transition-colors ${
                    selectedSymbol === u.symbol
                      ? 'bg-teal-500 text-white'
                      : 'bg-[#050a08] text-slate-400 border border-[#1e2a20] hover:border-teal-500/40'
                  }`}>
                  {u.symbol}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">到期（天）</span>
            <div className="flex gap-1">
              {[7, 14, 30, 60, 90, 180].map(d => (
                <button key={d} onClick={() => setSelectedExpiry(d)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    selectedExpiry === d
                      ? 'bg-teal-500 text-white'
                      : 'bg-[#050a08] text-slate-400 border border-[#1e2a20] hover:border-teal-500/40'
                  }`}>
                  {d}D
                </button>
              ))}
            </div>
          </div>
          {chainData?.underlying && (
            <div className="ml-auto text-right">
              <div className="text-xs text-slate-500">{chainData.underlying.name}</div>
              <div className="font-mono font-bold text-teal-300 text-lg">${chainData.underlying.price.toFixed(2)}</div>
              <div className="text-xs text-slate-500">IV30: {chainData.underlying.iv30}% | IVR: {chainData.underlying.ivRank}%ile</div>
            </div>
          )}
        </div>
      </Card>

      {isLoading && (
        <div className="text-center py-12 text-slate-500 text-sm">正在从服务端加载二阶希腊字母数据…</div>
      )}

      {!isLoading && atmRow && (
        <>
          {/* ATM 二阶希腊字母摘要卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {greekKeys.map(key => {
              const meta = GREEK_META[key];
              const fieldKey = `call${key}` as keyof typeof atmRow;
              const val = atmRow[fieldKey] as number;
              const scale = key === 'Vanna' ? 1000 : key === 'Charm' ? 10000 : key === 'Speed' ? 1e6 : key === 'Color' ? 1e6 : 100;
              const displayVal = (val * scale).toFixed(3);
              return (
                <Card key={key} className="bg-[#0d1a15] border-[#1e2a20] p-3 text-center">
                  <div className="text-xs font-bold mb-1" style={{ color: meta.color }}>{meta.label}</div>
                  <div className="font-mono font-bold text-sm text-slate-200">{displayVal}</div>
                  {/* 微型折线图：展示该希腊字母跨行权价的分布 */}
                  {chainData?.chain && (
                    <div className="mt-1.5 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chainData.chain.slice(0, 20).map(r => ({
                            strike: r.strike,
                            v: parseFloat(((r[`call${key}` as keyof typeof r] as number ?? 0) * scale).toFixed(3)),
                          }))}
                          margin={{ top: 1, right: 1, left: 1, bottom: 1 }}
                        >
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={meta.color}
                            strokeWidth={1}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="text-xs text-slate-600 mt-1 leading-tight">{meta.desc.split('（')[0]}</div>
                </Card>
              );
            })}
          </div>

          {/* 雷达图 + 说明 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-teal-400">ATM 二阶希腊字母轮廓</h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e2a20" />
                  <PolarAngleAxis dataKey="subject" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} stroke="#4a5568" tick={{ fontSize: 9 }} />
                  <Radar name="ATM Greeks" dataKey="value" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
              <h3 className="text-sm font-bold text-teal-400 mb-3">希腊字母说明</h3>
              <div className="space-y-2 text-xs">
                {greekKeys.slice(0, 4).map(key => (
                  <div key={key} className="flex gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: GREEK_META[key].color }} />
                    <div>
                      <div className="font-bold" style={{ color: GREEK_META[key].color }}>{GREEK_META[key].label}</div>
                      <div className="text-slate-500">{GREEK_META[key].usage}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Vanna & Charm 对比 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-teal-400">Vanna 跨行权价分布</h3>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setCallPutSide('call')} className={`px-2 py-1 text-xs rounded ${callPutSide === 'call' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#050a08] text-slate-400 border border-[#1e2a20]'}`}>Call</button>
                  <button onClick={() => setCallPutSide('put')} className={`px-2 py-1 text-xs rounded ${callPutSide === 'put' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#050a08] text-slate-400 border border-[#1e2a20]'}`}>Put</button>
                  <button onClick={() => setCallPutSide('both')} className={`px-2 py-1 text-xs rounded ${callPutSide === 'both' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' : 'bg-[#050a08] text-slate-400 border border-[#1e2a20]'}`}>Both</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={vannaProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a20" />
                  <XAxis dataKey="strike" stroke="#4a5568" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a15', border: '1px solid #1e2a20', fontSize: 11 }} />
                  {showCall && <Line type="monotone" dataKey="callVanna" stroke="#10b981" strokeWidth={2} name="Call Vanna" dot={false} />}
                  {showPut && <Line type="monotone" dataKey="putVanna" stroke="#ef4444" strokeWidth={2} name="Put Vanna" dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
              <h3 className="text-sm font-bold text-teal-400 mb-3">Charm 跨行权价分布</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={charmProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a20" />
                  <XAxis dataKey="strike" stroke="#4a5568" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a15', border: '1px solid #1e2a20', fontSize: 11 }} />
                  {showCall && <Line type="monotone" dataKey="callCharm" stroke="#10b981" strokeWidth={2} name="Call Charm" dot={false} />}
                  {showPut && <Line type="monotone" dataKey="putCharm" stroke="#ef4444" strokeWidth={2} name="Put Charm" dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>}
    </OpenBBModuleDataBand>
  );
}

// ============================================================
// 主页面组件
// ============================================================
export default function ActiveOptionsAdvanced() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<'overview'|'unusual'|'pcratio'|'ivrank'|'blockflow'|'greeks2'|'heatmap'|'ai'>(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    const valid = ['overview', 'unusual', 'pcratio', 'ivrank', 'blockflow', 'greeks2', 'heatmap', 'ai'];
    return (t && valid.includes(t) ? t : 'overview') as 'overview';
  });
  const delivery = useModuleLiveFeed('/moso');
  const mosoData = useMemo(() => mapMosoRows(delivery.items), [delivery.items]);
  const activeOptions = mosoData.activeOptions;
  const latestObservationDate = useMemo(() => activeOptions.map(option => option.timestamp.slice(0, 10)).sort().at(-1) ?? '', [activeOptions]);
  const latestActiveOptions = useMemo(() => activeOptions
    .filter(option => option.timestamp.startsWith(latestObservationDate) && (option.vol ?? 0) > 0)
    .sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0) || a.contractName.localeCompare(b.contractName)), [activeOptions, latestObservationDate]);
  const unusualActivity = useMemo(() => activeOptions
    .filter(option => option.flag)
    .map(option => ({
      time: option.timestamp || '未提供',
      ticker: option.ticker,
      type: option.type,
      strike: option.strike,
      expiry: option.expiry || '未提供',
      sentiment: option.sentiment === 'bullish' ? '看涨' : option.sentiment === 'bearish' ? '看跌' : '中性',
      size: option.vol,
      premium: option.totalPremium,
      note: option.flag,
    })), [activeOptions]);
  const metrics = useMemo(() => {
    const volumes = latestActiveOptions.map(option => option.vol).filter((value): value is number => value !== null);
    const ivs = latestActiveOptions.map(option => option.iv).filter((value): value is number => value !== null);
    const premiums = latestActiveOptions.map(option => option.totalPremium).filter((value): value is number => value !== null);
    const calls = latestActiveOptions.reduce((sum, option) => sum + (option.type === 'CALL' && option.vol !== null ? option.vol : 0), 0);
    const puts = latestActiveOptions.reduce((sum, option) => sum + (option.type === 'PUT' && option.vol !== null ? option.vol : 0), 0);
    return {
      totalVolume: volumes.reduce((sum, value) => sum + value, 0),
      averageIv: ivs.length ? ivs.reduce((sum, value) => sum + value, 0) / ivs.length : null,
      totalPremium: premiums.reduce((sum, value) => sum + value, 0),
      pcRatio: calls > 0 ? puts / calls : null,
    };
  }, [latestActiveOptions]);
  const liveMetrics = useMemo<Record<string, string | number>>(() => ({
    数据状态: latestActiveOptions.length ? 'available' : 'unavailable',
    行情状态: '交易日汇总自动更新',
    观测条数: latestActiveOptions.length,
    总成交量: metrics.totalVolume,
    平均隐含波动率: metrics.averageIv ?? '暂无可验证观察',
    总权利金: metrics.totalPremium || '暂无可验证观察',
    P_C比率: metrics.pcRatio ?? '暂无可验证观察',
  }), [latestActiveOptions.length, metrics]);
  const formatMetric = (value: number | null, suffix = '') => value === null ? '暂无可验证观察' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
  const formatPremium = (value: number | null) => value === null ? '暂无可验证观察' : value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(0)}K` : `$${value.toFixed(2)}`;

  return (
    <div className="space-y-4">
      {/* 标题 & 返回 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/deri')} className="p-2 hover:bg-teal-500/10 rounded transition-colors">
          <ArrowLeft className="w-5 h-5 text-teal-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-teal-300">MOSO - 活跃期权监控</h1>
          <p className="text-xs text-slate-500">Most Active Options · 期权流监控 · 大单追踪 · 异常预警</p>
        </div>
      </div>

      {/* Tab 导航 */}
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-0 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto p-2">
          {[
            { id: 'overview', label: '概览', icon: '📊' },
            { id: 'unusual', label: '异常活动', icon: '⚠️' },
            { id: 'pcratio', label: 'P/C 比率', icon: '📈' },
            { id: 'ivrank', label: 'IV 排名', icon: '🔥' },
            { id: 'blockflow', label: '大单流向', icon: '💰' },
            { id: 'greeks2', label: '二阶希腊', icon: '⚙️' },
            { id: 'heatmap', label: '热力图', icon: '🔥' },
            { id: 'ai', label: 'AI 智能体', icon: '🤖' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs rounded font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-teal-400'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 内容区域 */}
      <div className="space-y-4">
        {/* 概览 Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 overflow-hidden border border-[#1e2a20] bg-[#0d1a15] md:grid-cols-4">
              {[
                { label: '总成交量', value: metrics.totalVolume ? formatMetric(metrics.totalVolume) : '暂无可验证观察' },
                { label: '平均 IV', value: formatMetric(metrics.averageIv, '%') },
                { label: '总权利金', value: metrics.totalPremium ? formatPremium(metrics.totalPremium) : '暂无可验证观察' },
                { label: 'P/C 比率', value: formatMetric(metrics.pcRatio) },
              ].map((metric) => (
                <div key={metric.label} className="border-b border-r border-[#1e2a20] px-3 py-2 last:border-r-0 md:border-b-0">
                  <div className="text-xs text-slate-500">{metric.label}</div>
                  <div className="font-mono text-base font-bold text-slate-200">{metric.value}</div>
                </div>
              ))}
              <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#1e2a20] px-3 py-1.5 text-[11px] text-slate-500 md:col-span-4">
                <span>数据口径：交易日汇总，非逐笔实时行情</span>
                <span>最新观察日：{latestObservationDate || '未提供'}</span>
                <span>自动检查：{delivery.connection === 'live' ? '已连接' : delivery.connection === 'fallback' ? '轮询中' : '连接中'}</span>
                <span>本次接收：{delivery.receivedAt ? new Date(delivery.receivedAt).toLocaleString('zh-CN', { hour12: false }) : '未提供'}（非行情时间）</span>
                <span>有成交记录：{latestActiveOptions.length}</span>
                <button type="button" onClick={() => void delivery.refetch()} className="text-teal-400 hover:text-teal-300">刷新数据</button>
              </div>
            </div>

            {/* 活跃期权表 */}
            <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
              <h3 className="text-sm font-bold text-teal-400 mb-1">最新交易日活跃期权 · {latestObservationDate || '未提供'}</h3>
              <p className="mb-3 text-[11px] text-slate-500">TXO = 台股指数选择权，标的是台湾加权股价指数；按该观察日成交量降序。报价单位为指数点，不是美元金额。</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2a20]">
                      {['合约名称 / 代码', '类型', '行权价', '到期月份', '成交量', '持仓量', 'IV', '收盘报价（点）', 'Delta', '涨跌', '时段'].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latestActiveOptions.map((o) => (
                      <tr key={o.key} className={`border-b border-[#0a1510] hover:bg-[#0a1510] transition-colors ${o.flag ? 'bg-yellow-500/5' : ''}`}>
                        <td className="px-2 py-2"><span className="block font-semibold text-teal-300">{o.contractName}</span><span className="block font-mono text-[10px] text-slate-500">{o.ticker} · {o.underlyingName}</span></td>
                        <td className="px-2 py-2">
                          <Badge className={`text-xs ${o.type === 'CALL' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{o.type}</Badge>
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-300">{o.strike ?? '—'}</td>
                        <td className="px-2 py-2 text-slate-500">{formatTaiwanContractMonth(o.expiry)}</td>
                        <td className="px-2 py-2 font-mono text-slate-300">{o.vol === null ? '—' : o.vol.toLocaleString()}</td>
                        <td className="px-2 py-2 font-mono text-slate-400">{o.oi === null ? '—' : o.oi.toLocaleString()}</td>
                        <td className={`px-2 py-2 font-mono ${o.iv === null ? 'text-slate-600' : o.iv > 50 ? 'text-red-400' : o.iv > 25 ? 'text-yellow-400' : 'text-green-400'}`}>{o.iv === null ? '—' : `${o.iv.toFixed(1)}%`}</td>
                        <td className="px-2 py-2 font-mono text-slate-300">{o.premium === null ? '—' : o.premium.toFixed(2)}</td>
                        <td className={`px-2 py-2 font-mono ${o.delta === null ? 'text-slate-600' : o.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>{o.delta === null ? '—' : o.delta.toFixed(2)}</td>
                        <td className={`px-2 py-2 font-mono ${o.change === null ? 'text-slate-600' : o.change > 0 ? 'text-green-400' : 'text-red-400'}`}>{o.change === null ? '—' : `${o.change > 0 ? '+' : ''}${o.change}%`}</td>
                        <td className="px-2 py-2">
                          <span className="text-slate-400">{taiwanTradingSession(o.session)}</span>
                        </td>
                      </tr>
                    ))}
                    {!latestActiveOptions.length && (
                      <tr><td colSpan={11} className="px-3 py-8 text-center text-amber-300">最新交易日没有可验证的成交记录；历史记录仍保留，不生成替代行情。</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 成交量柱状图（基于筛选结果） */}
            <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
              <h3 className="text-sm font-bold text-teal-400 mb-3">成交量分布（当前筛选结果）</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={latestActiveOptions.slice(0, 10).map(o => ({
                  label: `${o.ticker} ${o.type[0]}${o.strike}`,
                  vol: o.vol,
                  type: o.type,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a20" />
                  <XAxis dataKey="label" stroke="#4a5568" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={40} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a15', border: '1px solid #1e2a20', fontSize: 11 }}
                    formatter={(v: any) => [Number(v).toLocaleString(), '成交量']} />
                  <Bar dataKey="vol" fill="#14b8a6" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {/* 异常活动 Tab */}
        {activeTab === 'unusual' && (
          <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-bold text-teal-400">最新观察日异常期权活动（大单/扫单）</h3>
            </div>
            <div className="space-y-3">
              {unusualActivity.map((a, i) => (
                <div key={i} className={`p-3 rounded border ${a.sentiment === '看涨' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{a.time}</span>
                      <span className="font-bold text-teal-300">{a.ticker}</span>
                      <Badge className={`text-xs ${a.type === 'CALL' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{a.type}</Badge>
                      <span className="text-xs text-slate-400">K={a.strike} {a.expiry}</span>
                    </div>
                    <Badge className={`text-xs ${a.sentiment === '看涨' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{a.sentiment}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">数量: <span className="text-slate-200 font-mono">{a.size === null ? '—' : a.size.toLocaleString()}</span></span>
                    <span className="text-slate-400">权利金: <span className="text-yellow-400 font-mono">{formatPremium(a.premium)}</span></span>
                    <span className="text-slate-500">{a.note}</span>
                  </div>
                </div>
              ))}
              {!unusualActivity.length && <div className="py-12 text-center text-amber-300">暂未收到可验证的大单、扫单或异常活动记录。</div>}
            </div>
          </Card>
        )}

        {/* P/C 比率 Tab */}
        {activeTab === 'pcratio' && (
          <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
            <h3 className="text-sm font-bold text-teal-400 mb-3">Put/Call 比率 & SPX（近期）</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={mosoData.pcRatioHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a20" />
                <XAxis dataKey="date" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="pc" orientation="left" stroke="#14b8a6" tick={{ fontSize: 10 }} domain={[0.6, 1.4]} />
                <YAxis yAxisId="spx" orientation="right" stroke="#f59e0b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1a15', border: '1px solid #1e2a20', fontSize: 11 }} />
                <Legend />
                <ReferenceLine yAxisId="pc" y={1.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'P/C=1', fill: '#ef4444', fontSize: 10 }} />
                <Line yAxisId="pc" type="monotone" dataKey="pcRatio" stroke="#14b8a6" strokeWidth={2.5} name="P/C 比率" dot={{ r: 4 }} />
                <Line yAxisId="spx" type="monotone" dataKey="spx" stroke="#f59e0b" strokeWidth={2} name="SPX" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            {!mosoData.pcRatioHistory.length && <div className="-mt-44 mb-36 text-center text-amber-300">当前批次缺少可计算 P/C 比率的 Call/Put 成交量。</div>}
          </Card>
        )}

        {/* IV 排名 Tab */}
        {activeTab === 'ivrank' && (
          <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
            <h3 className="text-sm font-bold text-teal-400 mb-3">隐含波动率排名 (IVR) — 当前IV vs 52周均值</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mosoData.ivRank} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a20" />
                <XAxis type="number" stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="ticker" stroke="#4a5568" tick={{ fontSize: 10 }} width={45} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1a15', border: '1px solid #1e2a20', fontSize: 11 }}
                  formatter={(v: any) => [`${v}%`]} />
                <Legend />
                <Bar dataKey="iv" fill="#14b8a6" opacity={0.8} name="当前 IV" />
                <Bar dataKey="avgIv" fill="#4a5568" opacity={0.6} name="52周均值" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e2a20]">
                    {['标的', 'IVR', '当前IV', '52周均值', '信号'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mosoData.ivRank.map((r, i) => (
                    <tr key={i} className="border-b border-[#0a1510] hover:bg-[#0a1510]">
                      <td className="px-3 py-2 text-teal-300 font-bold">{r.ticker}</td>
                      <td className={`px-3 py-2 font-mono font-bold ${r.ivr === null ? 'text-slate-600' : r.ivr > 70 ? 'text-red-400' : r.ivr > 40 ? 'text-yellow-400' : 'text-green-400'}`}>{r.ivr ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{r.iv === null ? '—' : `${r.iv.toFixed(1)}%`}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">{r.avgIv === null ? '—' : `${r.avgIv.toFixed(1)}%`}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.ivr !== null && r.ivr > 70 ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30">卖权溢价</Badge> :
                         r.ivr !== null && r.ivr < 30 ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30">买权折价</Badge> :
                         <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">中性</Badge>}
                      </td>
                    </tr>
                  ))}
                  {!mosoData.ivRank.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-amber-300">当前批次缺少 IV Rank 或 52 周均值字段。</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 大单流向追踪 Tab */}
        {activeTab === 'blockflow' && <BlockFlowTracker trades={mosoData.blockTrades} connection={delivery.connection} receivedAt={delivery.receivedAt} onRefresh={() => void delivery.refetch()} />}

        {/* 二阶希腊字母 Tab */}
        {activeTab === 'greeks2' && <SecondOrderGreeksTab />}

        {/* 期权链热力图 Tab */}
        {activeTab === 'heatmap' && <OptionChainHeatmapTab />}

        {/* AI 智能体 Tab */}
        {activeTab === 'ai' && (
          <DerivativesAIPanel
            moduleCode="MOSO"
            moduleName="活跃期权监控"
            accentColor="teal"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 可验证大单流观察组件
// ============================================================
function BlockFlowTracker({
  trades,
  connection,
  receivedAt,
  onRefresh,
}: {
  trades: BlockTrade[];
  connection: 'connecting' | 'live' | 'fallback';
  receivedAt: string | null;
  onRefresh: () => void;
}) {
  const [filterTicker, setFilterTicker] = useState('');
  const [filterType, setFilterType] = useState<'All'|'Call'|'Put'>('All');
  const [filterFlag, setFilterFlag] = useState<'All'|'SWEEP'|'BLOCK'>('All');
  const [filterSentiment, setFilterSentiment] = useState<'All'|'bullish'|'bearish'|'neutral'>('All');
  const [minPremium, setMinPremium] = useState(0);
  const [strikeMin, setStrikeMin] = useState('');
  const [strikeMax, setStrikeMax] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [sortCol, setSortCol] = useState<keyof BlockTrade>('time');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (col: keyof BlockTrade) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const uniqueExpiries = useMemo(() => Array.from(new Set(trades.map(t => t.expiry))).sort(), [trades]);

  const filtered = useMemo(() => {
    let result = trades.filter(t => {
      if (filterTicker && !t.ticker.includes(filterTicker.toUpperCase())) return false;
      if (filterType !== 'All' && t.type !== filterType) return false;
      if (filterFlag !== 'All' && t.flag !== filterFlag) return false;
      if (filterSentiment !== 'All' && t.sentiment !== filterSentiment) return false;
      if (minPremium > 0 && (t.totalPremium === null || t.totalPremium < minPremium * 1e6)) return false;
      if (strikeMin && (t.strike === null || t.strike < +strikeMin)) return false;
      if (strikeMax && (t.strike === null || t.strike > +strikeMax)) return false;
      if (expiryFilter && t.expiry !== expiryFilter) return false;
      return true;
    });
    result.sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [trades, filterTicker, filterType, filterFlag, filterSentiment, minPremium, strikeMin, strikeMax, expiryFilter, sortCol, sortAsc]);

  const fmtP = (v: number | null) => v === null ? '—' : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;

  return (
    <div className="space-y-3">
      {/* 筛选器 */}
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div><div className="text-xs text-slate-500 mb-1">标的</div>
            <input type="text" value={filterTicker} onChange={e=>setFilterTicker(e.target.value)} placeholder="如 AAPL"
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5 w-20" /></div>
          <div><div className="text-xs text-slate-500 mb-1">类型</div>
            <select value={filterType} onChange={e=>setFilterType(e.target.value as any)}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5">
              <option value="All">全部</option>
              <option value="Call">Call</option>
              <option value="Put">Put</option>
            </select></div>
          <div><div className="text-xs text-slate-500 mb-1">标记</div>
            <select value={filterFlag} onChange={e=>setFilterFlag(e.target.value as any)}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5">
              <option value="All">全部</option>
              <option value="SWEEP">SWEEP</option>
              <option value="BLOCK">BLOCK</option>
            </select></div>
          <div><div className="text-xs text-slate-500 mb-1">情绪</div>
            <select value={filterSentiment} onChange={e=>setFilterSentiment(e.target.value as any)}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5">
              <option value="All">全部</option>
              <option value="bullish">看涨</option>
              <option value="bearish">看跌</option>
              <option value="neutral">中性</option>
            </select></div>
          <div><div className="text-xs text-slate-500 mb-1">行权价范围</div>
            <div className="flex gap-1">
              <input type="number" value={strikeMin} onChange={e=>setStrikeMin(e.target.value)} placeholder="最小"
                className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5 w-16" />
              <input type="number" value={strikeMax} onChange={e=>setStrikeMax(e.target.value)} placeholder="最大"
                className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5 w-16" />
            </div></div>
          <div><div className="text-xs text-slate-500 mb-1">到期日</div>
            <select value={expiryFilter} onChange={e=>setExpiryFilter(e.target.value)}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5">
              <option value="">全部</option>
              {uniqueExpiries.map(e=><option key={e} value={e}>{e}</option>)}
            </select></div>
          <div><div className="text-xs text-slate-500 mb-1">最低权利金(M)</div>
            <input type="number" value={minPremium} onChange={e=>setMinPremium(+e.target.value)} min={0} step={0.5}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5 w-20" /></div>
          <div className="ml-auto flex items-end gap-2">
            <button onClick={onRefresh}
              className="flex items-center gap-1.5 rounded border border-[#1e2a20] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-teal-500 hover:text-teal-400">
              <span className={`h-1.5 w-1.5 rounded-full ${connection === 'live' ? 'bg-teal-400' : connection === 'fallback' ? 'bg-amber-400' : 'bg-slate-600'}`}/>
              刷新数据
            </button>
            <button onClick={()=>{setFilterTicker('');setFilterType('All');setFilterFlag('All');setFilterSentiment('All');setMinPremium(0);setStrikeMin('');setStrikeMax('');setExpiryFilter('');}}
              className="px-3 py-1.5 text-xs border border-[#1e2a20] text-slate-400 rounded hover:border-teal-500 transition-colors">重置筛选</button>
          </div>
        </div>
      </Card>

      <Card className="bg-[#0d1a15] border-[#1e2a20] p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e2a20] flex items-center justify-between">
          <h3 className="text-sm font-bold text-teal-400">大单流向观察</h3>
          <span className="text-xs text-slate-500">{filtered.length} 条记录</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2a20] bg-[#0a1510]">
                {(['time','ticker','type','strike','expiry','qty','premium','totalPremium','side','iv','delta','flag','sentiment'] as (keyof BlockTrade)[]).map(col=>{
                  const labels: Record<string,string> = {time:'时间',ticker:'标的',type:'类型',strike:'行权价',expiry:'到期日',qty:'数量',premium:'单价',totalPremium:'总权利金',side:'方向',iv:'IV',delta:'Delta',flag:'标记',sentiment:'情绪'};
                  return (<th key={col} onClick={()=>handleSort(col)}
                    className="px-3 py-2 text-left text-slate-500 cursor-pointer hover:text-teal-400 select-none whitespace-nowrap">
                    {labels[col]} {sortCol===col?(sortAsc?'↑':'↓'):''}
                  </th>);
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0,30).map((t,i)=>(
                <tr key={t.id} className="border-b border-[#0a1510] transition-colors hover:bg-teal-500/5">
                  <td className="px-3 py-2 font-mono text-slate-400">{t.time}</td>
                  <td className="px-3 py-2 font-bold text-teal-300">{t.ticker}</td>
                  <td className={`px-3 py-2 font-bold ${t.type==='Call'?'text-green-400':'text-red-400'}`}>{t.type}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{t.strike === null ? '—' : `$${t.strike}`}</td>
                  <td className="px-3 py-2 text-slate-400">{t.expiry}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{t.qty === null ? '—' : t.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{t.premium === null ? '—' : `$${t.premium.toFixed(2)}`}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${t.totalPremium !== null && t.totalPremium>=2000000?'text-yellow-400':t.totalPremium !== null && t.totalPremium>=1000000?'text-teal-400':'text-slate-300'}`}>{fmtP(t.totalPremium)}</td>
                  <td className={`px-3 py-2 font-bold ${t.side==='Buy'?'text-green-400':'text-red-400'}`}>{t.side}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{t.iv === null ? '—' : `${t.iv.toFixed(1)}%`}</td>
                  <td className={`px-3 py-2 font-mono ${t.delta === null ? 'text-slate-600' : t.delta>0?'text-green-400':'text-red-400'}`}>{t.delta === null ? '—' : t.delta.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${t.flag==='SWEEP'?'bg-orange-500/20 text-orange-400':'bg-blue-500/20 text-blue-400'}`}>{t.flag}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${t.sentiment==='bullish'?'bg-green-500/20 text-green-400':t.sentiment==='bearish'?'bg-red-500/20 text-red-400':'bg-slate-500/20 text-slate-400'}`}>
                      {t.sentiment==='bullish'?'看涨':t.sentiment==='bearish'?'看跌':'中性'}
                    </span>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={13} className="px-3 py-8 text-center text-amber-300">暂未收到可验证的期权大单流。筛选、排序和页面结构保持可用。</td></tr>}
            </tbody>
          </table>
        </div>
            </Card>

      {/* Capital Flow Heatmap */}
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-teal-400">资金流向热力图</h3>
            <span className={`flex items-center gap-1 text-xs ${connection === 'live' ? 'text-teal-400' : 'text-amber-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${connection === 'live' ? 'bg-teal-400' : 'bg-amber-400'}`} />{connection === 'live' ? '自动更新通道已连接' : connection === 'fallback' ? '定时检查更新' : '连接中'}</span>
          </div>
          <span className="text-xs text-slate-500">按标的 × 情绪维度 · 已观察权利金（M），非逐笔实时</span>
        </div>
        <CapitalFlowHeatmap trades={trades} connection={connection} receivedAt={receivedAt} />
      </Card>

    </div>
  );
}

// ─── Capital Flow Heatmap ─────────────────────────────────────────────────────
function CapitalFlowHeatmap({
  trades,
  connection,
  receivedAt,
}: {
  trades: BlockTrade[];
  connection: 'connecting' | 'live' | 'fallback';
  receivedAt: string | null;
}) {
  const sentiments: Array<'bullish'|'bearish'|'neutral'> = ['bullish','bearish','neutral'];
  const sentimentLabels = { bullish:'看涨 📈', bearish:'看跌 📉', neutral:'中性 ➡️' };
  const tickers = useMemo(() => Array.from(new Set(trades.map(trade => trade.ticker))).sort(), [trades]);
  const agg = useMemo(() => {
    const result: Record<string, { bullish: number; bearish: number; neutral: number }> = {};
    tickers.forEach(ticker => { result[ticker] = { bullish: 0, bearish: 0, neutral: 0 }; });
    trades.forEach(trade => {
      if (trade.totalPremium !== null) result[trade.ticker][trade.sentiment] += trade.totalPremium;
    });
    return result;
  }, [tickers, trades]);
  const maxVal = Math.max(1, ...tickers.flatMap(ticker => Object.values(agg[ticker])));
  const getColor = (value: number, sentiment: 'bullish'|'bearish'|'neutral') => {
    if (value === 0) return 'rgba(30,42,32,0.5)';
    const intensity = Math.min(value / maxVal, 1);
    if (sentiment === 'bullish') return `rgba(16,185,129,${0.15 + intensity * 0.7})`;
    if (sentiment === 'bearish') return `rgba(239,68,68,${0.15 + intensity * 0.7})`;
    return `rgba(100,116,139,${0.15 + intensity * 0.7})`;
  };
  const fmtM = (value: number) => value >= 1e6 ? `$${(value/1e6).toFixed(1)}M` : value >= 1e3 ? `$${(value/1e3).toFixed(0)}K` : `$${value.toFixed(0)}`;

  if (!tickers.length) {
    return <div className="py-12 text-center text-amber-300">资金热力图等待可验证期权流数据。不会以固定股票或定时器生成热度。</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>更新通道：{connection === 'live' ? '已连接' : connection === 'fallback' ? '定时检查中' : '连接中'}</span>
        <span>最后接收：{receivedAt ? new Date(receivedAt).toLocaleString('zh-CN', { hour12: false }) : '未提供'}（非行情时间）</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="w-16 pb-2 pr-3 text-left text-slate-500">标的</th>
            {sentiments.map(sentiment => <th key={sentiment} className="px-2 pb-2 text-center"><span className={sentiment==='bullish'?'text-green-400':sentiment==='bearish'?'text-red-400':'text-slate-400'}>{sentimentLabels[sentiment]}</span></th>)}
            <th className="px-2 pb-2 text-center text-slate-500">净流向</th>
            <th className="pb-2 text-right text-slate-500">多空比</th>
          </tr>
        </thead>
        <tbody>
          {tickers.map(ticker => {
            const row = agg[ticker];
            const net = row.bullish - row.bearish;
            const ratio = row.bearish > 0 ? (row.bullish / row.bearish).toFixed(2) : row.bullish > 0 ? '∞' : '—';
            return (
              <tr key={ticker} className="border-t border-[#0a1510]">
                <td className="py-2 pr-3 font-bold text-teal-300">{ticker}</td>
                {sentiments.map(sentiment => <td key={sentiment} className="px-2 py-1"><div className="rounded px-2 py-2 text-center font-mono font-bold" style={{ backgroundColor: getColor(row[sentiment], sentiment), color: row[sentiment] === 0 ? '#374151' : sentiment==='bullish'?'#6ee7b7':sentiment==='bearish'?'#fca5a5':'#94a3b8' }} title={`${ticker} ${sentimentLabels[sentiment]}: ${fmtM(row[sentiment])}`}>{fmtM(row[sentiment])}</div></td>)}
                <td className="px-2 py-2 text-center"><span className={`font-mono font-bold ${net>0?'text-green-400':net<0?'text-red-400':'text-slate-400'}`}>{net>0?'+':''}{fmtM(Math.abs(net))}</span></td>
                <td className="py-2 text-right"><span className="rounded bg-slate-500/20 px-2 py-0.5 font-mono text-xs text-slate-400">{ratio}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span>颜色深度代表权利金规模</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/80" />看涨资金</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500/80" />看跌资金</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-500/80" />中性资金</span>
      </div>
    </div>
  );
}


// ============================================================
// 期权链热力图 Tab 组件
// ============================================================
function OptionChainHeatmapTab() {
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [selectedExpiry, setSelectedExpiry] = useState(30);
  const [customInput, setCustomInput] = useState('');
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  const [pendingSymbol, setPendingSymbol] = useState<string | null>(null);

  const { data: chainData, isLoading } = trpc.futuresOptions.getOptionChain.useQuery(
    { symbol: selectedSymbol, expiryDays: selectedExpiry }
  );
  const { data: underlyings } = trpc.futuresOptions.getUnderlyings.useQuery();

  // 自定义标的验证（输入提交后触发）
  const { data: validation, isFetching: validating } = trpc.futuresOptions.validateSymbol.useQuery(
    { symbol: pendingSymbol ?? '' },
    { enabled: pendingSymbol !== null, refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (!pendingSymbol || !validation) return;
    if (validation.valid) {
      const sym = validation.underlying.symbol;
      setCustomSymbols(prev => (prev.includes(sym) ? prev : [...prev, sym]));
      setSelectedSymbol(sym);
      setCustomInput('');
      setCustomError(null);
    } else {
      setCustomError(validation.message ?? '代码无效');
    }
    setPendingSymbol(null);
  }, [validation, pendingSymbol]);

  const handleCustomSubmit = () => {
    const t = customInput.trim().toUpperCase();
    if (!t) return;
    setCustomError(null);
    // 已在内置或自定义列表中则直接选中
    if ((underlyings || []).some(u => u.symbol === t) || customSymbols.includes(t)) {
      setSelectedSymbol(t);
      setCustomInput('');
      return;
    }
    setPendingSymbol(t);
  };

  if (isLoading || !chainData) {
    return (
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
        <div className="text-center py-12 text-slate-500">加载期权链数据…</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标的 & 到期选择 */}
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">标的</span>
            <div className="flex gap-1 flex-wrap">
              {(underlyings || []).map(u => (
                <button key={u.symbol} onClick={() => setSelectedSymbol(u.symbol)}
                  className={`px-2.5 py-1 text-xs rounded font-bold transition-colors ${
                    selectedSymbol === u.symbol
                      ? 'bg-teal-500 text-white'
                      : 'bg-[#050a08] text-slate-400 border border-[#1e2a20] hover:border-teal-500/40'
                  }`}>
                  {u.symbol}
                </button>
              ))}
              {customSymbols.map(sym => (
                <button key={sym} onClick={() => setSelectedSymbol(sym)}
                  className={`px-2.5 py-1 text-xs rounded font-bold transition-colors relative ${
                    selectedSymbol === sym
                      ? 'bg-amber-500 text-white'
                      : 'bg-[#050a08] text-amber-400/80 border border-amber-500/30 hover:border-amber-500/60'
                  }`}
                  title="自定义标的（点击右侧 × 移除）">
                  {sym}
                  <span
                    className="ml-1.5 text-[10px] opacity-60 hover:opacity-100"
                    onClick={e => {
                      e.stopPropagation();
                      setCustomSymbols(prev => prev.filter(s => s !== sym));
                      if (selectedSymbol === sym) setSelectedSymbol('SPY');
                    }}
                  >×</span>
                </button>
              ))}
            </div>
            {/* 自定义标的输入 */}
            <div className="flex items-center gap-1.5 mt-1">
              <input
                value={customInput}
                onChange={e => { setCustomInput(e.target.value.toUpperCase()); setCustomError(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
                placeholder="自定义代码（如 MSFT）"
                maxLength={5}
                className="w-36 px-2 py-1 text-xs font-mono bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded focus:outline-none focus:border-teal-500/60 placeholder:text-slate-600"
              />
              <button
                onClick={handleCustomSubmit}
                disabled={validating || !customInput.trim()}
                className="px-2.5 py-1 text-xs rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                {validating ? '验证中…' : '添加'}
              </button>
              {customError && <span className="text-xs text-red-400">{customError}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">到期（天）</span>
            <div className="flex gap-1">
              {[7, 14, 30, 60, 90, 180].map(d => (
                <button key={d} onClick={() => setSelectedExpiry(d)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    selectedExpiry === d
                      ? 'bg-teal-500 text-white'
                      : 'bg-[#050a08] text-slate-400 border border-[#1e2a20] hover:border-teal-500/40'
                  }`}>
                  {d}D
                </button>
              ))}
            </div>
          </div>
          {chainData?.underlying && (
            <div className="ml-auto text-right">
              <div className="text-xs text-slate-500">{chainData.underlying.name}</div>
              <div className="font-mono font-bold text-teal-300 text-lg">${chainData.underlying.price.toFixed(2)}</div>
              <div className="text-xs text-slate-500">IV30: {chainData.underlying.iv30}% | IVR: {chainData.underlying.ivRank}%ile</div>
            </div>
          )}
        </div>
      </Card>

      {/* 热力图组件 */}
      {chainData?.chain && chainData.chain.length > 0 && chainData?.underlying && chainData.underlying.iv30 != null && (
        <OptionChainHeatmap
          chain={chainData.chain}
          underlying={{
            symbol: selectedSymbol,
            price: chainData.underlying.price,
            iv30: chainData.underlying.iv30,
          }}
          isLoading={isLoading}
        />
      )}
      {!isLoading && chainData && (chainData.chain.length === 0 || !chainData.underlying || chainData.underlying.iv30 == null) && (
        <div className="border border-amber-900/60 bg-amber-950/20 px-3 py-4 text-center text-xs text-amber-200">
          {chainData.reason}
        </div>
      )}
    </div>
  );
}
