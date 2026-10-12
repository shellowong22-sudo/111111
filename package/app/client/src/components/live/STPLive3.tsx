/**
 * 直通式处理（STP）小窗功能 —— 第三组：确认消息 / 证券速拨目录 / 监管报告中心 / 法规资料库 / 平台运维。
 * 数据：平台自有交易系统（永久入库）、实时行情、证券检索与基本资料、监管机构新闻稿、政策新闻、平台运行指标。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useProfile, useTicks } from "@/uc/market/live";
import { Bars } from "@/uc/hubs/kit";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { DocList, Empty, Kpis, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { KIND_ZH, OrderTicket, STATUS_COLOR, STATUS_ZH, fmtTs, useEvents, useFills, useOrders, usePositions, useSummary, type Fill, type Order, type Position } from "@/uc/trade/kit";
import { Btn, Frame, NoTrades, ROUTE, SideTxt, TH, TR, downloadCsv, dueOf, mktName, sessionOf, today, uti, venueOf, type P } from "./STPLive";

/* ================================================================== IB 确认消息 */
function confirmText(f: Fill, name: string | null) {
  const r = ROUTE[f.market];
  return [
    "【成交确认书】",
    `确认编号：${uti(f)}`,
    `委托编号：${f.orderId}　成交编号：${f.id}　账户：${f.account}`,
    `标的：${name ?? f.symbol}（${f.symbol}）　执行场所：${venueOf(f.symbol, f.market)}`,
    `方向：${f.side === "B" ? "买入" : "卖出"}　数量：${f.qty}　成交价：${f.px} ${f.ccy}`,
    `成交金额：${f.notional.toFixed(2)} ${f.ccy}　佣金：${f.fee.toFixed(2)}　税费：${f.tax.toFixed(2)}`,
    `${f.side === "B" ? "应付" : "应收"}净额：${(f.side === "B" ? f.notional + f.fee + f.tax : f.notional - f.fee - f.tax).toFixed(2)} ${f.ccy}`,
    `成交时间：${new Date(f.ts).toLocaleString("zh-CN", { hour12: false })}`,
    `交易日：${f.tradeDate}　交收日：${f.settleDate}（${r?.cycle ?? ""}，${r?.csd ?? ""}）`,
    `交收状态：${f.settled ? "已交收" : "待交收"}`,
    "如对上述内容有异议，请于交收日前回复。",
  ].join("\n");
}
function orderNotice(o: Order) {
  const head = o.status === "REJECTED" ? "【委托拒绝通知】" : o.status === "CANCELLED" ? "【撤单确认】" : o.status === "EXPIRED" ? "【委托失效通知】" : "【委托受理回执】";
  return [head, `委托编号：${o.id}　账户：${o.account}`, `标的：${o.name ?? o.symbol}（${o.symbol}）`, `方向：${o.side === "B" ? "买入" : "卖出"}　类型：${({ MKT: "市价", LMT: "限价", STP: "止损" } as Record<string, string>)[o.type]}　有效期：${o.tif}`, `委托数量：${o.qty}　${o.type === "MKT" ? "" : `委托价：${o.limitPx ?? o.stopPx}　`}已成交：${o.filledQty}${o.avgPx ? ` @ ${o.avgPx}` : ""}`, `状态：${STATUS_ZH[o.status] ?? o.status}${o.reject ? `（${o.reject}）` : ""}`, `提交时间：${new Date(o.createdAt).toLocaleString("zh-CN", { hour12: false })}`].join("\n");
}
export function StpIB({ onClose }: P) {
  const o = useOrders();
  const f = useFills();
  const e = useEvents();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const ord = (o.data ?? []).filter((x) => !q || `${x.symbol}${x.name ?? ""}${x.id}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt);
  const cur = (o.data ?? []).find((x) => x.id === sel) ?? ord[0] ?? null;
  const evs = (e.data ?? []).filter((x) => x.orderId === cur?.id).sort((a, b) => a.ts - b.ts);
  const fs = (f.data ?? []).filter((x) => x.orderId === cur?.id).sort((a, b) => a.ts - b.ts);
  const copy = async (k: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { setCopied(`${k}!`); } };
  const msgCount = (id: number) => (e.data ?? []).filter((x) => x.orderId === id).length;
  return (
    <Frame code="IB" title="交易确认消息" onClose={onClose}>
      {!(o.data ?? []).length ? <NoTrades loading={o.loading && !o.data} what="暂无委托，消息会话为空。每笔委托形成一个会话：委托、成交、撤单、拒单事件按时间排列，并可一键生成标准确认书。" strategy="IB" /> :
        <div className="grid h-full min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto border-r border-[#1a2a3c]">
            <div className="px-2 py-1"><input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="按代码 / 名称 / 委托号筛选" className="w-full border border-[#1d3047] bg-[#07111c] px-1 text-[11px] text-white" /></div>
            {ord.map((x) => <button key={x.id} type="button" onClick={() => setSel(x.id)} className={`block w-full border-t border-[#0f1b29] px-2 py-1 text-left text-[11px] ${cur?.id === x.id ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
              <div className="flex justify-between"><span className="text-slate-100">{x.name ?? x.symbol} <SideTxt s={x.side} /></span><span className="font-mono text-[10px] text-slate-500">{fmtTs(x.updatedAt)}</span></div>
              <div className="flex justify-between text-[10px]"><span className="font-mono text-slate-500">#{x.id} · {x.qty}</span><span style={{ color: STATUS_COLOR[x.status] }}>{STATUS_ZH[x.status] ?? x.status} · {msgCount(x.id)} 条</span></div>
            </button>)}
          </div>
          <div className="min-h-0 overflow-y-auto">
            {cur && <>
              <SectionHead title={`会话 #${cur.id} · ${cur.name ?? cur.symbol}`} sub={`${mktName(cur.market)} · ${venueOf(cur.symbol, cur.market)}`} right={<Btn onClick={() => void copy("o", orderNotice(cur))}>{copied === "o" ? "已复制" : copied === "o!" ? "无法访问剪贴板" : "复制委托回执"}</Btn>} />
              <div className="space-y-1.5 p-2">
                {evs.map((x) => <div key={x.id} className="max-w-[640px] border-l-2 bg-[#07111c] px-2 py-1 text-[11px]" style={{ borderColor: x.kind === "FILL" ? "#34d399" : x.kind === "REJECT" ? "#f87171" : x.kind === "CANCEL" ? "#94a3b8" : "#fbbf24" }}><div className="flex justify-between text-[10px] text-slate-500"><span>{KIND_ZH[x.kind] ?? x.kind}</span><span className="font-mono">{fmtTs(x.ts)}</span></div><div className="text-slate-100">{x.detail}</div></div>)}
                {!evs.length && <Empty text="该委托暂无事件" />}
              </div>
              <SectionHead title="成交确认书" sub="按成交逐笔生成，内容全部取自成交记录" />
              {fs.map((x) => { const txt = confirmText(x, cur.name); return <div key={x.id} className="border-b border-[#0f1b29] p-2"><div className="mb-1 flex items-center justify-between text-[10px] text-slate-500"><span>成交 #{x.id}</span><Btn onClick={() => void copy(`f${x.id}`, txt)}>{copied === `f${x.id}` ? "已复制" : "复制确认书"}</Btn></div><pre className="whitespace-pre-wrap bg-[#050b13] p-2 font-mono text-[11px] text-slate-200">{txt}</pre></div>; })}
              {!fs.length && <div className="px-2 py-3 text-[11px] text-slate-500">该委托尚无成交，可复制委托回执。</div>}
            </>}
          </div>
        </div>}
    </Frame>
  );
}

/* ================================================================== SPDL 证券速拨目录 */
type Hit = { symbol: string; name: string; exchange: string; type: string; sector: string | null; industry: string | null };
export function StpSPDL({ onClose }: P) {
  const saved = useSaved<string[]>("stp.spdl");
  const f = useFills();
  const p = usePositions();
  const [list, setList] = useState<string[] | null>(null);
  useEffect(() => { if (!saved.loading && list == null) setList(saved.data ?? []); }, [saved.loading]);
  const book = useMemo(() => [...new Set([...(p.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9).map((r) => r.symbol), ...(f.data ?? []).map((x) => x.symbol)])], [p.data, f.data]);
  const all = [...new Set([...(list ?? []), ...book])].slice(0, 60);
  const t = useTicks(all);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const s = usePolled<Hit[]>("ucHubs.search", q ? { q } : null, 600_000);
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel ?? all[0] ?? null;
  const prof = useProfile(cur);
  const persist = (next: string[]) => { setList(next); void saveItem("stp.spdl", next); };
  const posOf = (sym: string) => (p.data?.rows ?? []).filter((r) => r.symbol === sym).reduce((a, r) => a + r.qty, 0);
  const lastFill = (sym: string) => (f.data ?? []).find((x) => x.symbol === sym);
  return (
    <Frame code="SPDL" title="证券速拨目录" onClose={onClose} right={<span>目录永久保存在平台数据库</span>}>
      <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 border-r border-[#1a2a3c]">
          <form onSubmit={(ev) => { ev.preventDefault(); setQ(input.trim()); }} className="flex items-center gap-1 px-2 py-1 text-[11px]"><input value={input} onChange={(ev) => setInput(ev.target.value)} placeholder="检索全球证券：代码或名称" className="w-60 border border-[#1d3047] bg-[#07111c] px-1 text-white" /><button className="border border-cyan-800 px-2 text-cyan-200">检索</button>{q && <button type="button" onClick={() => { setQ(""); setInput(""); }} className="text-[10px] text-slate-500">清除</button>}</form>
          {q && <table className="w-full text-[11px]"><tbody>{(s.data ?? []).slice(0, 12).map((h) => <tr key={h.symbol} className={TR}><td className="px-2 py-0.5 font-mono text-cyan-200">{h.symbol}</td><td className="text-slate-100">{h.name}</td><td className="text-[10px] text-slate-400">{h.type} · {h.exchange}</td><td className="px-2 text-right"><Btn disabled={!list || list.includes(h.symbol)} onClick={() => persist([...(list ?? []), h.symbol])}>{list?.includes(h.symbol) ? "已在目录" : "加入目录"}</Btn></td></tr>)}{!s.data?.length && <tr><td><Empty loading={s.loading} text="无匹配结果" /></td></tr>}</tbody></table>}
          <SectionHead title="速拨目录" sub="自选证券 + 持仓与成交过的证券；点击行查看资料并下单" />
          <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">名称</th><th className="text-left">场所</th><th className="text-right">最新</th><th className="text-right">涨跌幅</th><th className="text-right">持仓</th><th className="text-right">最近成交</th><th className="px-2" /></tr></thead>
            <tbody>{all.map((sym) => { const lf = lastFill(sym); const mine = list?.includes(sym); return <tr key={sym} onClick={() => setSel(sym)} className={`cursor-pointer border-t border-[#0f1b29] ${cur === sym ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5 text-slate-100">{t[sym]?.name ?? sym}<span className="ml-1 font-mono text-[9px] text-slate-600">{sym}</span></td><td className="text-slate-400">{venueOf(sym, lf?.market)}</td><td className="text-right font-mono text-white">{fmtPrice(t[sym]?.price)}</td><td className="text-right font-mono" style={{ color: toneOf(t[sym]?.changePct) }}>{fmtPct(t[sym]?.changePct)}</td><td className="text-right font-mono">{posOf(sym) || ""}</td><td className="text-right font-mono text-[10px] text-slate-500">{lf ? fmtTs(lf.ts) : ""}</td><td className="px-2 text-right">{mine ? <button type="button" onClick={(ev) => { ev.stopPropagation(); persist((list ?? []).filter((x) => x !== sym)); }} className="text-[10px] text-slate-500 hover:text-red-300">移出</button> : <span className="text-[9px] text-slate-600">账户</span>}</td></tr>; })}{!all.length && <tr><td colSpan={7}><Empty loading={saved.loading} text="目录为空：用上方检索加入证券，或成交后自动出现" /></td></tr>}</tbody></table>
        </div>
        <div className="min-w-0">
          {cur ? <>
            <SectionHead title={`${t[cur]?.name ?? prof.data?.name ?? cur}`} sub={cur} />
            <table className="w-full text-[11px]"><tbody>{([["交易所", prof.data?.exchange], ["计价币种", prof.data?.currency], ["行业", [prof.data?.sector, prof.data?.industry].filter(Boolean).join(" / ") || null], ...(prof.data?.metrics ?? []).slice(0, 10).map((m) => [m.label, m.value == null ? null : m.key === "mcap" || m.key === "float" ? fmtCompact(m.value) : `${m.value.toFixed(2)}${m.unit ?? ""}`])] as Array<[string, string | null | undefined]>).map(([k, v]) => <tr key={k} className={TR}><td className="w-28 px-2 py-0.5 text-slate-500">{k}</td><td className="px-2 font-mono text-slate-100">{v ?? "—"}</td></tr>)}{prof.loading && !prof.data && <tr><td colSpan={2}><Empty loading /></td></tr>}</tbody></table>
            <SectionHead title="快速下单" />
            <OrderTicket key={cur} initial={cur} strategy="SPDL" compact />
          </> : <NoTrades what="目录为空，可先检索证券加入目录，或直接下单。" strategy="SPDL" />}
        </div>
      </div>
    </Frame>
  );
}

/* ================================================================== RHUB 监管报告中心 */
function HoldingRow({ r, onPct }: { r: Position; onPct: (k: string, v: number | null) => void }) {
  const prof = useProfile(r.symbol);
  const mcap = prof.data?.metrics.find((m) => m.key === "mcap")?.value ?? null;
  const shares = mcap && r.last ? mcap / r.last : null;
  const pct = shares ? (Math.abs(r.qty) / shares) * 100 : null;
  useEffect(() => { onPct(`${r.account}|${r.symbol}`, pct); }, [pct]);
  const th = 5;
  return (
    <tr className={TR}>
      <td className="px-2 py-0.5 text-slate-100">{r.name ?? r.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td><td className="text-slate-400">{mktName(r.market)}</td>
      <td className="text-right font-mono">{r.qty}</td><td className="text-right font-mono text-slate-300">{fmtCompact(shares)}</td>
      <td className="text-right font-mono text-white">{pct == null ? "—" : `${pct < 0.0001 ? pct.toExponential(2) : pct.toFixed(4)}%`}</td>
      <td className="text-right font-mono text-slate-300">{shares ? fmtCompact(Math.max(0, (shares * th) / 100 - Math.abs(r.qty))) : "—"}</td>
      <td className="px-2" style={{ color: pct == null ? "#64748b" : pct >= th ? "#f87171" : pct >= th * 0.8 ? "#fbbf24" : "#34d399" }}>{prof.loading && !prof.data ? "读取中…" : pct == null ? "无股本数据" : pct >= th ? "须披露" : pct >= th * 0.8 ? "接近阈值" : "低于阈值"}</td>
    </tr>
  );
}
export function StpRHUB({ onClose }: P) {
  const f = useFills();
  const o = useOrders();
  const p = usePositions();
  const [tab, setTab] = useState("batch");
  const fills = f.data ?? [];
  const names = useMemo(() => new Map((o.data ?? []).map((x) => [x.id, x.name])), [o.data]);
  const issues = (x: Fill) => { const r: string[] = []; if (sessionOf(x.market, x.ts) === "非交易时段") r.push("非交易时段成交"); if (!names.get(x.orderId)) r.push("缺少证券简称"); if (x.settleDate < x.tradeDate) r.push("交收日异常"); if (Math.abs(x.notional - x.qty * x.px) > Math.max(0.01, x.notional * 1e-6)) r.push("金额不一致"); return r; };
  const batches = useMemo(() => Object.values(fills.reduce<Record<string, { k: string; d: string; m: string; rows: Fill[] }>>((a, x) => { const k = `${x.tradeDate}|${x.market}`; (a[k] ??= { k, d: x.tradeDate, m: x.market, rows: [] }).rows.push(x); return a; }, {})).sort((a, b) => b.d.localeCompare(a.d) || a.m.localeCompare(b.m)), [fills]);
  const td = today();
  const exportBatch = (b: (typeof batches)[number]) => downloadCsv(`交易报告_${b.d}_${b.m}.csv`, [["UTI", "成交号", "委托号", "执行时间", "交易日", "交收日", "场所", "代码", "简称", "方向", "数量", "价格", "币种", "名义金额", "佣金", "税费", "校验"], ...b.rows.map((x) => [uti(x), x.id, x.orderId, new Date(x.ts).toISOString(), x.tradeDate, x.settleDate, venueOf(x.symbol, x.market), x.symbol, names.get(x.orderId) ?? "", x.side === "B" ? "买入" : "卖出", x.qty, x.px, x.ccy, x.notional.toFixed(2), x.fee.toFixed(2), x.tax.toFixed(2), issues(x).join("；") || "通过"])]);
  const pos = (p.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9 && ["CN", "HK", "US"].includes(r.market));
  const [pcts, setPcts] = useState<Record<string, number | null>>({});
  const onPct = useMemo(() => (k: string, v: number | null) => setPcts((s) => (s[k] === v ? s : { ...s, [k]: v })), []);
  const maxPct = Math.max(0, ...Object.values(pcts).filter((v): v is number => v != null));
  const bad = fills.filter((x) => issues(x).length).length;
  return (
    <Frame code="RHUB" title="监管报告中心" onClose={onClose} tabs={[["batch", "报告批次"], ["hold", "大额持仓披露"], ["rule", "校验规则"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["报告批次", String(batches.length), "按 交易日 × 市场 生成"], ["今日批次", String(batches.filter((b) => b.d === td).length)], ["校验异常记录", <span style={{ color: bad ? "#fbbf24" : "#34d399" }}>{bad}</span>], ["最大单一持股比例", `${maxPct.toFixed(4)}%`, "披露阈值 5%"]]} />
      {tab === "batch" && (!fills.length ? <NoTrades loading={f.loading && !f.data} what="暂无成交，因此没有可生成的交易报告批次。成交后系统按交易日与市场自动归集批次，可逐批导出申报文件。" strategy="RHUB" /> :
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">交易日</th><th className="text-left">市场</th><th className="text-right">记录数</th><th className="text-right">成交额（原币）</th><th className="text-right">费用合计</th><th className="text-left pl-2">申报截止</th><th className="text-right">校验异常</th><th className="text-left pl-2">状态</th><th className="px-2 text-right">文件</th></tr></thead>
          <tbody>{batches.map((b) => { const due = dueOf(b.rows[0]); const err = b.rows.filter((x) => issues(x).length).length; return <tr key={b.k} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{b.d}</td><td className="text-slate-300">{mktName(b.m)}</td><td className="text-right font-mono">{b.rows.length}</td><td className="text-right font-mono text-white">{fmtCompact(b.rows.reduce((s, x) => s + x.notional, 0))} <span className="text-[9px] text-slate-500">{b.rows[0].ccy}</span></td><td className="text-right font-mono text-slate-400">{b.rows.reduce((s, x) => s + x.fee + x.tax, 0).toFixed(2)}</td><td className="pl-2 font-mono text-slate-400">{due}</td><td className="text-right font-mono" style={{ color: err ? "#fbbf24" : "#64748b" }}>{err}</td><td className="pl-2" style={{ color: err ? "#fbbf24" : due >= td ? "#38bdf8" : "#34d399" }}>{err ? "待修正" : due >= td ? "可申报" : "已归档"}</td><td className="px-2 text-right"><Btn onClick={() => exportBatch(b)}>导出</Btn></td></tr>; })}</tbody></table>)}
      {tab === "hold" && <>
        <SectionHead title="大额持仓披露检查" sub="A股、港股、美股的权益披露门槛均以 5% 计" />
        {!pos.length ? <NoTrades loading={p.loading && !p.data} what="暂无股票持仓，无需大额持仓披露检查。" strategy="RHUB" /> :
          <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">证券</th><th className="text-left">市场</th><th className="text-right">持仓</th><th className="text-right">估算总股本</th><th className="text-right">持股比例</th><th className="text-right">距 5% 尚可增持</th><th className="px-2 text-left">结论</th></tr></thead>
            <tbody>{pos.map((r) => <HoldingRow key={`${r.account}|${r.symbol}`} r={r} onPct={onPct} />)}</tbody></table>}
      </>}
      {tab === "rule" && <>
        <SectionHead title="报告校验规则执行结果" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">规则</th><th className="text-left">说明</th><th className="px-2 text-right">命中记录</th></tr></thead>
          <tbody>{([["非交易时段成交", "按市场当地时间判断成交时间是否在连续竞价时段内"], ["缺少证券简称", "委托记录中未取得证券简称"], ["交收日异常", "交收日早于交易日"], ["金额不一致", "名义金额与 数量 × 价格 不符"]] as Array<[string, string]>).map(([k, d]) => { const n = fills.filter((x) => issues(x).includes(k)).length; return <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-100">{k}</td><td className="text-slate-400">{d}</td><td className="px-2 text-right font-mono" style={{ color: n ? "#fbbf24" : "#34d399" }}>{n}</td></tr>; })}</tbody></table>
      </>}
    </Frame>
  );
}

/* ================================================================== RHUD 法规资料库 */
type Press = { id: string; ch: string; label: string; title: string; link: string; date: number; desc: string };
export function StpRHUD({ onClose }: P) {
  const [tab, setTab] = useState("lib");
  const pr = usePolled<Press[]>("ucHubs.press", {}, 900_000);
  const [agency, setAgency] = useState("全部");
  const [kw, setKw] = useState("");
  const feed = useFeed(tab === "policy" ? { cats: ["政策", "央行", "金融"], hours: 168, limit: 120 } : null);
  const list = pr.data ?? [];
  const labels = ["全部", ...new Set(list.map((x) => x.label))];
  const ENF = /charge|settle|penalt|fraud|enforcement|order|cease|fine|bar/i;
  const rows = list.filter((x) => (agency === "全部" || x.label === agency) && (!kw || `${x.title} ${x.desc}`.toLowerCase().includes(kw.toLowerCase())) && (tab !== "enf" || x.ch === "fedenf" || (x.ch === "sec" && ENF.test(x.title))));
  const months = useMemo(() => { const m: Record<string, Record<string, number>> = {}; for (const x of list) { if (!x.date) continue; const k = new Date(x.date).toLocaleDateString("sv-SE").slice(0, 7); (m[k] ??= {})[x.label] = (m[k][x.label] ?? 0) + 1; } return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).slice(-6); }, [list]);
  const wk = Date.now() - 7 * 86400e3;
  return (
    <Frame code="RHUD" title="法规资料库" onClose={onClose} tabs={[["lib", "监管新闻稿"], ["enf", "执法与处罚"], ["policy", "政策资讯"], ["stat", "发布统计"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["资料总数", String(list.length)], ["近 7 日发布", String(list.filter((x) => x.date >= wk).length)], ["执法类", String(list.filter((x) => x.ch === "fedenf" || (x.ch === "sec" && ENF.test(x.title))).length)], ["发布机构", String(labels.length - 1)]]} />
      {(tab === "lib" || tab === "enf") && <>
        <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]"><Seg value={agency} options={labels.map((l) => [l, l] as [string, string])} onChange={setAgency} /><input value={kw} onChange={(ev) => setKw(ev.target.value)} placeholder="关键词（英文原文）" className="w-48 border border-[#1d3047] bg-[#07111c] px-1 text-white" /><span className="text-[10px] text-slate-500">{rows.length} 条，点击在终端内阅读</span></div>
        <DocList loading={pr.loading} rows={rows.map((x) => ({ id: x.id, title: x.title, sub: x.label, date: x.date || Date.now(), url: x.link, summary: x.desc, tag: x.label }))} empty="无匹配资料" />
      </>}
      {tab === "policy" && <FeedList items={feed.items} loading={feed.loading} empty="近 7 天暂无政策资讯" />}
      {tab === "stat" && <>
        <SectionHead title="近 6 个月各机构发布数量" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">月份</th>{labels.slice(1).map((l) => <th key={l} className="text-right">{l}</th>)}<th className="px-2 text-right">合计</th></tr></thead>
          <tbody>{months.map(([m, v]) => <tr key={m} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{m}</td>{labels.slice(1).map((l) => <td key={l} className="text-right font-mono text-slate-200">{v[l] ?? "—"}</td>)}<td className="px-2 text-right font-mono text-white">{Object.values(v).reduce((a, b) => a + b, 0)}</td></tr>)}{!months.length && <tr><td><Empty loading={pr.loading} /></td></tr>}</tbody></table>
        <Bars data={months.map(([m, v]) => ({ k: m, v: Object.values(v).reduce((a, b) => a + b, 0) }))} fmt={(v) => `${v} 份`} height={120} />
      </>}
    </Frame>
  );
}

/* ================================================================== RHAB 平台运维（Beta） */
type Plat = { uptimeSec: number; node: string; cpus: number; load: number[]; sysMemTotal: number; sysMemFree: number; rss: number; heapUsed: number; heapTotal: number; streamClients: number; cacheEntries: number; warehouse: { news: number; kline: number; ticks: number; klineSymbols: number } | null; feeds: { total: number; online: number; items: number }; lines: Array<{ line: string; ok: boolean; lastOkSec: number | null; fails: number }>; procs: Array<{ name: string; area: string; n: number; err: number; avg: number; max: number; lastSec: number }>; areas: Array<{ area: string; n: number; avg: number; err: number }>; perMinute: number[]; warm: Array<{ at: number; label: string; symbols: number; ms: number; ticks: number }> };
const mb = (v: number) => `${(v / 1048576).toFixed(0)} MB`;
export function StpRHAB({ onClose }: P) {
  const [tab, setTab] = useState("health");
  const pl = usePolled<Plat>("ucHubs.platform", {}, 10_000);
  const s = useSummary();
  const e = useEvents();
  const d = pl.data;
  const defects = (d?.procs ?? []).filter((x) => x.err > 0).sort((a, b) => b.err / b.n - a.err / a.n);
  const evByKind = (e.data ?? []).reduce<Record<string, number>>((a, x) => { a[x.kind] = (a[x.kind] ?? 0) + 1; return a; }, {});
  return (
    <Frame code="RHAB" title="平台运维管理（Beta）" onClose={onClose} tabs={[["health", "运行健康"], ["defect", "接口异常"], ["sandbox", "模拟交易沙盒"]]} tab={tab} setTab={setTab} right={d ? <span>已运行 {(d.uptimeSec / 3600).toFixed(1)} 小时</span> : null}>
      <Kpis items={[["推送连接", String(d?.streamClients ?? "—")], ["内存占用", d ? mb(d.rss) : "—", d ? `堆 ${mb(d.heapUsed)} / ${mb(d.heapTotal)}` : undefined], ["系统负载", d ? d.load.map((v) => v.toFixed(2)).join(" / ") : "—", d ? `${d.cpus} 核` : undefined], ["资讯源在线", d ? `${d.feeds.online} / ${d.feeds.total}` : "—", d ? `累计 ${fmtCompact(d.feeds.items)} 条` : undefined]]} />
      {!d && <Empty loading={pl.loading} text="运行指标暂不可用" />}
      {d && tab === "health" && <>
        <SectionHead title="近 60 分钟接口调用量（次/分）" />
        <Bars data={d.perMinute.map((v, i) => ({ k: `${i - 59}`, v }))} fmt={(v) => `${v} 次`} height={110} />
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="功能模块" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">模块</th><th className="text-right">调用</th><th className="text-right">平均耗时</th><th className="px-2 text-right">错误</th></tr></thead>
              <tbody>{d.areas.map((a) => <tr key={a.area} className={TR}><td className="px-2 py-0.5 text-slate-100">{a.area}</td><td className="text-right font-mono">{a.n}</td><td className="text-right font-mono text-white">{a.avg.toFixed(0)} 毫秒</td><td className="px-2 text-right font-mono" style={{ color: a.err ? "#f87171" : "#64748b" }}>{a.err}</td></tr>)}</tbody></table>
            <SectionHead title="行情线路" />
            <table className="w-full text-[11px]"><tbody>{d.lines.map((l) => <tr key={l.line} className={TR}><td className="px-2 py-0.5 text-slate-100">{l.line}</td><td style={{ color: l.ok ? "#34d399" : "#f87171" }}>{l.ok ? "正常" : "暂停"}</td><td className="text-right font-mono text-slate-400">{l.lastOkSec == null ? "—" : `${l.lastOkSec} 秒前`}</td><td className="px-2 text-right font-mono text-slate-500">失败 {l.fails}</td></tr>)}</tbody></table></div>
          <div className="bg-[#03070c]"><SectionHead title="数据仓库入库量" />
            <table className="w-full text-[11px]"><tbody>{d.warehouse ? ([["新闻", d.warehouse.news], ["K 线", d.warehouse.kline], ["逐笔报价", d.warehouse.ticks], ["K 线标的数", d.warehouse.klineSymbols], ["缓存条目", d.cacheEntries]] as Array<[string, number]>).map(([k, v]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-300">{k}</td><td className="px-2 text-right font-mono text-white">{fmtCompact(v)}</td></tr>) : <tr><td><Empty text="仓库统计不可用" /></td></tr>}</tbody></table>
            <SectionHead title="预热任务" />
            <table className="w-full text-[11px]"><tbody>{d.warm.map((w) => <tr key={w.at} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-slate-500">{new Date(w.at).toLocaleTimeString("zh-CN", { hour12: false })}</td><td className="text-slate-200">{w.label}</td><td className="text-right font-mono">{w.ticks}/{w.symbols}</td><td className="px-2 text-right font-mono text-slate-400">{w.ms} 毫秒</td></tr>)}</tbody></table></div>
        </div>
      </>}
      {d && tab === "defect" && <>
        <SectionHead title="出现错误的接口" sub="按错误率排序；最近调用时间用于判断是否已恢复" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">接口</th><th className="text-left">模块</th><th className="text-right">调用</th><th className="text-right">错误</th><th className="text-right">错误率</th><th className="text-right">平均 / 最长耗时</th><th className="px-2 text-right">最近调用</th></tr></thead>
          <tbody>{defects.map((x) => <tr key={x.name} className={TR}><td className="px-2 py-0.5 font-mono text-slate-100">{x.name}</td><td className="text-slate-400">{x.area}</td><td className="text-right font-mono">{x.n}</td><td className="text-right font-mono text-red-300">{x.err}</td><td className="text-right font-mono text-white">{((x.err / x.n) * 100).toFixed(1)}%</td><td className="text-right font-mono text-slate-400">{x.avg.toFixed(0)} / {x.max.toFixed(0)} 毫秒</td><td className="px-2 text-right font-mono text-slate-500">{x.lastSec} 秒前</td></tr>)}{!defects.length && <tr><td colSpan={7} className="px-2 py-4 text-emerald-300">自启动以来所有接口均无错误。</td></tr>}</tbody></table>
        <SectionHead title="最慢接口（按平均耗时）" />
        <table className="w-full text-[11px]"><tbody>{[...d.procs].sort((a, b) => b.avg - a.avg).slice(0, 12).map((x) => <tr key={x.name} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{x.name}</td><td className="text-slate-400">{x.area}</td><td className="text-right font-mono">{x.n} 次</td><td className="px-2 text-right font-mono text-white">{x.avg.toFixed(0)} 毫秒</td></tr>)}</tbody></table>
      </>}
      {d && tab === "sandbox" && <>
        <SectionHead title="模拟交易沙盒状态" sub="平台撮合引擎以实时行情撮合；以下为本账户在沙盒中的运行情况" />
        {!s.data ? <Empty loading={s.loading} /> : <Kpis items={[["账户权益", fmtCompact(s.data.equity), `初始 ${fmtCompact(s.data.initial)}`], ["收益率", <span style={{ color: toneOf(s.data.returnPct) }}>{fmtPct(s.data.returnPct)}</span>], ["委托 / 成交", `${s.data.orders} / ${s.data.fills}`, `今日成交 ${s.data.todayFills}`], ["待交收", String(s.data.pendingSettlement), `累计费用 ${fmtCompact(s.data.feesPaid)}`]]} />}
        <SectionHead title="撮合引擎事件统计" />
        <table className="w-full text-[11px]"><tbody>{Object.entries(evByKind).map(([k, v]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-200">{KIND_ZH[k] ?? k}</td><td className="px-2 text-right font-mono text-white">{v}</td></tr>)}{!Object.keys(evByKind).length && <tr><td><NoTrades loading={e.loading && !e.data} what="沙盒中尚无事件，可在此提交一笔委托验证撮合流程。" strategy="RHAB" /></td></tr>}</tbody></table>
        {s.data && Object.keys(s.data.byStatus).length > 0 && <><SectionHead title="委托状态分布" /><table className="w-full text-[11px]"><tbody>{Object.entries(s.data.byStatus).map(([k, v]) => <tr key={k} className={TR}><td className="px-2 py-0.5" style={{ color: STATUS_COLOR[k] }}>{STATUS_ZH[k] ?? k}</td><td className="px-2 text-right font-mono text-white">{v}</td></tr>)}</tbody></table></>}
      </>}
    </Frame>
  );
}
