/**
 * 新闻与研究中心（/news-hub）：实时多语种新闻终端。
 * 左侧是当前功能，右侧是阅读器；底部是快讯滚动条。所有按钮都对应真实数据或真实操作。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";
import { usePolled } from "@/uc/market/live";
import { DEFAULT_PREFS, FeedList, NewsCtx, Reader, fmtTime, readLocal, readLocalList, toneColor, useFeed, writeLocal, type News, type Prefs } from "./kit";
import {
  ALERT_KEY, ALERT_LOG_KEY, AlertView, BriefView, CommodityView, FilingsView, FlashView, GlobalView, HeatView, IndustryView, MacroView, MyNewsView, OpinionView,
  SentimentView, SettingsView, SymbolView, TopView, TrendView, ruleLabel, ruleMatches, type AlertRule,
} from "./views";

const FUNCS: Array<[string, string, string]> = [
  ["top", "TOP", "头条要闻"],
  ["firs", "FIRS", "7×24快讯"],
  ["cn", "CN", "标的研究"],
  ["ni", "NI", "行业主题"],
  ["beco", "BECO", "宏观与央行"],
  ["read", "READ", "热度榜"],
  ["tren", "TREN", "热词趋势"],
  ["soci", "SOCI", "情绪雷达"],
  ["intl", "INTL", "全球多语种"],
  ["opin", "OPIN", "观点评论"],
  ["docs", "DOCS", "公司公告"],
  ["bnef", "BNEF", "能源商品"],
  ["dayb", "DAYB", "每日简报"],
  ["myn", "MYN", "我的新闻"],
  ["nlrt", "NLRT", "新闻提醒"],
  ["nzpd", "NZPD", "偏好设置"],
];
/** 旧功能代码合并到对应的新功能（同质化的子页合并为一个） */
const ALIAS: Record<string, string> = {
  cmnt: "opin", mdia: "opin", "3rd": "intl", pers: "myn", socl: "soci",
  nh: "firs", btdy: "dayb", mrep: "dayb", frnt: "top", bi: "ni", mag: "opin", media: "opin", medi: "opin", commentary: "opin", third: "intl", personal: "myn", nsub: "myn", social: "soci",
};
const PREFS_KEY = "uc.news.prefs";

