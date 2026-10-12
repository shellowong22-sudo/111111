import React, { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { trpc } from '@/lib/trpc';
type SourceKind = 'sec_press' | 'fed_monetary' | 'fed_research';
const SOURCES: Record<SourceKind,string> = {sec_press:'SEC 官方公告',fed_monetary:'美联储货币政策',fed_research:'美联储研究'};
export default function NLRTPanel({ onClose }: { onClose?: () => void }) {
  const [tab,setTab] = useState('rules');
  const [source,setSource] = useState<SourceKind>('sec_press');
  const [hours,setHours] = useState(72);
  const [active,setActive] = useState(true);
  const [eventSource,setEventSource] = useState<'all'|SourceKind>('all');
  const [message,setMessage] = useState('');
  const rules = trpc.newsResearch.listSourceFreshnessRules.useQuery(undefined,{retry:false});
  const events = trpc.newsResearch.listSourceFreshnessEvents.useQuery({sourceKind:eventSource,state:'all',limit:160},{retry:false,refetchInterval:60_000});
  const save = trpc.newsResearch.saveSourceFreshnessRule.useMutation({onSuccess:async () => {await rules.refetch();setMessage('规则已保存到当前账户。触发由服务端官方来源时效任务判断。');}});
  const daily = useMemo(() => {
    const map = new Map<string,number>();
    for (const event of events.data ?? []) { const date = new Date(event.createdAt); if (!Number.isNaN(date.getTime())) {const day=date.toISOString().slice(0,10);map.set(day,(map.get(day)??0)+1);} }
    return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([day,count])=>({day,count}));
  },[events.data]);
  return <div className="flex h-full min-h-[550px] flex-col bg-[#080a0e] font-mono text-xs text-slate-200" data-news-nlrt-live="true">
    <header className="flex items-center gap-3 border-b border-slate-700 p-2"><strong className="text-orange-300">NLRT</strong><span>新闻提醒 · 预警规则 · 触发历史 · 市场反应</span>{onClose && <button onClick={onClose} className="ml-auto" aria-label="关闭新闻提醒">✕</button>}</header>
    <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
      <TabsList className="h-8 justify-start rounded-none bg-slate-950">{[{id:'rules',label:'预警规则'},{id:'history',label:'触发历史'},{id:'daily',label:'每日统计'},{id:'reaction',label:'市场反应'}].map(t=><TabsTrigger key={t.id} value={t.id} className="rounded-none text-xs">{t.label}</TabsTrigger>)}</TabsList>
      <p className="border-y border-slate-800 p-2 text-slate-500">当前可执行规则为官方来源时效阈值；仅显示当前登录账户持久记录。新闻影响阈值、证券价格阈值尚未接入可验证行情与事件评估，不能冒充已启用。</p>
      {(rules.error || events.error) && <p role="alert" className="p-2 text-red-300">账户数据读取失败：{rules.error?.message || events.error?.message}</p>}
      <TabsContent value="rules" className="m-0 p-2">
        <p>预警规则管理（{rules.data?.filter(r=>r.isActive).length ?? '—'}条激活）</p>
        <form className="my-3 flex flex-wrap items-center gap-3 border-y border-slate-800 py-3" onSubmit={e=>{e.preventDefault();setMessage('');save.mutate({sourceKind:source,thresholdHours:hours,isActive:active});}}>
          <label>来源 <select aria-label="提醒来源" value={source} onChange={e=>setSource(e.target.value as SourceKind)} className="border border-slate-700 bg-slate-950 p-1">{Object.entries(SOURCES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
          <label>阈值（小时） <input aria-label="时效阈值小时" type="number" min={6} max={8760} required value={hours} onChange={e=>setHours(Number(e.target.value))} className="w-24 border border-slate-700 bg-slate-950 p-1" /></label>
          <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} /> 激活</label>
          <button type="submit" disabled={save.isPending || rules.isError || !Number.isInteger(hours) || hours<6 || hours>8760} className="border border-orange-800 px-3 py-1 disabled:opacity-40">{save.isPending?'保存中':'保存规则'}</button>
        </form>
        {save.error && <p role="alert" className="text-red-300">保存失败：{save.error.message}</p>}{message && <p role="status" className="my-2 text-green-300">{message}</p>}
        <table className="w-full text-left"><thead><tr><th>来源</th><th>触发条件</th><th>状态</th><th>操作</th></tr></thead><tbody>{rules.data?.map(rule=><tr key={rule.id} className="border-t border-slate-800"><td className="py-3">{SOURCES[rule.sourceKind as SourceKind]}</td><td>最新发布超过 {rule.thresholdHours} 小时，或来源不可读</td><td>{rule.isActive?'激活':'暂停'}</td><td><button onClick={()=>{setSource(rule.sourceKind as SourceKind);setHours(rule.thresholdHours);setActive(rule.isActive);setMessage('');}} className="text-cyan-200 underline">编辑</button></td></tr>)}</tbody></table>
        {!rules.isLoading && !rules.error && !rules.data?.length && <p className="py-3">当前账户尚未保存提醒规则。</p>}
      </TabsContent>
      <TabsContent value="history" className="m-0 p-2">
        <div className="my-2 flex gap-3"><select aria-label="提醒历史来源" value={eventSource} onChange={e=>setEventSource(e.target.value as 'all'|SourceKind)} className="border border-slate-700 bg-slate-950 p-1"><option value="all">全部来源</option>{Object.entries(SOURCES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button onClick={()=>void events.refetch()} disabled={events.isFetching} className="border border-slate-700 px-2">刷新历史</button></div>
        <table className="w-full text-left"><thead><tr><th>触发时间</th><th>来源</th><th>状态</th><th>距最新发布</th><th>通知ID</th></tr></thead><tbody>{events.data?.map(event=><tr key={event.id} className="border-t border-slate-800"><td className="py-3">{new Date(event.createdAt).toLocaleString('zh-CN',{hour12:false})}</td><td>{SOURCES[event.sourceKind as SourceKind]}</td><td>{event.state==='stale'?'超过时效阈值':'来源不可读取'}</td><td>{event.ageHours===null?'未提供':event.ageHours+' 小时'}</td><td>{event.notificationId ?? '未生成'}</td></tr>)}</tbody></table>
        {!events.isLoading && !events.error && !events.data?.length && <p className="py-3">当前筛选没有真实触发记录。</p>}
      </TabsContent>
      <TabsContent value="daily" className="m-0 p-3"><p>每日提醒触发量 · 按当前筛选最近最多 160 条实际事件的 UTC 日期聚合</p>{daily.length?<ResponsiveContainer width="100%" height={280}><BarChart data={daily}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="真实触发事件" fill="#fb923c" /></BarChart></ResponsiveContainer>:<p className="py-3">没有可绘制的触发事件，不生成零值或随机历史。</p>}</TabsContent>
      <TabsContent value="reaction" className="m-0 p-3"><p>提醒触发后市场反应分布（触发后1小时内）</p><p role="status" className="mt-3 text-amber-200">当前事件为来源时效通知，没有交易标的和事件前后价格快照。市场反应、影响等级与涨跌幅未提供，不能由通知次数推导。</p></TabsContent>
    </Tabs>
  </div>;
}
