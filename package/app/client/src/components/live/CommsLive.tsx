/**
 * 沟通与协作（全部接平台真实数据，不再展示示例人员 / 消息）：
 *  - 即时消息 / 邮件 / 社区（IB、MSG、CMTY 等）统一为平台研究讨论串（CommsResearchLayer，账号间真实收发）
 *  - PEOP / BIO 平台成员目录（姓名、角色），可直接发起讨论
 *  - NOTE 个人笔记：永久保存在平台数据库，可关联标的并显示实时行情
 *  - FILE 我的资料库：汇总各功能保存在平台的个人数据（组合快照、互换簿、监控列表、限额等），可导出
 *  - MGU / MRUL / VACN / SMGM 提醒与规则：讨论串到期提醒规则（启停）与提醒记录
 */
import { useEffect, useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, ucGet, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Empty, Kpis, PanelShell, SectionHead, ownerId, saveItem, useSaved } from "@/uc/panels/kit";
import { ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";

const INP = "border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white outline-none";
const BTN = "border border-[#2a3c52] px-2 py-0.5 text-[11px] text-slate-200 hover:bg-[#0a1726] disabled:opacity-40";
async function post<T>(path: string, input: unknown): Promise<T> {
  const r = await fetch(`/api/trpc/${path}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
  const j = await r.json();
  if (j?.error) throw new Error(j.error?.json?.message ?? "请求失败");
  return j?.result?.data?.json as T;
}
/** 需要登录的查询：未登录时返回 auth=false */
function useAuthed<T>(path: string, input: Record<string, unknown>, ms: number, bump = 0) {
  const [st, setSt] = useState<{ data: T | null; loading: boolean; auth: boolean }>({ data: null, loading: true, auth: true });
  const key = JSON.stringify(input) + bump;
  useEffect(() => {
    let alive = true;
    const load = () => ucGet<T>(path, input).then((d) => alive && setSt({ data: d, loading: false, auth: true })).catch((e: Error) => alive && setSt({ data: null, loading: false, auth: !/UNAUTHORIZED|login|登录|10001/i.test(e.message) }));
    void load();
    const t = setInterval(load, ms);
    return () => { alive = false; clearInterval(t); };
  }, [path, key, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
const NeedLogin = () => <Empty text="登录平台账号后可用：成员、讨论与提醒都按账号保存。" />;

/* ================================================================== PEOP 成员目录 */
type Member = { id: number; name: string | null; role: string | null };
export function PeopLive({ onClose }: P) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const m = useAuthed<Member[]>("commsResearch.memberDirectory", { query, limit: 30 }, 120_000);
  const [msg, setMsg] = useState("");
  const startThread = async (u: Member) => {
    setMsg("创建中…");
    try {
      const r = await post<{ id: number }>("commsResearch.createThread", { title: `与 ${u.name ?? `成员 ${u.id}`} 的讨论`, purpose: "question", moduleCode: "PEOP", classification: "internal", initialBody: "由成员目录发起的讨论。", memberIds: [u.id] });
      setMsg(`已创建讨论串 #${r?.id ?? ""}，可在即时消息（IB）中继续`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "创建失败"); }
  };
  const rows = m.data ?? [];
  return (
    <PanelShell code="PEOP" title="平台成员目录" onClose={onClose}>
      <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px]">
        <input className={`${INP} w-56`} value={q} placeholder="按姓名或编号搜索" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setQuery(q.trim()); }} />
        <button type="button" className={BTN} onClick={() => setQuery(q.trim())}>搜索</button>
        {msg && <span className="text-amber-200">{msg}</span>}
      </div>
      {!m.auth ? <NeedLogin /> : <>
        <Kpis items={[["匹配成员", String(rows.length)], ["管理员", String(rows.filter((r) => r.role === "admin").length)], ["排序", "最近登录在前"]]} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>成员</th><th className={THL}>编号</th><th className={THL}>角色</th><th className={TH} /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className={ROW}><td className={TDL}>{r.name ?? "未命名成员"}</td><td className="px-2 font-mono text-slate-500">{r.id}</td><td className="px-2 text-slate-400">{r.role === "admin" ? "管理员" : "成员"}</td><td className="px-2 text-right"><button type="button" className={BTN} onClick={() => void startThread(r)}>发起讨论</button></td></tr>)}
            {!rows.length && <tr><td colSpan={4}><Empty loading={m.loading} text="没有匹配的成员" /></td></tr>}</tbody>
        </table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== NOTE 个人笔记 */
