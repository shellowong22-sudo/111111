import { useState } from "react";
import { BellRing, CircleAlert, Plus, RefreshCw, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const ALERT_RULE_TYPE_VALUES = ["price_above", "price_below", "var_above", "var_below", "return_above", "return_below", "volatility_above", "volatility_below"] as const;
type AlertRuleType = typeof ALERT_RULE_TYPE_VALUES[number];
const ALERT_RULES: Record<AlertRuleType, { label: string; unit: string; description: string }> = {
  price_above: { label: "价格上穿", unit: "价格", description: "最新观察值达到或高于阈值时触发。" },
  price_below: { label: "价格下穿", unit: "价格", description: "最新观察值达到或低于阈值时触发。" },
  var_above: { label: "风险值上穿", unit: "", description: "账户已导入风险值达到或高于阈值时触发。" },
  var_below: { label: "风险值下穿", unit: "", description: "账户已导入风险值达到或低于阈值时触发。" },
  return_above: { label: "收益率上穿", unit: "%", description: "账户已导入收益率达到或高于阈值时触发。" },
  return_below: { label: "收益率下穿", unit: "%", description: "账户已导入收益率达到或低于阈值时触发。" },
  volatility_above: { label: "波动率上穿", unit: "%", description: "账户已导入波动率达到或高于阈值时触发。" },
  volatility_below: { label: "波动率下穿", unit: "%", description: "账户已导入波动率达到或低于阈值时触发。" },
};

export default function AlertMonitorPanel() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [symbol, setSymbol] = useState("");
  const [ruleType, setRuleType] = useState<AlertRuleType>("price_above");
  const [threshold, setThreshold] = useState("");
  const rules = trpc.alert.listRules.useQuery({}, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const create = trpc.alert.createRule.useMutation({ onSuccess: () => { setSymbol(""); setThreshold(""); utils.alert.listRules.invalidate({}); } });
  const remove = trpc.alert.deleteRule.useMutation({ onSuccess: () => utils.alert.listRules.invalidate({}) });
  const active = rules.data?.filter(rule => rule.isActive).length ?? 0;
  const createRule = () => {
    if (!symbol.trim() || !Number.isFinite(Number(threshold))) return;
    create.mutate({ symbol: symbol.trim().toUpperCase(), ruleType, threshold });
  };
  if (loading) return null;
  if (!isAuthenticated) return <section className="m-4 rounded border border-green-950 bg-slate-950/70 p-4 text-slate-100"><p className="text-xs text-slate-500">登录后可读取、创建和管理当前账户的预警规则。未登录时不会显示任何账户规则或示例预警。</p></section>;
  return <section className="m-4 rounded border border-green-950 bg-slate-950/70 p-4 text-slate-100" data-alert-monitor-panel><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-green-300"><BellRing className="h-4 w-4" />账户预警监控</p><h2 className="mt-1 text-lg font-semibold">已保存的预警规则</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">规则只写入当前账户。创建后由已授权的数据刷新流程按规则类型判断；这里不生成模拟触发记录或虚构价格。</p></div><button type="button" onClick={() => rules.refetch()} disabled={rules.isFetching} className="inline-flex items-center gap-1 rounded border border-green-800 px-2.5 py-1.5 text-xs text-green-200 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${rules.isFetching ? "animate-spin" : ""}`} />刷新</button></div>
    <div className="mt-4 rounded border border-green-900/50 bg-green-950/10 p-3"><div className="flex items-center gap-2"><Plus className="h-3.5 w-3.5 text-green-300" /><p className="text-xs font-semibold text-green-100">创建预警规则</p></div><div className="mt-2 grid gap-2 md:grid-cols-[1fr_1.3fr_1fr_auto]"><input value={symbol} onChange={event => setSymbol(event.target.value)} maxLength={20} placeholder="品种代码，例如 AAPL" className="input-terminal text-xs" /><select value={ruleType} onChange={event => setRuleType(event.target.value as AlertRuleType)} className="input-terminal text-xs">{ALERT_RULE_TYPE_VALUES.map(value => <option key={value} value={value}>{ALERT_RULES[value].label}（{ALERT_RULES[value].unit || "数值"}）</option>)}</select><input value={threshold} onChange={event => setThreshold(event.target.value)} inputMode="decimal" placeholder="阈值" className="input-terminal text-xs" /><button type="button" onClick={createRule} disabled={create.isPending || !symbol.trim() || !Number.isFinite(Number(threshold))} className="rounded border border-green-700 px-2 py-1 text-xs text-green-100 disabled:text-slate-600">{create.isPending ? "保存中…" : "保存规则"}</button></div><p className="mt-2 text-[10px] text-green-700">{ALERT_RULES[ruleType].description}</p>{create.error && <p role="alert" className="mt-2 text-xs text-rose-300">保存失败：{create.error.message}</p>}</div>
    {rules.isLoading ? <p className="py-10 text-center text-sm text-green-700">正在读取账户预警规则…</p> : rules.error ? <div role="alert" className="mt-4 rounded border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200"><CircleAlert className="mr-1 inline h-3.5 w-3.5" />预警规则暂不可用：{rules.error.message}</div> : <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded border border-green-900/40 bg-black/40 p-3"><p className="text-[10px] text-green-700">规则总数</p><p className="mt-1 text-xl font-semibold text-green-200">{rules.data?.length ?? 0}</p></div><div className="rounded border border-green-900/40 bg-black/40 p-3"><p className="text-[10px] text-green-700">启用规则</p><p className="mt-1 text-xl font-semibold text-emerald-300">{active}</p></div><div className="rounded border border-green-900/40 bg-black/40 p-3"><p className="text-[10px] text-green-700">最近规则更新</p><p className="mt-1 text-sm font-medium text-green-200">{rules.data?.[0]?.updatedAt ? new Date(rules.data[0].updatedAt).toLocaleString() : "—"}</p></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b border-green-900/40 text-green-700"><th className="px-2 py-2">品种</th><th className="px-2 py-2">规则</th><th className="px-2 py-2 text-right">阈值</th><th className="px-2 py-2">状态</th><th className="px-2 py-2">最后触发</th><th className="px-2 py-2 text-right">管理</th></tr></thead><tbody>{rules.data?.map(rule => { const savedRuleType = rule.ruleType as AlertRuleType; const meta = ALERT_RULES[savedRuleType] ?? { label: rule.ruleType, unit: "", description: "账户已保存的自定义规则。" }; return <tr key={rule.id} className="border-b border-green-950/60 hover:bg-green-950/20"><td className="px-2 py-2 font-mono text-green-300">{rule.symbol || "组合"}</td><td className="px-2 py-2 text-green-200"><span>{meta.label}</span><span className="mt-0.5 block text-[9px] text-green-700">{meta.description}</span></td><td className="px-2 py-2 text-right font-mono text-green-200">{rule.threshold}{meta.unit ? ` ${meta.unit}` : ""}</td><td className="px-2 py-2"><span className={rule.isActive ? "text-emerald-300" : "text-slate-500"}>{rule.isActive ? "启用" : "关闭"}</span></td><td className="px-2 py-2 text-green-700">{rule.lastTriggeredAt ? new Date(Number(rule.lastTriggeredAt)).toLocaleString() : "未触发"}</td><td className="px-2 py-2 text-right"><button type="button" onClick={() => remove.mutate({ ruleId: rule.id })} disabled={remove.isPending} className="inline-flex items-center gap-1 rounded border border-rose-900 px-2 py-1 text-[10px] text-rose-200 disabled:text-slate-600"><Trash2 className="h-3 w-3" />删除</button></td></tr>; })}{!rules.data?.length && <tr><td colSpan={6} className="px-2 py-10 text-center text-green-700">当前账户尚无预警规则。可使用上方表单创建一条真实账户规则。</td></tr>}</tbody></table></div></>}</section>;
}
