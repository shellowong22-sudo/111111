import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SourceReturnDesk from './SourceReturnDesk';
export default function READPanel({ onClose }: { onClose?: () => void }) {
  const [tab,setTab] = useState('articles');
  return <div className="flex h-full min-h-[500px] flex-col bg-[#080a0e] font-mono text-xs text-slate-200" data-news-read-source-audit="true">
    <header className="flex items-center gap-3 border-b border-slate-700 p-2"><strong className="text-orange-300">READ</strong><span>最热门报道 · 阅读趋势 · 用户行为 · 热度预测</span>{onClose&&<button onClick={onClose} className="ml-auto" aria-label="关闭热门报道">✕</button>}</header>
    <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col"><TabsList className="h-8 justify-start rounded-none bg-slate-950">{[{id:'articles',label:'热门文章'},{id:'trend',label:'阅读趋势'},{id:'readtime',label:'阅读时长'},{id:'engagement',label:'用户互动'},{id:'forecast',label:'热度预测'}].map(t=><TabsTrigger key={t.id} value={t.id} className="rounded-none text-xs">{t.label}</TabsTrigger>)}</TabsList>
      <TabsContent value="articles" className="m-0"><SourceReturnDesk /></TabsContent>
      <TabsContent value="trend" className="m-0 p-3"><p>阅读量趋势（近7日）</p><p className="mt-3 text-amber-200">未接入按文章、时间与匿名会话去重的真实阅读事件。RSS 返回数量不是阅读量，因此不使用新闻抓取计数绘制阅读趋势。</p></TabsContent>
      <TabsContent value="readtime" className="m-0 p-3"><p>阅读时长分布</p><table className="mt-3 w-full text-left"><thead><tr><th>时长区间</th><th>有效阅读会话</th><th>占比</th></tr></thead><tbody>{['<2分钟','2-5分钟','5-10分钟','10-15分钟','>15分钟'].map(range=><tr key={range} className="border-t border-slate-800"><td className="py-2">{range}</td><td>未采集</td><td>未提供</td></tr>)}</tbody></table><p className="mt-3 text-slate-500">缺少打开、前台可见与关闭事件，不按字数推断真实阅读时长。</p></TabsContent>
      <TabsContent value="engagement" className="m-0 p-3"><p>用户互动数据</p><table className="mt-3 w-full text-left"><thead><tr><th>文章</th><th>阅读</th><th>分享</th><th>收藏</th><th>评论</th></tr></thead><tbody><tr className="border-t border-slate-800"><td colSpan={5} className="py-3">尚未接入具有文章 ID 与事件去重标识的互动记录，不展示固定评论数或分享数。</td></tr></tbody></table></TabsContent>
      <TabsContent value="forecast" className="m-0 p-3"><p>热度预测（未来24小时）</p><p className="mt-3 text-amber-200">没有真实阅读历史、模型版本与回测区间，预测值和置信区间不可用；不生成预设未来曲线。</p></TabsContent>
    </Tabs>
  </div>;
}
