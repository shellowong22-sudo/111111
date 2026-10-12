import { useMemo, useState } from "react";
import { AlertCircle, Clock, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ElectronicTradingMenu } from "./ElectronicTradingMenu";

interface TradingPanelProps {
  title: string;
  symbol?: string;
}

const SYMBOLS = ["SPX", "NDX", "AAPL", "MSFT", "NVDA", "TSLA", "EUR/USD", "GLD", "BTC"];
const ORDER_TYPES = ["市价单", "限价单", "止损单", "止损限价单", "冰山单", "TWAP", "VWAP"];
const ALGO_TYPES = ["TWAP", "VWAP", "POV", "IS", "Arrival Price"];

/**
 * Electronic trading is quote-aware but execution-disabled until a real
 * broker/account connector is configured. The old panel displayed hard-coded
 * orders, random volume bars and a fake "connected" status.
 */
export default function TradingPanel({ title, symbol = "SPX" }: TradingPanelProps) {
  const [sym, setSym] = useState(symbol);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState("限价单");
  const [qty, setQty] = useState("100");
  const [price, setPrice] = useState("");
  const [algo, setAlgo] = useState("VWAP");
  const [tab, setTab] = useState<"order" | "orders" | "quality" | "vol">("order");
  const [showMenu, setShowMenu] = useState(false);

  const quotes = trpc.trading.getLiveQuotes.useQuery(
    { symbols: SYMBOLS },
    {
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  );
  const selectedQuote = quotes.data?.items.find(item => item.symbol === sym);
  const effectivePrice = Number(price || selectedQuote?.price || 0);
  const estimatedNotional = Number(qty || 0) * effectivePrice;
  const availableQuotes = useMemo(
    () => (quotes.data?.items ?? []).filter(item => item.available),
    [quotes.data?.items],
  );

  const tabs = [
    ["order", "报价与下单"],
    ["orders", "委托记录"],
    ["quality", "执行质量"],
    ["vol", "日内成交量"],
  ] as const;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#0a0e1a] text-white text-xs">
      <div className="flex items-center justify-between border-b border-gray-700 bg-[#0d1220] px-3 py-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400">ETRD</span>
          <span className="text-gray-300">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] text-cyan-300">
            <span className={`h-1.5 w-1.5 rounded-full ${quotes.isFetching ? "bg-yellow-400" : "bg-cyan-400"}`} />
            {quotes.isFetching ? "读取公开行情…" : `${availableQuotes.length}/${SYMBOLS.length} 个公开报价`}
          </span>
          <button
            type="button"
            onClick={() => void quotes.refetch()}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
            title="刷新公开行情"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${quotes.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={() => setShowMenu(!showMenu)} className="rounded p-1 text-gray-400 hover:bg-gray-700">☰</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-700 px-3 py-1.5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-3 py-1 text-[10px] font-medium ${tab === id ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tab === "order" && (
          <>
            <div className="rounded border border-cyan-900/60 bg-cyan-950/20 p-2 text-[10px] text-cyan-200">
              这里现在只显示公开行情参考。当前没有配置可核验的经纪商授权、账户和订单回执，因此不会伪造成交，也不会提交订单。
            </div>
            <div className="grid grid-cols-2 gap-2 rounded bg-gray-900 p-3">
              <label className="text-[9px] text-gray-400">
                标的
                <select value={sym} onChange={event => setSym(event.target.value)} className="mt-0.5 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-white">
                  {SYMBOLS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[9px] text-gray-400">
                订单类型
                <select value={orderType} onChange={event => setOrderType(event.target.value)} className="mt-0.5 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-white">
                  {ORDER_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[9px] text-gray-400">
                数量
                <input value={qty} onChange={event => setQty(event.target.value)} className="mt-0.5 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-white" />
              </label>
              <label className="text-[9px] text-gray-400">
                参考价格
                <input value={price} onChange={event => setPrice(event.target.value)} placeholder={selectedQuote?.price?.toString() ?? "公开源未返回"} className="mt-0.5 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-white placeholder:text-gray-600" />
              </label>
              <label className="col-span-2 text-[9px] text-gray-400">
                执行算法
                <select value={algo} onChange={event => setAlgo(event.target.value)} className="mt-0.5 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-white">
                  {ALGO_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSide("BUY")} className={`rounded py-2 text-[11px] font-bold ${side === "BUY" ? "bg-green-700 text-white" : "border border-green-700 bg-gray-800 text-green-400"}`}>
                  <TrendingUp className="mr-1 inline h-3 w-3" />买入意向
                </button>
                <button type="button" onClick={() => setSide("SELL")} className={`rounded py-2 text-[11px] font-bold ${side === "SELL" ? "bg-red-700 text-white" : "border border-red-700 bg-gray-800 text-red-400"}`}>
                  <TrendingDown className="mr-1 inline h-3 w-3" />卖出意向
                </button>
              </div>
              <div className="col-span-2 rounded bg-gray-800 p-2 text-[9px] text-gray-400">
                <div className="flex justify-between"><span>公开报价</span><span className="font-mono text-white">{selectedQuote?.price ?? "不可用"} {selectedQuote?.currency ?? ""}</span></div>
                <div className="flex justify-between"><span>涨跌幅</span><span className="font-mono text-white">{selectedQuote?.changePct == null ? "—" : `${selectedQuote.changePct >= 0 ? "+" : ""}${selectedQuote.changePct.toFixed(2)}%`}</span></div>
                <div className="flex justify-between"><span>估算名义金额</span><span className="font-mono text-white">{effectivePrice > 0 ? estimatedNotional.toLocaleString() : "—"}</span></div>
                <div className="mt-1 flex items-center gap-1 text-amber-300"><Clock className="h-3 w-3" />{selectedQuote?.observedAt ?? "未取得观察时间"} · {selectedQuote?.source ?? "无来源"}</div>
              </div>
              <button type="button" disabled className="col-span-2 cursor-not-allowed rounded border border-gray-700 bg-gray-800 py-2 text-[10px] text-gray-500">
                {side === "BUY" ? "买入" : "卖出"}（等待经纪商授权，未发送）
              </button>
            </div>
          </>
        )}

        {tab === "orders" && (
          <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-[10px] text-amber-200">
            <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
            没有可核验的账户订单或成交回执。系统已移除原先的示例订单，不把内存样本当成用户真实交易。
          </div>
        )}
        {tab === "quality" && (
          <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-[10px] text-amber-200">
            没有真实成交集合、基准价和执行时间戳，无法计算滑点、成交率、VWAP 偏差或市场冲击；显示空状态而不是随机指标。
          </div>
        )}
        {tab === "vol" && (
          <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-[10px] text-amber-200">
            当前公开行情接口未提供可审计的逐笔成交量流，无法绘制真实日内成交量分布。收到可用的交易所/数据商授权后，此处复用同一数据合同。
          </div>
        )}
      </div>

      {showMenu && <div className="absolute inset-0 z-10"><ElectronicTradingMenu onClose={() => setShowMenu(false)} /></div>}
    </div>
  );
}
