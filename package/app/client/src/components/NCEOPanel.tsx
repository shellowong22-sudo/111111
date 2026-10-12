import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { NceoOptionsCard } from '@/components/live/NceoOptionsLive';

type Direction = 'long' | 'short';
type ContractSelection = { strike: number; isCall: boolean };
type PositionRow = { id: number; createdAt: string | Date; direction: Direction; symbol: string; contract: string; referencePrice: number; quantity: number; model: string; pending?: boolean };
type SpreadKind = 'long_call' | 'long_put' | 'bull_call' | 'bear_put' | 'straddle' | 'strangle';
type SpreadLeg = { label: string; action: '模型买入' | '模型卖出'; strike: number; isCall: boolean; premium: number };

const expiryOptions = [7, 30, 60, 90];
const sourceBoundary = '仅保存用户主动创建的 NCEO 模拟研究记录；不代表交易所成交、券商账户、真实持仓、可执行委托或监管报送。';
const spreadLabels: Record<SpreadKind, string> = { long_call: '单腿看涨', long_put: '单腿看跌', bull_call: '牛市价差', bear_put: '熊市价差', straddle: '跨式', strangle: '勒式' };
const money = (value: number | null | undefined) => Number.isFinite(value) ? `$${Number(value).toFixed(2)}` : '—';
const number = (value: number | null | undefined, digits = 2) => Number.isFinite(value) ? Number(value).toFixed(digits) : '—';

function exportNceoCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

function createdText(value: string | Date) { return new Date(value).toLocaleString('zh-CN'); }