type Note = { id: string; title: string; content: string; cat: string; symbols: string[]; ts: number; star?: boolean };
const CATS = ["研究", "宏观", "交易", "策略", "其他"];
export function NoteLive({ onClose }: P) {
  const saved = useSaved<Note[]>("notes");
  const [local, setLocal] = useState<Note[] | null>(null);
  const notes = local ?? saved.data ?? [];
  const [cat, setCat] = useState("全部");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Note | null>(null);
  const [msg, setMsg] = useState("");
  const syms = useMemo(() => [...new Set(notes.flatMap((n) => n.symbols))].slice(0, 60), [notes]);
  const t = useTicks(syms);
  const persist = async (next: Note[]) => { setLocal(next); try { await saveItem("notes", next); setMsg("已保存"); } catch { setMsg("保存失败"); } };
  const list = notes.filter((n) => (cat === "全部" || n.cat === cat) && (!q || `${n.title}${n.content}${n.symbols.join(" ")}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => Number(!!b.star) - Number(!!a.star) || b.ts - a.ts);
  const blank = (): Note => ({ id: String(Date.now()), title: "", content: "", cat: "研究", symbols: [], ts: Date.now() });
  return (
    <PanelShell code="NOTE" title="个人笔记" onClose={onClose} right={<span>{notes.length} 条 · 永久保存</span>}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px]">
        <Seg value={cat} options={[["全部", "全部"], ...CATS.map((c) => [c, c] as [string, string])]} onChange={setCat} />
        <input className={`${INP} w-48`} value={q} placeholder="搜索标题、内容、标的" onChange={(e) => setQ(e.target.value)} />
        <button type="button" className={BTN} onClick={() => setEdit(blank())}>新建笔记</button>
        {msg && <span className="text-amber-200">{msg}</span>}
      </div>
      {edit && (
        <div className="space-y-1 border-b border-[#1a2a3c] bg-[#06101b] p-2 text-[11px]">
          <div className="flex flex-wrap gap-2"><input className={`${INP} w-72`} placeholder="标题" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /><select className={INP} value={edit.cat} onChange={(e) => setEdit({ ...edit, cat: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select><input className={`${INP} w-64 font-mono`} placeholder="关联标的，逗号分隔，如 AAPL, sh600519" value={edit.symbols.join(", ")} onChange={(e) => setEdit({ ...edit, symbols: e.target.value.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean).slice(0, 10) })} /></div>
          <textarea className={`${INP} h-32 w-full`} placeholder="内容" value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} />
          <div className="flex gap-2"><button type="button" className={BTN} disabled={!edit.title.trim()} onClick={() => { const n = { ...edit, title: edit.title.trim().slice(0, 120), content: edit.content.slice(0, 20000), ts: Date.now() }; void persist([n, ...notes.filter((x) => x.id !== n.id)].slice(0, 300)); setEdit(null); }}>保存</button><button type="button" className={BTN} onClick={() => setEdit(null)}>取消</button></div>
        </div>
      )}
      {!list.length ? <Empty loading={saved.loading && !local} text="还没有笔记：点“新建笔记”记录观点，关联标的后会显示实时行情。" /> : (
        <div>{list.map((n) => (
          <div key={n.id} className="border-b border-[#0f1b29] px-2 py-1.5 hover:bg-[#0a1726]">
            <div className="flex items-center gap-2 text-[11px]"><button type="button" onClick={() => void persist(notes.map((x) => (x.id === n.id ? { ...x, star: !x.star } : x)))} className={n.star ? "text-amber-300" : "text-slate-600"}>★</button><span className="font-semibold text-slate-100">{n.title}</span><span className="text-[10px] text-cyan-300">{n.cat}</span><span className="text-[10px] text-slate-500">{new Date(n.ts).toLocaleString("zh-CN", { hour12: false })}</span><span className="ml-auto flex gap-2"><button type="button" className="text-sky-300 hover:underline" onClick={() => setEdit(n)}>编辑</button><button type="button" className="text-slate-500 hover:text-slate-200" onClick={() => void persist(notes.filter((x) => x.id !== n.id))}>删除</button></span></div>
            {n.symbols.length > 0 && <div className="mt-0.5 flex flex-wrap gap-2 font-mono text-[10px]">{n.symbols.map((s) => <span key={s} className="text-slate-400">{t[s]?.name ?? s} <span className="text-white">{fmtPrice(t[s]?.price)}</span> <span style={{ color: toneOf(t[s]?.changePct) }}>{fmtPct(t[s]?.changePct)}</span></span>)}</div>}
            <div className="mt-0.5 whitespace-pre-wrap text-[11px] text-slate-300">{n.content}</div>
          </div>))}</div>
      )}
    </PanelShell>
  );
}

/* ================================================================== FILE 我的资料库 */
const LIB: Array<[string, string]> = [["notes", "个人笔记"], ["port-reports", "组合报告快照"], ["swpm-book", "互换簿"], ["dlib-book", "衍生品库"], ["cran-book", "固收工作表"], ["watl-list", "交易监控列表"], ["trade-limits", "交易限额"], ["ledger-aim", "目标权重"], ["cixx-baskets", "自定义篮子指数"], ["maps", "自设地图"], ["mars", "多资产风险组合"], ["marsfx-positions", "外汇风险头寸"], ["myq-fx", "外汇监控"], ["fx-bridge-watch", "外汇关注"], ["cdsw", "CDS 曲线"], ["ecwb-series", "经济工作台序列"], ["liqwatch", "流动性监控"], ["rv-groups", "相对估值分组"], ["srskreg", "主权风险关注"], ["workspace", "工作区布局"]];
function LibRow({ k, label, onPick, picked }: { k: string; label: string; onPick: (k: string, d: unknown) => void; picked: boolean }) {
  const s = usePolled<unknown>("ucHubs.saved", { owner: ownerId(), key: k }, 600_000);
  const d = s.data;
  const n = Array.isArray(d) ? d.length : d && typeof d === "object" ? Object.keys(d as object).length : 0;
  const size = d ? JSON.stringify(d).length : 0;
  if (!s.loading && !d) return null;
  return (
    <tr onClick={() => d && onPick(k, d)} className={`cursor-pointer ${ROW} ${picked ? "bg-[#0a1726]" : ""}`}>
      <td className={TDL}>{label}</td><td className="px-2 font-mono text-[10px] text-slate-500">{k}</td>
      <td className={TD}>{s.loading ? "…" : n}</td><td className={TD}>{s.loading ? "" : size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`}</td>
    </tr>
  );
}
export function FileLive({ onClose }: P) {
  const [pick, setPick] = useState<{ k: string; d: unknown } | null>(null);
  const download = (k: string, d: unknown) => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${k}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const preview = pick ? JSON.stringify(pick.d, null, 2) : "";
  return (
    <PanelShell code="FILE" title="我的资料库" onClose={onClose} right={<span>各功能保存在平台数据库的个人数据</span>}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[1fr_1.2fr]">
        <div className="bg-[#03070c]"><SectionHead title="已保存的资料" sub="点击查看内容；只列出有内容的项目" />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>名称</th><th className={THL}>标识</th><th className={TH}>条目</th><th className={TH}>大小</th></tr></thead>
            <tbody>{LIB.map(([k, l]) => <LibRow key={k} k={k} label={l} picked={pick?.k === k} onPick={(kk, d) => setPick({ k: kk, d })} />)}</tbody></table></div>
        <div className="bg-[#03070c]"><SectionHead title={pick ? `内容：${LIB.find(([k]) => k === pick.k)?.[1] ?? pick.k}` : "内容"} right={pick ? <button type="button" className={BTN} onClick={() => download(pick.k, pick.d)}>导出 JSON</button> : undefined} />
          {pick ? <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap px-2 py-1 font-mono text-[10px] text-slate-300">{preview.length > 60000 ? `${preview.slice(0, 60000)}\n…（已截断，完整内容请导出）` : preview}</pre> : <Empty text="选择左侧一项查看" />}</div>
      </div>
    </PanelShell>
  );
}

/* ================================================================== 提醒与规则 */
type Rule = { id: number; threadId: number; leadHours: number; isActive: boolean; updatedAt: string; title: string; moduleCode: string };
type Ev = { id: number; threadId: number; dueAt: string | null; leadHours: number; createdAt: string };
export function CommsRulesLive({ onClose, code = "MRUL" }: P & { code?: string }) {
  const [bump, setBump] = useState(0);
  const [state, setState] = useState<"all" | "active" | "paused">("all");
  const rules = useAuthed<Rule[]>("commsResearch.listReminderRules", { state, query: "" }, 120_000, bump);
  const ev = useAuthed<Ev[]>("commsResearch.listReminderEvents", { limit: 60 }, 120_000, bump);
  const [sel, setSel] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const setActive = async (isActive: boolean) => { if (!sel.length) return; try { const r = await post<{ updated: number }>("commsResearch.batchSetReminderRules", { ruleIds: sel, isActive }); setMsg(`已${isActive ? "启用" : "暂停"} ${r?.updated ?? sel.length} 条`); setSel([]); setBump((b) => b + 1); } catch (e) { setMsg(e instanceof Error ? e.message : "操作失败"); } };
  const rs = rules.data ?? [];
  return (
    <PanelShell code={code} title="提醒规则与提醒记录" onClose={onClose} right={<Seg value={state} options={[["all", "全部"], ["active", "启用中"], ["paused", "已暂停"]]} onChange={setState} />}>
      {!rules.auth ? <NeedLogin /> : <>
        <Kpis items={[["提醒规则", String(rs.length)], ["启用中", String(rs.filter((r) => r.isActive).length)], ["近期提醒", String(ev.data?.length ?? 0)], ["已选", String(sel.length)]]} />
        <div className="flex items-center gap-2 px-2 py-1 text-[11px]"><button type="button" className={BTN} disabled={!sel.length} onClick={() => void setActive(true)}>启用所选</button><button type="button" className={BTN} disabled={!sel.length} onClick={() => void setActive(false)}>暂停所选</button>{msg && <span className="text-amber-200">{msg}</span>}<span className="ml-auto text-[10px] text-slate-500">在讨论串中设置到期日后可添加提前 24 / 48 / 72 小时提醒</span></div>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL} /><th className={THL}>讨论串</th><th className={THL}>功能</th><th className={TH}>提前（小时）</th><th className={THL}>状态</th><th className={TH}>更新时间</th></tr></thead>
          <tbody>{rs.map((r) => <tr key={r.id} className={ROW}><td className="px-2"><input type="checkbox" checked={sel.includes(r.id)} onChange={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} /></td><td className={TDL}>{r.title}</td><td className="px-2 font-mono text-[10px] text-slate-400">{r.moduleCode}</td><td className={TD}>{r.leadHours}</td><td className="px-2" style={{ color: r.isActive ? "#34d399" : "#94a3b8" }}>{r.isActive ? "启用" : "暂停"}</td><td className={TD}>{new Date(r.updatedAt).toLocaleString("zh-CN", { hour12: false })}</td></tr>)}
            {!rs.length && <tr><td colSpan={6}><Empty loading={rules.loading} text="暂无提醒规则" /></td></tr>}</tbody>
        </table>
        <SectionHead title="提醒记录" />
        <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>讨论串</th><th className={TH}>到期</th><th className={TH}>提前（小时）</th><th className={TH}>触发时间</th></tr></thead>
          <tbody>{(ev.data ?? []).map((e) => <tr key={e.id} className={ROW}><td className={TDL}>#{e.threadId}</td><td className={TD}>{e.dueAt ? new Date(e.dueAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</td><td className={TD}>{e.leadHours}</td><td className={TD}>{new Date(e.createdAt).toLocaleString("zh-CN", { hour12: false })}</td></tr>)}
            {!(ev.data ?? []).length && <tr><td colSpan={4}><Empty loading={ev.loading} text="暂无提醒记录" /></td></tr>}</tbody></table>
      </>}
    </PanelShell>
  );
}
