/**
 * WEI 行情综合大屏：所有标的都用 K 线展示，价格与最后一根 K 线随实时报价跳动。
 *  - 主图：任意代码（指数 / A股 / 港股 / 美股 / 期货 / 外汇），分时到月线
 *  - 盘口 + 涨跌榜 + 涨跌家数
 *  - 板块迷你 K 线矩阵（点击切换主图）
 *  - 实时行情表（可排序）
 */
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownUp, Search } from "lucide-react";
import KlineChart from "./KlineChart";
import {
  DOWN, FLAT, UP, fmtCompact, fmtPct, fmtPrice, toneOf, ucGet, useFlash, useLiveKline, usePolled, useSession, useTicks,
  type Period, type Tick,
} from "./live";
import { INDICATOR_LABELS, OVERLAYS, SUBS, type OverlayId, type SubId } from "./indicators";
import { FundamentalPanel, NewsPanel, TechnicalPanel } from "./WeiInsights";

const readPref = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writePref = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 无痕模式下不保存 */
  }
};

type Board = { id: string; label: string; symbols: Array<{ symbol: string; name: string | null }> };

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "1m", label: "分时" },
  { id: "5m", label: "5分" },
  { id: "15m", label: "15分" },
  { id: "60m", label: "60分" },
  { id: "1d", label: "日K" },
  { id: "1w", label: "周K" },
  { id: "1M", label: "月K" },
];