/** NCEO — model/simulation-only enhanced option research; never routes an order. */
export default function NCEOPanel({ onClose, initialSymbol = 'SPY' }: { onClose?: () => void; initialSymbol?: string }) {
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const underlyingsQuery = trpc.futuresOptions.getUnderlyings.useQuery(undefined, { retry: false });
  const [symbol, setSymbol] = useState(initialSymbol);
  const [expiryDays, setExpiryDays] = useState(30);
  const [direction, setDirection] = useState<Direction>('long');
  const [spreadKind, setSpreadKind] = useState<SpreadKind>('bull_call');
  const [contractSelection, setContractSelection] = useState<ContractSelection | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [pendingPositions, setPendingPositions] = useState<PositionRow[]>([]);
  const [localActivity, setLocalActivity] = useState<string[]>([]);
  const [modelAlertInput, setModelAlertInput] = useState('');
  const [modelAlertEnabled, setModelAlertEnabled] = useState(false);

  const chainQuery = trpc.futuresOptions.getOptionChain.useQuery({ symbol, expiryDays }, { retry: false });
  const chain60Query = trpc.futuresOptions.getOptionChain.useQuery({ symbol, expiryDays: 60 }, { retry: false });
  const chain90Query = trpc.futuresOptions.getOptionChain.useQuery({ symbol, expiryDays: 90 }, { retry: false });
  const chain = chainQuery.data?.chain ?? [];
  const selectedRow = useMemo(() => contractSelection ? chain.find((row) => row.strike === contractSelection.strike) ?? chain[Math.floor(chain.length / 2)] : chain[Math.floor(chain.length / 2)], [chain, contractSelection]);
  const selectedIsCall = contractSelection?.isCall ?? true;
  const historyQuery = trpc.futuresOptions.getContractIVHistory.useQuery({ symbol, strike: selectedRow?.strike ?? 1, expiryDays, isCall: selectedIsCall }, { enabled: Boolean(selectedRow), retry: false });
  const ledgerQuery = trpc.nceoSimulation.getLedger.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const createPosition = trpc.nceoSimulation.createPosition.useMutation({
    onSuccess: (result) => {
      void utils.nceoSimulation.getLedger.invalidate();
      if (result.status === 'available') setLocalActivity((rows) => [`${new Date().toLocaleTimeString('zh-CN')} · NCEO 模拟仓位已保存到当前登录用户的研究账本。`, ...rows].slice(0, 12));
      setPendingPositions((rows) => rows.map((row) => ({ ...row, pending: false })));
    },
    onError: () => { setPendingPositions([]); toast.error('NCEO 模拟仓位未能保存；未发送任何订单，也未以本地数据冒充已保存状态。'); },
  });
  const refreshAudit = trpc.nceoSimulation.recordModelRefresh.useMutation();
  const exportAudit = trpc.nceoSimulation.recordCsvExport.useMutation();
  const closePosition = trpc.nceoSimulation.closePosition.useMutation({ onSuccess: () => void utils.nceoSimulation.getLedger.invalidate() });

  const option = useMemo(() => {
    if (!selectedRow) return null;
    const bid = selectedIsCall ? selectedRow.callBid : selectedRow.putBid;
    const ask = selectedIsCall ? selectedRow.callAsk : selectedRow.putAsk;
    const last = selectedIsCall ? selectedRow.callLast : selectedRow.putLast;
    const iv = selectedIsCall ? selectedRow.callIV : selectedRow.putIV;
    const delta = selectedIsCall ? selectedRow.callDelta : selectedRow.putDelta;
    const gamma = selectedIsCall ? selectedRow.callGamma : selectedRow.putGamma;
    const vega = selectedIsCall ? selectedRow.callVega : selectedRow.putVega;
    const theta = selectedIsCall ? selectedRow.callTheta : selectedRow.putTheta;
    const volume = selectedIsCall ? selectedRow.callVol : selectedRow.putVol;
    const openInterest = selectedIsCall ? selectedRow.callOI : selectedRow.putOI;
    return { bid, ask, last, iv, delta, gamma, vega, theta, volume, openInterest, spread: Math.max(0, ask - bid) };
  }, [selectedIsCall, selectedRow]);

  const reference = direction === 'long' ? option?.ask ?? null : option?.bid ?? null;
  const strategyLevels = useMemo(() => {
    if (!reference || !option || !selectedRow) return null;
    const adverse = Math.max(option.spread * 3, reference * 0.28);
    return {
      takeProfit: direction === 'long' ? reference * 1.35 : Math.max(option.spread, reference * 0.65),
      stopLoss: direction === 'long' ? Math.max(option.spread, reference - adverse) : reference * 1.35,
      maintenanceWarning: direction === 'short' ? reference * 1.8 : null,
      estimatedMargin: direction === 'short' ? Math.max(selectedRow.strike * 100 * 0.2, reference * 100 * 1.5) : reference * 100,
      estimatedFee: Math.max(0.65, quantity * 0.65),
    };
  }, [direction, option, quantity, reference, selectedRow]);
  const spreadStrategy = useMemo(() => {
    const underlying = chainQuery.data?.underlying?.price;
    if (!underlying || chain.length < 3) return null;
    const atmIndex = Math.floor(chain.length / 2);
    const center = chain[atmIndex]; const lower = chain[Math.max(0, atmIndex - 2)]; const upper = chain[Math.min(chain.length - 1, atmIndex + 2)];
    if (!center || !lower || !upper) return null;
    let legs: SpreadLeg[] = [];
    let breakEvens: number[] = [];
    let maxProfit: number | null = null;
    let maxLoss = 0;
    if (spreadKind === 'long_call') {
      const debit = Math.max(0, center.callAsk);
      legs = [{ label: `${symbol} ${center.strike} C`, action: '模型买入', strike: center.strike, isCall: true, premium: center.callAsk }];
      breakEvens = [center.strike + debit]; maxProfit = null; maxLoss = debit;
    } else if (spreadKind === 'long_put') {
      const debit = Math.max(0, center.putAsk);
      legs = [{ label: `${symbol} ${center.strike} P`, action: '模型买入', strike: center.strike, isCall: false, premium: center.putAsk }];
      breakEvens = [center.strike - debit]; maxProfit = Math.max(0, center.strike - debit); maxLoss = debit;
    } else if (spreadKind === 'bull_call') {
      const debit = Math.max(0, center.callAsk - upper.callBid);
      legs = [{ label: `${symbol} ${center.strike} C`, action: '模型买入', strike: center.strike, isCall: true, premium: center.callAsk }, { label: `${symbol} ${upper.strike} C`, action: '模型卖出', strike: upper.strike, isCall: true, premium: upper.callBid }];
      breakEvens = [center.strike + debit]; maxProfit = Math.max(0, upper.strike - center.strike - debit); maxLoss = debit;
    } else if (spreadKind === 'bear_put') {
      const debit = Math.max(0, upper.putAsk - center.putBid);
      legs = [{ label: `${symbol} ${upper.strike} P`, action: '模型买入', strike: upper.strike, isCall: false, premium: upper.putAsk }, { label: `${symbol} ${center.strike} P`, action: '模型卖出', strike: center.strike, isCall: false, premium: center.putBid }];
      breakEvens = [upper.strike - debit]; maxProfit = Math.max(0, upper.strike - center.strike - debit); maxLoss = debit;
    } else if (spreadKind === 'straddle') {
      const debit = Math.max(0, center.callAsk + center.putAsk);
      legs = [{ label: `${symbol} ${center.strike} C`, action: '模型买入', strike: center.strike, isCall: true, premium: center.callAsk }, { label: `${symbol} ${center.strike} P`, action: '模型买入', strike: center.strike, isCall: false, premium: center.putAsk }];
      breakEvens = [center.strike - debit, center.strike + debit]; maxProfit = null; maxLoss = debit;
    } else {
      const debit = Math.max(0, upper.callAsk + lower.putAsk);
      legs = [{ label: `${symbol} ${upper.strike} C`, action: '模型买入', strike: upper.strike, isCall: true, premium: upper.callAsk }, { label: `${symbol} ${lower.strike} P`, action: '模型买入', strike: lower.strike, isCall: false, premium: lower.putAsk }];
      breakEvens = [lower.strike - debit, upper.strike + debit]; maxProfit = null; maxLoss = debit;
    }
    const netDebit = legs.reduce((sum, leg) => sum + (leg.action === '模型买入' ? leg.premium : -leg.premium), 0);
    const payoff = Array.from({ length: 25 }, (_, index) => {
      const scenarioPrice = underlying * (0.65 + index * 0.0292);
      const perShare = legs.reduce((sum, leg) => {
        const intrinsic = leg.isCall ? Math.max(0, scenarioPrice - leg.strike) : Math.max(0, leg.strike - scenarioPrice);
        return sum + (leg.action === '模型买入' ? intrinsic - leg.premium : leg.premium - intrinsic);
      }, 0);
      return { underlying: Number(scenarioPrice.toFixed(2)), pnl: Number((perShare * quantity * 100).toFixed(2)) };
    });
    return { label: spreadLabels[spreadKind], legs, breakEvens, netDebit, maxProfit, maxLoss, payoff, centerStrike: center.strike, iv: center.callIV, delta: center.callDelta, spread: Math.max(0, center.callAsk - center.callBid) };
  }, [chain, chainQuery.data?.underlying?.price, quantity, spreadKind, symbol]);
  const payoff = useMemo(() => {
    const underlying = chainQuery.data?.underlying?.price;
    if (!underlying || !selectedRow || !reference) return [];
    return Array.from({ length: 17 }, (_, index) => {
      const scenarioPrice = underlying * (0.7 + index * 0.0375);
      const intrinsic = selectedIsCall ? Math.max(0, scenarioPrice - selectedRow.strike) : Math.max(0, selectedRow.strike - scenarioPrice);
      return { underlying: Number(scenarioPrice.toFixed(2)), pnl: Number(((direction === 'long' ? intrinsic - reference : reference - intrinsic) * quantity * 100).toFixed(2)) };
    });
  }, [chainQuery.data?.underlying?.price, direction, quantity, reference, selectedIsCall, selectedRow]);
  const liquidity = option ? option.openInterest >= 1_000 && option.spread <= Math.max(0.3, option.last * 0.08) ? '模型流动性：较高' : option.openInterest >= 300 ? '模型流动性：中等' : '模型流动性：较低' : '—';
  const canOpenShort = Boolean(option && expiryDays > 7 && option.spread <= Math.max(0.5, option.last * 0.15));
  const restriction = !option ? '正在读取模型合约。' : expiryDays <= 7 ? '模拟规则：临近到期，限制新增空头情景；仅可查看。' : option.spread > Math.max(0.5, option.last * 0.15) ? '模拟规则：模型价差较宽，限制新增空头情景；不代表交易所限制。' : '模拟规则：当前模型允许创建多头或空头情景；不代表任何交易权限。';
  const persistedPositions: PositionRow[] = (ledgerQuery.data?.positions ?? []).map((row) => ({ id: row.id, createdAt: row.createdAt, direction: row.direction, symbol: row.symbol, contract: row.contractLabel, referencePrice: Number(row.referencePrice), quantity: row.quantity, model: row.modelBasis }));
  const positions = [...pendingPositions, ...persistedPositions.filter((stored) => !pendingPositions.some((pending) => pending.contract === stored.contract && pending.direction === stored.direction && pending.quantity === stored.quantity))];
  const auditActivity = (ledgerQuery.data?.events ?? []).slice(0, 8).map((event) => `${createdText(event.createdAt)} · ${event.eventSummary}`);
  const activity = [...localActivity, ...auditActivity].slice(0, 12);
  const generatedAt = historyQuery.data?.ivHistory?.at(-1)?.date ?? '等待模型计算';
  const underlyingModel = useMemo(() => (underlyingsQuery.data ?? []).find((row) => row.symbol === symbol), [symbol, underlyingsQuery.data]);
  const greekCurve = useMemo(() => chain.map((row) => ({ strike: row.strike, Delta: selectedIsCall ? row.callDelta : row.putDelta, Gamma: selectedIsCall ? row.callGamma : row.putGamma, Vega: selectedIsCall ? row.callVega : row.putVega, Theta: selectedIsCall ? row.callTheta : row.putTheta })), [chain, selectedIsCall]);
  const ivCone = useMemo(() => {
    if (!underlyingModel) return [];
    const centerIv = (rows: typeof chain) => rows.length ? rows[Math.floor(rows.length / 2)].callIV : null;
    return [
      { tenor: `${expiryDays}D`, iv: centerIv(chain), realized: underlyingModel.hvol30 },
      { tenor: '60D', iv: centerIv(chain60Query.data?.chain ?? []), realized: null },
      { tenor: '90D', iv: centerIv(chain90Query.data?.chain ?? []), realized: null },
    ].filter((point) => point.iv != null);
  }, [chain, chain60Query.data?.chain, chain90Query.data?.chain, expiryDays, underlyingModel]);
  const timeDecay = useMemo(() => {
    if (!reference || !selectedRow) return [];
    const checkpoints = Array.from(new Set([selectedRow.daysToExpiry, Math.ceil(selectedRow.daysToExpiry * .75), Math.ceil(selectedRow.daysToExpiry * .5), Math.ceil(selectedRow.daysToExpiry * .25), 1])).sort((a, b) => b - a);
    return checkpoints.map((days) => ({ days: `${days}D`, modelValue: Number((reference * Math.sqrt(days / selectedRow.daysToExpiry)).toFixed(2)) }));
  }, [reference, selectedRow]);
  const modelLeverage = underlyingModel?.price != null && reference != null && reference > 0
    ? underlyingModel.price / reference
    : null;
  const modelAlertValue = Number(modelAlertInput);
  const modelAlertState = modelAlertEnabled && Number.isFinite(modelAlertValue) && reference != null ? reference >= modelAlertValue ? `当前模型参考价 ${money(reference)} 已触及或高于会话阈值 ${money(modelAlertValue)}。` : `当前模型参考价 ${money(reference)} 尚未触及会话阈值 ${money(modelAlertValue)}。` : '未设置模型合约会话阈值；不会产生后台、短信、邮件或券商告警。';

  const refreshModels = () => {
    void chainQuery.refetch(); void chain60Query.refetch(); void chain90Query.refetch(); void historyQuery.refetch();
    setLocalActivity((items) => [`${new Date().toLocaleTimeString('zh-CN')} · 已请求重新计算模型合约与 IV 轨迹。`, ...items].slice(0, 12));
    if (user) refreshAudit.mutate({ symbol, expiryDays, isCall: selectedIsCall });
  };
  const addSimulation = () => {
    if (!riskAcknowledged) { toast.error('请先确认期权高杠杆与模型失效风险；此操作不会发送真实订单。'); return; }
    if (!user) { toast.error('请先登录后再保存 NCEO 模拟仓位；不会创建匿名或伪持仓。'); return; }
    if (!selectedRow || !reference || !option) return;
    if (direction === 'short' && !canOpenShort) { toast.error('当前模型限制新增空头情景；请查看限制原因。未发送任何订单。'); return; }
    const contract = `${symbol} ${selectedRow.expiry} ${selectedRow.strike} ${selectedIsCall ? 'C' : 'P'}`;
    const generatedAtIso = new Date().toISOString();
    setPendingPositions([{ id: -Date.now(), createdAt: generatedAtIso, direction, symbol, contract, referencePrice: reference, quantity, model: 'BSM 模型／模拟盘', pending: true }]);
    createPosition.mutate({ symbol, contractLabel: contract, direction, referencePrice: reference, quantity, modelBasis: 'BSM 模型／模拟盘', parameters: { strike: selectedRow.strike, expiryDays, isCall: selectedIsCall, iv: option.iv, delta: option.delta, spread: option.spread, modelGeneratedAt: generatedAtIso } });
    setLocalActivity((items) => [`${new Date().toLocaleTimeString('zh-CN')} · 正在保存 ${direction === 'long' ? '多头' : '空头'} NCEO 模拟仓位：${contract} × ${quantity}。未路由订单。`, ...items].slice(0, 12));
  };
  const addSpreadSimulation = () => {
    if (!riskAcknowledged) { toast.error('请先确认期权高杠杆与模型失效风险；不会发送真实订单。'); return; }
    if (!user) { toast.error('请先登录后再保存 NCEO 模拟策略；不会创建匿名记录。'); return; }
    if (!spreadStrategy) return;
    const contract = `${symbol} ${spreadStrategy.label} ${expiryDays}D`;
    const generatedAtIso = new Date().toISOString();
    setPendingPositions([{ id: -Date.now(), createdAt: generatedAtIso, direction: 'long', symbol, contract, referencePrice: spreadStrategy.netDebit, quantity, model: `NCEO ${spreadStrategy.label}／模型策略组合`, pending: true }]);
    createPosition.mutate({ symbol, contractLabel: contract, direction: 'long', referencePrice: Math.max(0.0001, spreadStrategy.netDebit), quantity, modelBasis: `NCEO ${spreadStrategy.label}／模型策略组合`, parameters: { strike: spreadStrategy.centerStrike, expiryDays, isCall: true, iv: spreadStrategy.iv, delta: spreadStrategy.delta, spread: spreadStrategy.spread, modelGeneratedAt: generatedAtIso } });
    setLocalActivity((items) => [`${new Date().toLocaleTimeString('zh-CN')} · 正在保存 ${spreadStrategy.label} 模拟组合：${contract} × ${quantity}。组合腿为模型测算，不路由订单。`, ...items].slice(0, 12));
  };
  const exportLog = () => {
    exportNceoCsv(`nceo-simulation-log-${new Date().toISOString().slice(0, 10)}.csv`, [['created_at', 'direction', 'symbol', 'contract', 'reference_price', 'quantity', 'model_basis', 'execution_status'], ...positions.map((position) => [String(position.createdAt), position.direction, position.symbol, position.contract, String(position.referencePrice), String(position.quantity), position.model, 'simulation_only_not_routed'])]);
    if (user) exportAudit.mutate({ rowCount: positions.length });
    toast.success('已导出 NCEO 模拟研究记录；不包含真实订单。');
  };

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080b13] text-slate-100">
    <div className="flex shrink-0 items-center justify-between border-b border-violet-900/70 bg-[#101327] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className="font-mono text-sm font-bold text-violet-300">NCEO</span><span className="truncate text-sm text-slate-200">佑诚期权 · 诺诚增强期权</span><span className="hidden rounded border border-amber-800/70 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-100 sm:inline">模拟研究 · 不执行</span></div><div className="flex items-center gap-2"><button type="button" aria-label="重新计算 NCEO 模型" onClick={refreshModels} className="text-slate-400 hover:text-violet-200"><RefreshCw className="h-4 w-4" /></button><button type="button" aria-label="导出 NCEO 模拟日志" onClick={exportLog} className="text-slate-400 hover:text-violet-200"><Download className="h-4 w-4" /></button>{onClose && <button type="button" aria-label="关闭 NCEO" onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>}</div></div>
    <div className="flex-1 space-y-3 overflow-y-auto p-3 pb-20">
      <div className="flex gap-2 rounded border border-amber-900/70 bg-amber-950/30 p-2 text-[10px] leading-4 text-amber-100"><ShieldAlert className="h-4 w-4 shrink-0" /><p><strong>模拟盘及策略测算参考。</strong>所有价格、价差、IV、流动性、保证金、可多空标记和损益均来自模型／模拟数据，不是毫秒级行情、交易所限制、可执行报价或投资建议。期权可造成全部权利金损失；模型、波动结构和市场制度变化均可能使结果失效。</p></div>
      <NceoOptionsCard symbol={symbol} />
      <div className="grid gap-2 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded border border-slate-800 bg-[#0d1220] p-3"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-sm font-semibold text-violet-200">标的与模拟合约</h3><p className="mt-1 text-[10px] text-slate-500">合约字段由既有 BSM 模型链生成；点击任一行展开其 IV 与收益情景。</p></div><div className="flex flex-wrap gap-1">{(underlyingsQuery.data ?? []).slice(0, 6).map((underlying) => <button key={underlying.symbol} type="button" onClick={() => { setSymbol(underlying.symbol); setContractSelection(null); }} className={`rounded border px-2 py-1 font-mono text-[10px] ${symbol === underlying.symbol ? 'border-violet-400 bg-violet-950/50 text-violet-100' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>{underlying.symbol}</button>)}</div></div><div className="mb-3 flex flex-wrap gap-1">{expiryOptions.map((days) => <button key={days} type="button" onClick={() => setExpiryDays(days)} className={`rounded px-2 py-1 text-[10px] ${expiryDays === days ? 'bg-violet-700 text-white' : 'bg-slate-800 text-slate-400'}`}>{days}D</button>)}</div>{chainQuery.isLoading ? <div className="grid h-56 place-items-center text-xs text-slate-500">正在计算模型合约…</div> : chainQuery.isError ? <div className="rounded border border-amber-900/70 p-3 text-xs text-amber-200">模型合约暂不可读取。不会以未核验的报价替代。</div> : <div className="overflow-x-auto"><table className="min-w-[720px] text-[10px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-1.5">合约</th><th>行权</th><th>剩余</th><th>模拟 Bid/Ask</th><th>IV</th><th>Delta</th><th>Gamma</th><th>Vega</th><th>状态</th></tr></thead><tbody>{chain.slice(0, 9).map((row) => <React.Fragment key={row.strike}><tr onClick={() => setContractSelection({ strike: row.strike, isCall: true })} className={`cursor-pointer border-b border-slate-800/60 hover:bg-violet-950/20 ${selectedRow?.strike === row.strike && selectedIsCall ? 'bg-violet-950/35' : ''}`}><td className="p-1.5 font-mono text-violet-200">{symbol} {row.strike} C</td><td>{number(row.strike)}</td><td>{row.daysToExpiry}D</td><td>{money(row.callBid)} / {money(row.callAsk)}</td><td>{number(row.callIV)}%</td><td>{number(row.callDelta, 3)}</td><td>{number(row.callGamma, 4)}</td><td>{number(row.callVega, 3)}</td><td><span className="rounded bg-emerald-950/60 px-1 text-emerald-300">模拟可做多</span></td></tr><tr onClick={() => setContractSelection({ strike: row.strike, isCall: false })} className={`cursor-pointer border-b border-slate-800/60 hover:bg-violet-950/20 ${selectedRow?.strike === row.strike && !selectedIsCall ? 'bg-violet-950/35' : ''}`}><td className="p-1.5 font-mono text-cyan-200">{symbol} {row.strike} P</td><td>{number(row.strike)}</td><td>{row.daysToExpiry}D</td><td>{money(row.putBid)} / {money(row.putAsk)}</td><td>{number(row.putIV)}%</td><td>{number(row.putDelta, 3)}</td><td>{number(row.putGamma, 4)}</td><td>{number(row.putVega, 3)}</td><td><span className={`rounded px-1 ${canOpenShort ? 'bg-rose-950/60 text-rose-200' : 'bg-amber-950/60 text-amber-200'}`}>{canOpenShort ? '模拟可做空' : '模拟开空受限'}</span></td></tr></React.Fragment>)}</tbody></table></div>}</section>
        <section className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">模型策略测算参考</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">不是建议入场、止盈、止损或强平价格；仅由当前模型输入、价差与单一假设得出。</p><div className="mt-3 flex gap-1"><button type="button" onClick={() => setDirection('long')} className={`rounded px-3 py-1.5 text-xs ${direction === 'long' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'}`}>多头情景</button><button type="button" onClick={() => setDirection('short')} className={`rounded px-3 py-1.5 text-xs ${direction === 'short' ? 'bg-rose-800 text-white' : 'bg-slate-800 text-slate-400'}`}>空头情景</button></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">{[['模型参考价', money(reference)], ['止盈测算', money(strategyLevels?.takeProfit)], ['止损测算', money(strategyLevels?.stopLoss)], ['保证金估算', money(strategyLevels?.estimatedMargin)], ['费用估算', money(strategyLevels?.estimatedFee)], ['强平预警', strategyLevels?.maintenanceWarning ? money(strategyLevels.maintenanceWarning) : '多头不适用']].map(([label, value]) => <div key={String(label)} className="rounded border border-slate-800 bg-[#080b13] p-2"><div className="text-slate-500">{label}</div><div className="mt-1 font-mono text-xs text-slate-100">{value}</div></div>)}</div><div className="mt-3 rounded border border-amber-900/60 bg-amber-950/20 p-2 text-[10px] text-amber-100"><strong>{direction === 'long' ? '模拟可做多／可新开' : canOpenShort ? '模拟可做空／可新开' : '模拟开空受限'}</strong><p className="mt-1">{restriction}</p></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><label className="text-slate-400">模拟张数<input aria-label="NCEO 模拟张数" min={1} max={100} type="number" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded border border-slate-700 bg-[#080b13] px-2 py-1 text-slate-100" /></label><div><div className="text-slate-500">流动性</div><div className="mt-2 text-slate-200">{liquidity}</div></div></div><label className="mt-3 flex cursor-pointer items-start gap-2 text-[10px] text-amber-100"><input aria-label="确认 NCEO 风险提示" checked={riskAcknowledged} onChange={(event) => setRiskAcknowledged(event.target.checked)} type="checkbox" className="mt-0.5" /><span>我已知悉：仅创建当前登录用户的模拟研究记录；不构成投资建议，期权可能损失全部权利金，模型参考可能失效。</span></label><button type="button" disabled={createPosition.isPending} onClick={addSimulation} className="mt-3 w-full rounded bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-60">{createPosition.isPending ? '正在保存模拟仓位…' : '创建模拟仓位（不发送订单）'}</button></section>
      </div>
      <section className="rounded border border-violet-900/70 bg-[#0d1220] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-violet-200">NCEO 期权价差策略自动生成</h3><p className="mt-1 max-w-4xl text-[10px] leading-4 text-slate-500">以下组合腿、模型参考价、盈亏平衡点和收益曲线均由当前 NCEO 模型合约链计算。模型买入／卖出仅描述模拟组合腿，不是对真实市场的买卖指令、可执行报价或投资建议。</p></div><span className="rounded border border-amber-800/70 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-100">模型生成：{generatedAt}</span></div>
        <div className="mt-3 flex flex-wrap gap-1" aria-label="NCEO 策略类型">{(Object.keys(spreadLabels) as SpreadKind[]).map((kind) => <button key={kind} type="button" onClick={() => setSpreadKind(kind)} className={`rounded px-3 py-1.5 text-xs ${spreadKind === kind ? 'bg-violet-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{spreadLabels[kind]}</button>)}</div>
        {!spreadStrategy ? <div className="mt-3 grid min-h-44 place-items-center rounded border border-dashed border-slate-700 text-xs text-slate-500">正在读取当前标的的模型合约链；没有可用模型链时不生成策略组合。</div> : <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_.9fr]"><div className="space-y-3"><div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4"><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">模型净权利金</div><div className="mt-1 font-mono text-xs text-slate-100">{money(spreadStrategy.netDebit)} / 股</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">盈亏平衡点</div><div className="mt-1 font-mono text-xs text-slate-100">{spreadStrategy.breakEvens.map((point) => money(point)).join(' · ')}</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">最大盈利测算</div><div className="mt-1 font-mono text-xs text-emerald-300">{spreadStrategy.maxProfit == null ? '理论不封顶' : money(spreadStrategy.maxProfit * quantity * 100)}</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">最大亏损测算</div><div className="mt-1 font-mono text-xs text-rose-300">{money(spreadStrategy.maxLoss * quantity * 100)}</div></div></div><div className="overflow-x-auto rounded border border-slate-800"><table className="min-w-[580px] text-[10px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-2">组合腿</th><th>模型动作</th><th>Call／Put</th><th>行权价</th><th>模型参考权利金</th><th>到期日</th></tr></thead><tbody>{spreadStrategy.legs.map((leg) => <tr key={`${leg.label}-${leg.action}`} className="border-b border-slate-800/60"><td className="p-2 font-mono text-violet-200">{leg.label}</td><td className={leg.action === '模型买入' ? 'text-emerald-300' : 'text-rose-300'}>{leg.action}</td><td>{leg.isCall ? 'Call' : 'Put'}</td><td>{money(leg.strike)}</td><td>{money(leg.premium)}</td><td>{selectedRow?.expiry ?? '—'}</td></tr>)}</tbody></table></div><div className="rounded border border-amber-900/60 bg-amber-950/20 p-2 text-[10px] leading-4 text-amber-100"><strong>{spreadStrategy.label} 模型适用条件：</strong>{spreadKind === 'bull_call' ? '上涨情景的有限风险／有限收益模型组合。' : spreadKind === 'bear_put' ? '下跌情景的有限风险／有限收益模型组合。' : spreadKind === 'straddle' ? '波动扩大情景的双向模型组合；最大盈利不封顶仅为到期静态公式结论。' : '双边突破情景的模型组合；最大盈利不封顶仅为到期静态公式结论。'} 实际结果可受波动率、价差、流动性、提前行权、保证金及其他因素影响而失效。</div></div><div className="rounded bg-[#080b13] p-2"><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold text-slate-200">{spreadStrategy.label} · 到期损益曲线</div><div className="text-[10px] text-slate-500">纵轴为 {quantity} 张合约的模型到期损益（美元）。</div></div><button type="button" onClick={addSpreadSimulation} disabled={!riskAcknowledged || createPosition.isPending} className="rounded bg-violet-700 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">保存策略模拟记录</button></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={spreadStrategy.payoff}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="underlying" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={58} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10 }} formatter={(value: number) => [`$${value.toFixed(2)}`, '模型到期损益']} /><ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 3" /><Line type="monotone" dataKey="pnl" stroke="#c084fc" dot={false} strokeWidth={2} name="模型到期损益" /></LineChart></ResponsiveContainer></div></div></div>}
      </section>
      <section className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded border border-slate-800 bg-[#0d1220] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-violet-200">NCEO 模型 T 型期权链</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">同一行权价横向显示 Call 与 Put 的模型 Bid／Ask。点击任一侧会切换当前合约的 IV、希腊值、时间衰减和收益研究；不是交易所买一卖一或可执行报价。</p></div><span className="rounded border border-amber-800/70 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-100">{symbol} · {expiryDays}D 模型链</span></div>{chainQuery.isLoading ? <div className="mt-3 grid h-52 place-items-center rounded border border-dashed border-slate-700 text-xs text-slate-500">正在计算模型 T 型链…</div> : !chain.length ? <div className="mt-3 rounded border border-dashed border-slate-700 p-3 text-xs text-slate-500">模型 T 型链不可用，保持空状态。</div> : <div className="mt-3 overflow-x-auto"><table className="min-w-[780px] text-[10px]"><thead><tr className="border-b border-slate-800 text-center text-slate-500"><th colSpan={2} className="p-2 text-emerald-300">Call 模型报价</th><th>行权价</th><th>剩余</th><th colSpan={2} className="text-rose-300">Put 模型报价</th></tr><tr className="border-b border-slate-800 text-left text-[9px] text-slate-500"><th className="p-1.5">模型 Bid</th><th>模型 Ask</th><th>Strike</th><th>到期</th><th>模型 Bid</th><th>模型 Ask</th></tr></thead><tbody>{chain.slice(0, 13).map((row) => <tr key={row.strike} className="border-b border-slate-800/60"><td><button type="button" onClick={() => setContractSelection({ strike: row.strike, isCall: true })} className={`w-full p-1.5 text-left font-mono ${selectedRow?.strike === row.strike && selectedIsCall ? 'bg-emerald-950/50 text-emerald-200' : 'text-slate-200 hover:bg-emerald-950/20'}`}>{money(row.callBid)}</button></td><td><button type="button" onClick={() => setContractSelection({ strike: row.strike, isCall: true })} className={`w-full p-1.5 text-left font-mono ${selectedRow?.strike === row.strike && selectedIsCall ? 'bg-emerald-950/50 text-emerald-200' : 'text-slate-200 hover:bg-emerald-950/20'}`}>{money(row.callAsk)}</button></td><td className="bg-slate-900/70 p-1.5 text-center font-mono text-violet-200">{money(row.strike)}</td><td className="p-1.5 text-center text-slate-400">{row.daysToExpiry}D</td><td><button type="button" onClick={() => setContractSelection({ strike: row.strike, isCall: false })} className={`w-full p-1.5 text-right font-mono ${selectedRow?.strike === row.strike && !selectedIsCall ? 'bg-rose-950/50 text-rose-200' : 'text-slate-200 hover:bg-rose-950/20'}`}>{money(row.putBid)}</button></td><td><button type="button" onClick={() => setContractSelection({ strike: row.strike, isCall: false })} className={`w-full p-1.5 text-right font-mono ${selectedRow?.strike === row.strike && !selectedIsCall ? 'bg-rose-950/50 text-rose-200' : 'text-slate-200 hover:bg-rose-950/20'}`}>{money(row.putAsk)}</button></td></tr>)}</tbody></table></div>}</div>
        <div className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">当前模型合约基础字段</h3><p className="mt-1 text-[10px] text-slate-500">{symbol} {selectedRow?.strike ?? '—'} {selectedIsCall ? 'Call' : 'Put'} · 模型计算于 {generatedAt}。</p><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">剩余到期天数</div><div className="mt-1 font-mono text-slate-100">{selectedRow?.daysToExpiry ?? '—'}D</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">模型权利金参考</div><div className="mt-1 font-mono text-slate-100">{money(reference)}</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">模型杠杆估算</div><div className="mt-1 font-mono text-slate-100">{modelLeverage == null ? '—' : `${modelLeverage.toFixed(2)}x`}</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">模型流动性</div><div className="mt-1 text-slate-100">{liquidity}</div></div><div className="col-span-2 rounded border border-amber-900/60 bg-amber-950/20 p-2 text-amber-100"><div className="text-[9px]">模型报价边界</div><div className="mt-1 leading-4">Bid／Ask、杠杆、流动性与可多空标记来自模型输入，不能作为真实开仓、平仓、保证金或交易所权限依据。</div></div></div></div>
      </section>
      <section className="grid gap-3 lg:grid-cols-2"><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">模型希腊值曲线</h3><p className="mt-1 text-[10px] text-slate-500">横轴为模型行权价；Delta、Gamma、Vega、Theta 均由当前 BSM 输入计算，不是实时风险暴露。</p>{greekCurve.length ? <div className="mt-2 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={greekCurve}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="strike" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={46} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 10 }} /><Line dataKey="Delta" stroke="#34d399" dot={false} /><Line dataKey="Gamma" stroke="#fbbf24" dot={false} /><Line dataKey="Vega" stroke="#a78bfa" dot={false} /><Line dataKey="Theta" stroke="#fb7185" dot={false} /></LineChart></ResponsiveContainer></div> : <div className="grid h-56 place-items-center text-xs text-slate-500">模型希腊值曲线不可用。</div>}</div><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">模型 IV 期限锥</h3><p className="mt-1 text-[10px] text-slate-500">显示标的模型 30／60／90 天 IV 与可用的模型历史波动输入；不是交易所 IV 曲面或预测。</p>{ivCone.length ? <div className="mt-2 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={ivCone}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="tenor" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis unit="%" tick={{ fill: '#94a3b8', fontSize: 9 }} width={42} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 10 }} /><Line type="monotone" dataKey="iv" name="模型 IV" stroke="#a78bfa" strokeWidth={2} /><Line type="monotone" dataKey="realized" name="模型历史波动输入" stroke="#22d3ee" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <div className="grid h-56 place-items-center text-xs text-slate-500">当前标的没有可用模型 IV 期限输入。</div>}</div></section>
      <section className="grid gap-3 lg:grid-cols-2"><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">模型时间衰减预览</h3><p className="mt-1 text-[10px] text-slate-500">固定其他 BSM 输入、按时间平方根缩放的静态示例；不代表合约真实历史价值或未来价格。</p>{timeDecay.length ? <div className="mt-2 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={timeDecay}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="days" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={46} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10 }} formatter={(value: number) => [money(value), '模型时间价值']} /><Line dataKey="modelValue" name="模型时间价值" stroke="#fbbf24" strokeWidth={2} dot /></LineChart></ResponsiveContainer></div> : <div className="grid h-48 place-items-center text-xs text-slate-500">选择模型合约后显示时间衰减示例。</div>}</div><div className="rounded border border-amber-900/70 bg-amber-950/20 p-3"><h3 className="text-sm font-semibold text-amber-100">模型合约会话阈值</h3><p className="mt-1 text-[10px] leading-4 text-amber-100">只在当前浏览器会话按当前模型参考价高亮检查；不监控真实价格，不产生持续后台、手机、邮件或券商告警。</p><div className="mt-3 flex gap-2"><input aria-label="NCEO 模型合约会话阈值" value={modelAlertInput} onChange={(event) => setModelAlertInput(event.target.value)} type="number" placeholder="输入模型阈值" className="min-w-0 flex-1 rounded border border-amber-800 bg-[#080b13] px-2 py-1 text-xs text-slate-100" /><button type="button" onClick={() => setModelAlertEnabled(Number.isFinite(Number(modelAlertInput)) && modelAlertInput.trim() !== '')} className="rounded bg-amber-800 px-2 py-1 text-[10px] text-amber-50 hover:bg-amber-700">检查阈值</button></div><p className={`mt-2 text-[10px] ${modelAlertEnabled && reference != null && reference >= modelAlertValue ? 'text-amber-50' : 'text-amber-100'}`}>{modelAlertState}</p></div></section>
      <section className="grid gap-3 lg:grid-cols-2"><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">{symbol} {selectedRow?.strike ?? '—'} {selectedIsCall ? 'Call' : 'Put'} · 模型 IV 轨迹</h3><p className="mt-1 text-[10px] text-slate-500">生成时间：{generatedAt}。IV 轨迹为模型计算结果，不是期权交易所历史行情。</p>{historyQuery.isLoading ? <div className="grid h-52 place-items-center text-xs text-slate-500">正在计算模型 IV 轨迹…</div> : historyQuery.data?.ivHistory?.length ? <div className="mt-2 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={historyQuery.data.ivHistory}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} unit="%" width={42} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10 }} /><Line type="monotone" dataKey="iv" stroke="#a78bfa" dot={false} strokeWidth={2} name="模型 IV" /></LineChart></ResponsiveContainer></div> : <div className="grid h-52 place-items-center text-xs text-slate-500">模型 IV 轨迹不可用，保持真实空状态。</div>}</div><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">到期收益模拟预览</h3><p className="mt-1 text-[10px] text-slate-500">以到期日、行权价、模型参考价和 {quantity} 张合约作静态情景测算；不包含滑点、税费变动、提前行权和真实保证金规则。</p>{payoff.length ? <div className="mt-2 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={payoff}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="underlying" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={52} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10 }} /><ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 3" /><Line type="monotone" dataKey="pnl" stroke={direction === 'long' ? '#34d399' : '#fb7185'} dot={false} strokeWidth={2} name="模拟到期损益" /></LineChart></ResponsiveContainer></div> : <div className="grid h-52 place-items-center text-xs text-slate-500">选择可读模型合约后显示到期损益测算。</div>}</div></section>
      <section className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">希腊值与模型输入</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Delta', option?.delta, 3], ['Gamma', option?.gamma, 4], ['Vega', option?.vega, 3], ['Theta', option?.theta, 3], ['IV', option?.iv, 2], ['模型价差', option?.spread, 2], ['成交量输入', option?.volume, 0], ['未平仓输入', option?.openInterest, 0]].map(([label, value, digits]) => <div key={String(label)} className="rounded border border-slate-800 bg-[#080b13] p-2"><div className="text-[9px] text-slate-500">{label}</div><div className="mt-1 font-mono text-xs text-slate-100">{number(value as number, digits as number)}{label === 'IV' ? '%' : ''}</div></div>)}</div></div><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-violet-200">模拟信号日志</h3><span className="text-[10px] text-slate-500">{user ? '登录用户审计链' : '请登录以保存'}</span></div>{ledgerQuery.isLoading && user ? <div className="mt-3 text-[10px] text-slate-500">正在读取已保存的模拟研究记录…</div> : activity.length ? <ul className="mt-3 space-y-2 text-[10px] text-slate-300">{activity.map((item, index) => <li key={`${item}-${index}`} className="rounded bg-[#080b13] p-2">{item}</li>)}</ul> : <div className="mt-3 rounded border border-dashed border-slate-700 p-3 text-[10px] text-slate-500">尚无已保存模拟动作。登录后创建仓位、重新计算或导出会登记到当前用户的 NCEO 研究账本；{sourceBoundary}</div>}</div></section>
      {ledgerQuery.isError && user && <div className="rounded border border-amber-900/70 bg-amber-950/20 p-3 text-[10px] text-amber-100">NCEO 模拟账本当前不可读取；不会以会话缓存冒充已保存的仓位或审计记录。</div>}
      {positions.length > 0 && <section className="rounded border border-slate-800 bg-[#0d1220] p-3"><h3 className="text-sm font-semibold text-violet-200">已保存的 NCEO 模拟仓位</h3><div className="mt-2 overflow-x-auto"><table className="min-w-[760px] text-[10px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-1.5">生成时间</th><th>方向</th><th>合约</th><th>参考价</th><th>张数</th><th>状态</th><th>操作</th></tr></thead><tbody>{positions.map((position) => <tr key={position.id} className="border-b border-slate-800/60"><td className="p-1.5 text-slate-400">{createdText(position.createdAt)}</td><td className={position.direction === 'long' ? 'text-emerald-300' : 'text-rose-300'}>{position.direction === 'long' ? '模拟多头' : '模拟空头'}</td><td className="font-mono text-slate-200">{position.contract}</td><td>{money(position.referencePrice)}</td><td>{position.quantity}</td><td className="text-amber-200">{position.pending ? '正在保存' : '未路由订单'}</td><td>{position.id > 0 && <button type="button" disabled={closePosition.isPending} onClick={() => closePosition.mutate({ id: position.id })} className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-300 hover:border-violet-600">关闭模拟仓位</button>}</td></tr>)}</tbody></table></div></section>}
      <div className="flex gap-2 rounded border border-rose-900/60 bg-rose-950/20 p-3 text-[10px] leading-4 text-rose-100"><AlertTriangle className="h-4 w-4 shrink-0" /><p><strong>风险与限制：</strong>本面板不接入真实证券／期权行情、交易所限仓、融资融券、盘口、券商账户或订单通道，创建动作不发送真实订单。模拟研究账本仅用于用户复盘，<strong>不构成监管留档</strong>。历史回测、胜率、最大回撤和告警只有在拥有可核验、无前视偏差的数据集与运行服务后才可展示；当前不伪造这些数字。</p></div>
    </div>
  </div>;
}
