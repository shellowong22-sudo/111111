import React, { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { trpc } from '@/lib/trpc';
export default function NSUBPanel({ onClose }: { onClose?: () => void }) {
  const [tab,setTab] = useState('subs');
  const evidence = trpc.newsResearch.listEvidence.useQuery({status:'all',query:''},{retry:false,refetchInterval:60_000});
  const grouped = useMemo(() => {
    const counts = new Map<string,number>();
    for (const row of evidence.data ?? []) counts.set(row.sourceKind,(counts.get(row.sourceKind)??0)+1);
    return [...counts].map(([name,value])=>({name,value}));
  },[evidence.data]);
  return <div className="flex h-full min-h-[500px] flex-col bg-[#07090d] font-mono text-xs text-slate-200" data-news-nsub-live="true">
    <header className="flex items-center gap-3 border-b border-slate-700 p-2"><strong className="text-teal-300">NSUB</strong><span>新闻订阅 · 订阅源管理 · 阅读统计 · 内容分析</span>{onClose&&<button onClick={onClose} className="ml-auto" aria-label="关闭新闻订阅">✕</button>}</header>
    <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col"><TabsList className="h-8 justify-start rounded-none bg-slate-950">{[{id:'subs',label:'订阅源'},{id:'reading',label:'阅读统计'},{id:'category',label:'分类分布'},{id:'topics',label:'热门话题'}].map(t=><TabsTrigger key={t.id} value={t.id} className="rounded-none text-xs">{t.label}</TabsTrigger>)}</TabsList>
      <div className="flex gap-3 border-y border-slate-800 p-2"><button onClick={()=>void evidence.refetch()} disabled={evidence.isFetching} className="border border-slate-700 px-2 py-1">{evidence.isFetching?'读取中':'刷新账户记录'}</button><span>当前账户真实研究记录 {evidence.data?.length ?? '—'}</span></div>
      {evidence.error&&<p role="alert" className="p-2 text-red-300">{evidence.error.message}</p>}
      <TabsContent value="subs" className="m-0 p-3"><p>订阅源列表</p><table className="mt-3 w-full text-left"><thead><tr><th>订阅源</th><th>权益</th><th>状态</th></tr></thead><tbody><tr className="border-t border-slate-800"><td colSpan={3} className="py-3">尚未接入当前账户的付费新闻订阅权益。公开 RSS 的可读状态不代表您订阅了 Ucheer、Reuters 或 FT，不生成订阅源和每日文章量。</td></tr></tbody></table></TabsContent>
      <TabsContent value="reading" className="m-0 p-3"><p>近14日阅读行为统计（已读/收藏/分享）</p><p className="py-3 text-amber-200">当前没有文章打开、已读和分享事件接口，不能将抓取数或研究记录数当作阅读行为。现有研究记录的工作状态如下：</p><table className="w-full text-left"><thead><tr><th>研究状态</th><th>实际记录数</th></tr></thead><tbody>{[{id:'captured',label:'已归档'},{id:'reading',label:'研究中'},{id:'verified',label:'已核验'},{id:'closed',label:'已关闭'}].map(status=><tr key={status.id} className="border-t border-slate-800"><td className="py-2">{status.label}</td><td>{evidence.data?evidence.data.filter(row=>row.status===status.id).length:'未读取'}</td></tr>)}</tbody></table></TabsContent>
      <TabsContent value="category" className="m-0 p-3"><p>订阅内容分类分布 · 当前展示账户已归档研究记录的来源分类，不代表订阅占比</p>{grouped.length?<ResponsiveContainer width="100%" height={270}><BarChart data={grouped}><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" name="实际归档条目" fill="#2dd4bf"/></BarChart></ResponsiveContainer>:<p className="py-3">没有可验证归档记录，不绘制预设分类分布。</p>}</TabsContent>
      <TabsContent value="topics" className="m-0 p-3"><p>近30日最常阅读话题（阅读量 & 收藏量）</p><p className="mt-3 text-amber-200">缺少带文章标识、主题与时间的真实阅读/收藏事件；无法计算个人热门话题，当前不显示固定排行榜。</p></TabsContent>
    </Tabs>
  </div>;
}