let boardsCache: Board[] | null = null;
function useBoards() {
  const [boards, setBoards] = useState<Board[]>(boardsCache ?? []);
  useEffect(() => {
    if (boardsCache) return;
    let alive = true;
    ucGet<Board[]>("ucMarket.boards", undefined).then((b) => {
      boardsCache = b;
      if (alive) setBoards(b);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return boards;
}

function PriceText({ value, tone, className = "" }: { value: number | null | undefined; tone: string; className?: string }) {
  const flash = useFlash(value);
  return (
    <span
      className={`font-mono tabular-nums transition-colors duration-500 ${className}`}
      style={{ color: tone, backgroundColor: flash === "up" ? "rgba(242,73,92,.22)" : flash === "down" ? "rgba(31,191,117,.22)" : "transparent" }}
    >
      {fmtPrice(value)}
    </span>
  );
}

function MiniCard({ symbol, name, active, onSelect, tick }: { symbol: string; name: string | null; active: boolean; onSelect: () => void; tick: Tick | null | undefined }) {
  const { candles, loading } = useLiveKline(symbol, "5m", 64);
  const tone = toneOf(tick?.changePct);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex min-w-0 flex-col border text-left transition-colors ${active ? "border-cyan-400/80 bg-[#0b2238]" : "border-[#15304a] bg-[#081625] hover:border-cyan-700"}`}
    >
      <div className="flex items-baseline justify-between gap-1 px-2 pt-1.5">
        <span className="truncate text-[11px] font-medium text-slate-200">{tick?.name ?? name ?? symbol}</span>
        <span className="shrink-0 font-mono text-[9px] text-slate-500">{symbol}</span>
      </div>
      <div className="flex items-baseline justify-between gap-1 px-2">
        <PriceText value={tick?.price} tone={tone} className="text-[14px] font-semibold" />
        <span className="font-mono text-[10px]" style={{ color: tone }}>{fmtPct(tick?.changePct)}</span>
      </div>
      <div className="px-1 pb-1">
        {candles.length ? <KlineChart candles={candles} period="5m" height={46} mini live prevClose={tick?.prevClose} /> : <div className="flex h-[46px] items-center justify-center text-[9px] text-slate-600">{loading ? "K线读取中…" : "暂无K线"}</div>}
      </div>
    </button>
  );
}

type SortKey = "name" | "price" | "changePct" | "volume" | "amount";

export default function WeiMarketScreen({ boardId, onBoardChange, focusSymbol, focusName }: { boardId: string; onBoardChange?: (id: string) => void; focusSymbol?: string | null; focusName?: string | null }) {
  const boards = useBoards();
  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const symbols = useMemo(() => board?.symbols.map((s) => s.symbol) ?? [], [board]);
  const [selected, setSelected] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("1m");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "changePct", dir: -1 });
  const [overlayId, setOverlayId] = useState<OverlayId>(() => readPref<OverlayId>("uc.wei.overlay", "MA"));
  const [subs, setSubs] = useState<SubId[]>(() => readPref<SubId[]>("uc.wei.subs", ["VOL", "MACD", "KDJ"]));
  const [showPicker, setShowPicker] = useState(false);
  const [showSignals, setShowSignals] = useState<boolean>(() => readPref<boolean>("uc.wei.signals", true));
  useEffect(() => writePref("uc.wei.signals", showSignals), [showSignals]);
  useEffect(() => writePref("uc.wei.overlay", overlayId), [overlayId]);
  useEffect(() => writePref("uc.wei.subs", subs), [subs]);
  const toggleSub = (id: SubId) => setSubs((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-5)));

  // 切换板块回到该板块第一个标的；外部（证券清单）点选的代码优先
  const boardKey = symbols.join("|");
  const [prevBoardKey, setPrevBoardKey] = useState(boardKey);
  useEffect(() => {
    // 首次加载板块时保留外部点选的代码
    if (!prevBoardKey && selected) {
      setPrevBoardKey(boardKey);
      return;
    }
    setPrevBoardKey(boardKey);
    setSelected(symbols[0] ?? null);
  }, [boardKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focusSymbol) setSelected(focusSymbol);
  }, [focusSymbol]);

  const current = selected ?? symbols[0] ?? null;
  const ticks = useTicks(current && !symbols.includes(current) ? [...symbols, current] : symbols);
  const main = useLiveKline(current, period, period === "1m" ? 1000 : period.endsWith("m") ? 480 : 320);
  const session = useSession(current);
  const usSyms = useMemo(() => symbols.filter((x) => /^[A-Z]{1,5}([.-][A-Z])?$/.test(x)), [symbols]);
  const sessions = usePolled<Record<string, { state: string; pre: { price: number; changePct: number } | null; post: { price: number; changePct: number } | null } | null>>("ucMarket.sessions", usSyms.length ? { symbols: usSyms } : null, 30_000);
  const tick = (current ? ticks[current] : null) ?? main.tick;
  const tone = toneOf(tick?.changePct);
  const nameOf = (s: string) => ticks[s]?.name ?? board?.symbols.find((x) => x.symbol === s)?.name ?? (s === focusSymbol ? focusName : null) ?? s;

  const rows = useMemo(() => {
    const list = symbols.map((s) => ({ symbol: s, name: nameOf(s), tick: ticks[s] ?? null }));
    const val = (r: (typeof list)[number]) => {
      switch (sort.key) {
        case "name": return r.name ?? "";
        case "price": return r.tick?.price ?? -Infinity;
        case "changePct": return r.tick?.changePct ?? -Infinity;
        case "volume": return r.tick?.volume ?? -Infinity;
        case "amount": return r.tick?.amount ?? -Infinity;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      return (typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number)) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols, ticks, sort]);
  const priced = rows.filter((r) => r.tick?.changePct != null);
  const upN = priced.filter((r) => (r.tick!.changePct ?? 0) > 0).length;
  const downN = priced.filter((r) => (r.tick!.changePct ?? 0) < 0).length;
  const flatN = priced.length - upN - downN;
  const gainers = [...priced].sort((a, b) => b.tick!.changePct! - a.tick!.changePct!).slice(0, 5);
  const losers = [...priced].sort((a, b) => a.tick!.changePct! - b.tick!.changePct!).slice(0, 5);
  const amplitude = tick?.high != null && tick?.low != null && tick?.prevClose ? ((tick.high - tick.low) / tick.prevClose) * 100 : null;
  const lastUpdate = tick?.time ? new Date(tick.time).toLocaleTimeString("zh-CN", { hour12: false }) : null;
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    setSelected(/^\d{6}$/.test(q) ? (/^[569]/.test(q) ? `${q}.SH` : `${q}.SZ`) : /^\d{1,5}$/.test(q) ? `${q.padStart(4, "0")}.HK` : q.toUpperCase());
    setSearch("");
  };

  return (
    <div className="min-w-0 bg-[#060f1b] text-slate-200" aria-label="WEI 行情综合大屏">
      {/* 板块切换 */}
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-[#15304a] bg-[#071a2c] px-2 py-1.5">
        <span className="mr-1 flex shrink-0 items-center gap-1 text-[11px] font-semibold text-cyan-200"><Activity className="h-3.5 w-3.5 text-cyan-300" />行情综合大屏</span>
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onBoardChange?.(b.id)}
            className={`shrink-0 rounded-sm px-2 py-0.5 text-[10px] ${b.id === board?.id ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/50" : "text-slate-400 hover:text-slate-100"}`}
          >
            {b.label}
          </button>
        ))}
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[9px] text-slate-500">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
          实时 · 3秒刷新
        </span>
      </div>

      <div className="grid min-w-0 gap-px bg-[#15304a] lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* 主图 */}
        <section className="min-w-0 bg-[#060f1b]">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1 border-b border-[#15304a] px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[14px] font-semibold text-slate-100">{current ? nameOf(current) : "—"}</span>
                <span className="font-mono text-[10px] text-slate-500">{current}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <PriceText value={tick?.price} tone={tone} className="text-[24px] font-bold leading-7" />
                <span className="font-mono text-[12px]" style={{ color: tone }}>{tick?.change == null ? "" : `${tick.change > 0 ? "+" : ""}${fmtPrice(tick.change)}`}</span>
                <span className="font-mono text-[12px]" style={{ color: tone }}>{fmtPct(tick?.changePct)}</span>
              </div>
              {session.data && (session.data.pre || session.data.post) && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-[10px]">
                  <span className={`rounded-sm px-1 text-[9px] ${session.data.state === "pre" ? "bg-blue-500/25 text-blue-200" : session.data.state === "post" ? "bg-violet-500/25 text-violet-200" : session.data.state === "regular" ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-600/30 text-slate-300"}`}>{({ pre: "盘前交易中", regular: "盘中", post: "盘后交易中", closed: "已收盘" } as const)[session.data.state]}</span>
                  {session.data.pre && <span className="text-slate-400">盘前 <b className="font-normal" style={{ color: toneOf(session.data.pre.changePct) }}>{fmtPrice(session.data.pre.price)} {fmtPct(session.data.pre.changePct)}</b> <span className="text-slate-600">{new Date(session.data.pre.time).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}</span></span>}
                  {session.data.post && <span className="text-slate-400">盘后 <b className="font-normal" style={{ color: toneOf(session.data.post.changePct) }}>{fmtPrice(session.data.post.price)} {fmtPct(session.data.post.changePct)}</b> <span className="text-slate-600">{new Date(session.data.post.time).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}</span></span>}
                </div>
              )}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <div className="flex items-center border border-[#1d3b58] bg-[#081625]">
                <Search className="ml-1.5 h-3 w-3 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                  placeholder="600519 / AAPL / 0700 / 7203.T / SAP.DE"
                  aria-label="输入代码查看K线"
                  className="h-6 w-[190px] bg-transparent px-1.5 text-[10px] text-slate-100 outline-none placeholder:text-slate-600"
                />
              </div>
              <div className="flex border border-[#1d3b58]">
                {PERIODS.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={`px-2 py-1 text-[10px] ${period === p.id ? "bg-cyan-600/30 text-cyan-100" : "text-slate-400 hover:bg-[#0c2236] hover:text-slate-100"}`}>{p.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b border-[#15304a] px-2 py-1 text-[10px]">
            <span className="text-slate-500">主图</span>
            {OVERLAYS.map((o) => (
              <button key={o} type="button" title={INDICATOR_LABELS[o]} onClick={() => setOverlayId(o)} className={`px-1.5 py-0.5 ${overlayId === o ? "bg-amber-500/20 text-amber-200" : "text-slate-400 hover:text-slate-100"}`}>{o === "NONE" ? "无" : o}</button>
            ))}
            <button type="button" onClick={() => setShowSignals((v) => !v)} title="MACD / KDJ / 均线 / SAR / BOLL / RSI 多条件共振时标出买点 B 与卖点 S，随实时行情更新" className={`ml-1 px-1.5 py-0.5 ${showSignals ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:text-slate-100"}`}>买卖点 {showSignals ? "开" : "关"}</button>
            <span className="ml-2 text-slate-500">副图</span>
            {subs.map((id) => (
              <button key={id} type="button" title={`${INDICATOR_LABELS[id]}（点击移除）`} onClick={() => toggleSub(id)} className="bg-cyan-500/15 px-1.5 py-0.5 text-cyan-100 hover:bg-red-500/20">{id} ×</button>
            ))}
            <button type="button" onClick={() => setShowPicker((v) => !v)} className="border border-dashed border-cyan-700 px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-500/10">＋ 指标</button>
            {showPicker && (
              <div className="flex w-full flex-wrap gap-1 pt-1">
                {SUBS.map((id) => (
                  <button key={id} type="button" onClick={() => toggleSub(id)} className={`px-1.5 py-0.5 ${subs.includes(id) ? "bg-cyan-600/30 text-cyan-100" : "bg-[#0a1b2d] text-slate-400 hover:text-slate-100"}`}>{id}<span className="ml-1 text-[9px] text-slate-500">{INDICATOR_LABELS[id]}</span></button>
                ))}
                <span className="self-center text-[9px] text-slate-600">最多同时显示 5 个副图</span>
              </div>
            )}
          </div>
          <div className="px-1 pt-1">
            {main.candles.length ? (
              <KlineChart candles={main.candles} period={period} height={330 + subs.length * 88} live overlay={overlayId} subs={subs} onRemoveSub={toggleSub} signals={showSignals} prevClose={period === "1m" ? tick?.prevClose : null} />
            ) : (
              <div className="flex h-[360px] items-center justify-center text-[11px] text-slate-500">{main.loading ? "K线读取中…" : current ? "该代码暂无K线，请换一个代码或周期" : "请选择标的"}</div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[#15304a] px-3 py-1 text-[9px] text-slate-500">
            <span>滚轮缩放 · 拖拽平移 · 双击回到最新</span>
            <span>{lastUpdate ? `行情时间 ${lastUpdate}` : "等待行情"}</span>
          </div>
        </section>

        {/* 盘口 + 涨跌榜 */}
        <aside className="min-w-0 bg-[#060f1b] text-[10px]">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-[#15304a] px-3 py-2">
            {[
              ["今开", fmtPrice(tick?.open), toneOf(tick?.open != null && tick?.prevClose != null ? tick.open - tick.prevClose : null)],
              ["昨收", fmtPrice(tick?.prevClose), FLAT],
              ["最高", fmtPrice(tick?.high), UP],
              ["最低", fmtPrice(tick?.low), DOWN],
              ["成交量", fmtCompact(tick?.volume), "#cbd5e1"],
              ["成交额", fmtCompact(tick?.amount), "#cbd5e1"],
              ["振幅", amplitude == null ? "—" : `${amplitude.toFixed(2)}%`, "#cbd5e1"],
              ["涨跌", tick?.change == null ? "—" : fmtPrice(tick.change), tone],
            ].map(([k, v, c]) => (
              <div key={k} className="flex items-center justify-between"><span className="text-slate-500">{k}</span><span className="font-mono" style={{ color: c }}>{v}</span></div>
            ))}
          </div>
          <div className="border-b border-[#15304a] px-3 py-2">
            <div className="mb-1 flex justify-between text-[9px] text-slate-500"><span>{board?.label ?? ""} 涨跌分布</span><span>{priced.length} 只</span></div>
            <div className="flex h-2 overflow-hidden rounded-sm bg-slate-800">
              <div style={{ width: `${priced.length ? (upN / priced.length) * 100 : 0}%`, background: UP }} />
              <div style={{ width: `${priced.length ? (flatN / priced.length) * 100 : 0}%`, background: FLAT }} />
              <div style={{ width: `${priced.length ? (downN / priced.length) * 100 : 0}%`, background: DOWN }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px]"><span style={{ color: UP }}>涨 {upN}</span><span className="text-slate-400">平 {flatN}</span><span style={{ color: DOWN }}>跌 {downN}</span></div>
          </div>
          {[["涨幅榜", gainers], ["跌幅榜", losers]].map(([title, list]) => (
            <div key={title as string} className="border-b border-[#15304a]">
              <div className="px-3 pt-1.5 text-[9px] text-slate-500">{title as string}</div>
              {(list as typeof rows).map((r, i) => (
                <button key={r.symbol} type="button" onClick={() => setSelected(r.symbol)} className="grid w-full grid-cols-[14px_minmax(0,1fr)_64px_54px] items-center gap-1 px-3 py-1 text-left hover:bg-[#0c2236]">
                  <span className="font-mono text-[9px] text-slate-600">{i + 1}</span>
                  <span className="truncate text-slate-300">{r.name}</span>
                  <span className="text-right font-mono" style={{ color: toneOf(r.tick?.changePct) }}>{fmtPrice(r.tick?.price)}</span>
                  <span className="text-right font-mono" style={{ color: toneOf(r.tick?.changePct) }}>{fmtPct(r.tick?.changePct)}</span>
                </button>
              ))}
              {!(list as typeof rows).length && <div className="px-3 py-2 text-[9px] text-slate-600">行情读取中…</div>}
            </div>
          ))}
        </aside>
      </div>

      {/* 技术面 · 基本面 · 相关新闻 */}
      {current && (
        <div className="grid min-w-0 gap-px border-t border-[#15304a] bg-[#15304a] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
          <TechnicalPanel candles={main.candles} period={period} symbol={current} />
          <FundamentalPanel symbol={current} />
          <NewsPanel symbol={current} name={nameOf(current)} />
        </div>
      )}

      {/* 迷你 K 线矩阵 */}
      <div className="grid min-w-0 grid-cols-2 gap-1 border-t border-[#15304a] bg-[#050c16] p-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        {symbols.map((s) => (
          <MiniCard key={s} symbol={s} name={nameOf(s)} active={s === current} onSelect={() => setSelected(s)} tick={ticks[s]} />
        ))}
      </div>

      {/* 实时行情表 */}
      <div className="max-w-full overflow-x-auto border-t border-[#15304a]">
        <table className="w-full min-w-[720px] text-left text-[10px]" aria-label={`${board?.label ?? ""}实时行情`}>
          <thead className="bg-[#0a1b2d] text-slate-500">
            <tr>
              {([["name", "名称"], ["price", "最新"], ["changePct", "涨跌幅"]] as Array<[SortKey, string]>).map(([k, label]) => (
                <th key={k} className={`px-2 py-1.5 ${k === "name" ? "" : "text-right"}`}><button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-0.5 hover:text-slate-200">{label}<ArrowDownUp className="h-2.5 w-2.5" /></button></th>
              ))}
              <th className="text-right">涨跌</th>
              <th className="text-right">今开</th>
              <th className="text-right">最高</th>
              <th className="text-right">最低</th>
              <th className="text-right"><button type="button" onClick={() => sortBy("volume")} className="inline-flex items-center gap-0.5 hover:text-slate-200">成交量<ArrowDownUp className="h-2.5 w-2.5" /></button></th>
              <th className="text-right"><button type="button" onClick={() => sortBy("amount")} className="inline-flex items-center gap-0.5 hover:text-slate-200">成交额<ArrowDownUp className="h-2.5 w-2.5" /></button></th>
              {usSyms.length > 0 && <th className="text-right">盘前 / 盘后</th>}
              <th className="px-2 text-right">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#102538]">
            {rows.map((r) => {
              const t = r.tick;
              const c = toneOf(t?.changePct);
              return (
                <tr key={r.symbol} onClick={() => setSelected(r.symbol)} className={`cursor-pointer ${r.symbol === current ? "bg-[#0b2238]" : "hover:bg-[#0a1a2b]"}`}>
                  <td className="px-2 py-1"><span className="text-slate-200">{r.name}</span><span className="ml-1.5 font-mono text-[9px] text-slate-500">{r.symbol}</span></td>
                  <td className="px-2 text-right"><PriceText value={t?.price} tone={c} /></td>
                  <td className="px-2 text-right font-mono" style={{ color: c }}>{fmtPct(t?.changePct)}</td>
                  <td className="text-right font-mono" style={{ color: c }}>{t?.change == null ? "—" : fmtPrice(t.change)}</td>
                  <td className="text-right font-mono text-slate-300">{fmtPrice(t?.open)}</td>
                  <td className="text-right font-mono" style={{ color: UP }}>{fmtPrice(t?.high)}</td>
                  <td className="text-right font-mono" style={{ color: DOWN }}>{fmtPrice(t?.low)}</td>
                  <td className="text-right font-mono text-slate-400">{fmtCompact(t?.volume)}</td>
                  <td className="text-right font-mono text-slate-400">{fmtCompact(t?.amount)}</td>
                  {usSyms.length > 0 && (() => {
                    const ss = sessions.data?.[r.symbol];
                    const ext = ss?.post ?? ss?.pre;
                    return <td className="text-right font-mono" style={{ color: toneOf(ext?.changePct) }} title={ss ? `盘前 ${ss.pre ? fmtPrice(ss.pre.price) : "—"} · 盘后 ${ss.post ? fmtPrice(ss.post.price) : "—"}` : ""}>{ext ? <>{ss?.post ? "后" : "前"} {fmtPrice(ext.price)} {fmtPct(ext.changePct)}</> : "—"}</td>;
                  })()}
                  <td className="px-2 text-right font-mono text-slate-500">{t?.time ? new Date(t.time).toLocaleTimeString("zh-CN", { hour12: false }) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