export default function NewsTerminal() {
  const [prefs, setPrefsState] = useState<Prefs>(() => readLocal(PREFS_KEY, DEFAULT_PREFS));
  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    writeLocal(PREFS_KEY, p);
  };
  const initial = useMemo(() => {
    const t = new URLSearchParams(window.location.search).get("tab")?.toLowerCase();
    const id = t ? ALIAS[t] ?? t : prefs.home;
    return FUNCS.some(([f]) => f === id) ? id : "top";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [func, setFunc] = useState(initial);
  // 从功能主目录点任意代码进来（同一页面内切换）都直接显示对应功能
  const search = useSearch();
  useEffect(() => {
    const t = new URLSearchParams(search).get("tab")?.toLowerCase();
    if (!t) return;
    const id = ALIAS[t] ?? t;
    if (FUNCS.some(([f]) => f === id)) {
      setFunc(id);
      setSearchQ(null);
    }
    const sym = new URLSearchParams(search).get("symbol");
    if (sym) setSymbol(sym.toUpperCase());
  }, [search]);
  const [symbol, setSymbol] = useState(() => new URLSearchParams(window.location.search).get("symbol")?.toUpperCase() ?? "NVDA");
  const [reading, setReading] = useState<News | null>(null);
  const [cmd, setCmd] = useState("");

  const go = (f: string) => {
    setFunc(f);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", f);
    window.history.replaceState(null, "", url);
  };
  const openSymbol = useCallback((s: string) => {
    setSymbol(s);
    setFunc("cn");
  }, []);

  // 命令框：功能代码 / 标的代码 / 关键词
  const runCmd = () => {
    const raw = cmd.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    const f = FUNCS.find(([id, code]) => id === lower || code.toLowerCase() === lower) ?? (ALIAS[lower] ? FUNCS.find(([id]) => id === ALIAS[lower]) : undefined);
    if (f) go(f[0]);
    else if (/^[\^A-Za-z0-9.\-=]{1,12}$/.test(raw) && !/^[a-z]+$/.test(raw)) openSymbol(/^\d{6}$/.test(raw) ? `${raw}.${/^[569]/.test(raw) ? "SH" : "SZ"}` : raw.toUpperCase());
    else setSearchQ(raw);
    setCmd("");
  };
  const [searchQ, setSearchQ] = useState<string | null>(null);
  const searchFeed = useFeed(searchQ ? { q: searchQ, limit: 150, hours: 96 } : null);

  // 提醒：轮询最新新闻，命中规则就弹出
  const [alertLog, setAlertLog] = useState<Array<{ at: number; rule: string; item: News }>>(() => readLocalList(ALERT_LOG_KEY, []));
  const latest = useFeed({ limit: 60, dedupe: false }, 30_000);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!latest.items.length) return;
    if (!seen.current) {
      seen.current = new Set(latest.items.map((n) => n.id));
      return;
    }
    const rules = readLocalList<AlertRule>(ALERT_KEY, []).filter((r) => r.on);
    const hits: Array<{ at: number; rule: string; item: News }> = [];
    for (const n of latest.items) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      const r = rules.find((x) => ruleMatches(x, n));
      if (r) hits.push({ at: Date.now(), rule: ruleLabel(r), item: n });
    }
    if (!hits.length) return;
    setAlertLog((log) => {
      const next = [...hits, ...log].slice(0, 200);
      writeLocal(ALERT_LOG_KEY, next);
      return next;
    });
    for (const h of hits.slice(0, 3)) {
      toast(`提醒 ${h.rule}`, { description: h.item.title, action: { label: "阅读", onClick: () => setReading(h.item) } });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(`佑诚新闻提醒 ${h.rule}`, { body: h.item.title });
      } catch {
        /* 通知不可用 */
      }
    }
  }, [latest.items]);

  const stats = usePolled<{ last24h: number; lastHour: number; newest: number; channelsOk: number; channels: number }>("ucNews.stats", {}, 60_000);
  const tape = useFeed({ kind: "flash", limit: 30 }, 20_000);
  const ctx = useMemo(() => ({ prefs, open: setReading, openSymbol, selected: reading?.id ?? null }), [prefs, openSymbol, reading?.id]);

  const view = searchQ ? (
    <div>
      <div className="flex items-center justify-between border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1 text-[11px]"><span className="text-cyan-200">检索「{searchQ}」 · {searchFeed.items.length} 条</span><button type="button" onClick={() => setSearchQ(null)} className="text-slate-400 hover:text-white">返回 ✕</button></div>
      <SearchResults items={searchFeed.items} loading={searchFeed.loading} />
    </div>
  ) : func === "top" ? <TopView />
    : func === "firs" ? <FlashView />
    : func === "cn" ? <SymbolView symbol={symbol} setSymbol={setSymbol} />
    : func === "ni" ? <IndustryView />
    : func === "beco" ? <MacroView />
    : func === "read" ? <HeatView />
    : func === "tren" ? <TrendView />
    : func === "soci" ? <SentimentView />
    : func === "intl" ? <GlobalView />
    : func === "opin" ? <OpinionView />
    : func === "docs" ? <FilingsView />
    : func === "bnef" ? <CommodityView />
    : func === "dayb" ? <BriefView />
    : func === "myn" ? <MyNewsView />
    : func === "nlrt" ? <AlertView log={alertLog} clearLog={() => { setAlertLog([]); writeLocal(ALERT_LOG_KEY, []); }} />
    : <SettingsView prefs={prefs} setPrefs={setPrefs} codes={FUNCS.map(([id, , l]) => [id, l])} />;

  return (
    <NewsCtx.Provider value={ctx}>
      <div className="flex h-[calc(100vh-56px)] min-h-[640px] flex-col bg-[#03070c] text-slate-200" aria-label="新闻与研究中心">
        {/* 顶栏 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#1a2a3c] bg-[#060d16] px-2 py-1">
          <span className="text-[13px] font-semibold tracking-wide text-white">新闻与研究</span>
          <div className="flex items-center border border-[#1d3047] bg-[#03070c]">
            <span className="px-1.5 font-mono text-[11px] text-amber-300">&gt;</span>
            <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCmd()} placeholder="功能代码 / 标的代码 / 关键词，回车" className="h-6 w-[240px] bg-transparent font-mono text-[11px] text-slate-100 outline-none placeholder:text-slate-600" aria-label="命令框" />
          </div>
          <span className="ml-auto flex items-center gap-3 font-mono text-[10px] text-slate-500">
            <span>24h <b className="text-slate-200">{stats.data?.last24h ?? "—"}</b></span>
            <span>1h <b className="text-slate-200">{stats.data?.lastHour ?? "—"}</b></span>
            <span>频道 <b className={stats.data && stats.data.channelsOk < stats.data.channels / 2 ? "text-amber-300" : "text-emerald-300"}>{stats.data ? `${stats.data.channelsOk}/${stats.data.channels}` : "—"}</b></span>
            <span>更新 <b className="text-slate-200">{stats.data?.newest ? fmtTime(stats.data.newest) : "—"}</b></span>
          </span>
        </div>
        {/* 功能条 */}
        <nav className="flex min-w-0 overflow-x-auto border-b border-[#1a2a3c] bg-[#050b13]" aria-label="新闻功能">
          {FUNCS.map(([id, code, label]) => (
            <button key={id} type="button" onClick={() => { setSearchQ(null); go(id); }} className={`shrink-0 border-r border-[#111d2b] px-2.5 py-1 text-left ${func === id && !searchQ ? "bg-[#0d2236] shadow-[inset_0_-2px_0_#22d3ee]" : "hover:bg-[#0a1726]"}`}>
              <span className={`block font-mono text-[10px] ${func === id && !searchQ ? "text-amber-300" : "text-amber-300/60"}`}>{code}</span>
              <span className={`block text-[11px] ${func === id && !searchQ ? "text-white" : "text-slate-400"}`}>{label}{id === "nlrt" && alertLog.length ? <b className="ml-1 text-[9px] text-red-400">{Math.min(99, alertLog.length)}</b> : null}</span>
            </button>
          ))}
        </nav>
        {/* 主体 */}
        <div className={`grid min-h-0 flex-1 ${reading ? "lg:grid-cols-[minmax(0,1fr)_minmax(380px,44%)]" : "grid-cols-1"}`}>
          <div className="min-h-0 overflow-y-auto">{view}</div>
          {reading && <div className="min-h-0 border-l border-[#1a2a3c] bg-[#050a11]"><Reader item={reading} onClose={() => setReading(null)} /></div>}
        </div>
        {/* 快讯滚动条 */}
        <div className="flex h-[24px] shrink-0 items-center overflow-hidden border-t border-[#1a2a3c] bg-[#060d16]">
          <span className="shrink-0 bg-amber-500/90 px-2 text-[10px] font-semibold leading-[24px] text-black">快讯</span>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="uc-tape flex w-max gap-8 whitespace-nowrap pl-4">
              {[...tape.items, ...tape.items].map((n, i) => (
                <button key={`${n.id}-${i}`} type="button" onClick={() => setReading(n)} className="text-[11px] text-slate-300 hover:text-white">
                  <span className="mr-1 font-mono text-[10px] text-slate-500">{fmtTime(n.time)}</span>
                  <span style={{ color: n.tone ? toneColor(n.tone) : undefined }}>{n.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <style>{`.uc-tape{animation:uc-tape ${Math.max(60, tape.items.length * 6)}s linear infinite}.uc-tape:hover{animation-play-state:paused}@keyframes uc-tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      </div>
    </NewsCtx.Provider>
  );
}

function SearchResults({ items, loading }: { items: News[]; loading: boolean }) {
  return <FeedList items={items} loading={loading} empty="没有找到相关新闻" />;
}
