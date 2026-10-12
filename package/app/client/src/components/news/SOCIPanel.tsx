import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function SOCIPanel({ onClose }: { onClose?: () => void }) {
  const [tab,setTab] = useState('platforms');
  return <div className="flex h-full min-h-[500px] flex-col bg-[#07090e] font-mono text-xs text-slate-200" data-news-soci-source-state="unconfigured">
    <header className="flex items-center gap-3 border-b border-slate-700 p-2"><strong className="text-sky-300">SOCI</strong><span>社交监测 · 多平台情绪 · 大V观点 · 热门标的</span>{onClose&&<button onClick={onClose} className="ml-auto" aria-label="关闭社交监测">✕</button>}</header>
    <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col"><TabsList className="h-8 justify-start rounded-none bg-slate-950">{[{id:'platforms',label:'平台情绪'},{id:'kol',label:'大V观点'},{id:'series',label:'情绪时序'},{id:'tickers',label:'热门标的'}].map(t=><TabsTrigger key={t.id} value={t.id} className="rounded-none text-xs">{t.label}</TabsTrigger>)}</TabsList>
      <p role="status" className="border-y border-slate-800 p-2 text-amber-200">尚未配置可核验的社交内容源、平台访问范围与情绪方法。官方公告不替代社交帖文，不生成账号言论、粉丝数或市场情绪。</p>
      <TabsContent value="platforms" className="m-0 p-3"><p>各平台实时情绪分布（多/空/中性%）</p><table className="mt-3 w-full text-left"><thead><tr><th>平台</th><th>帖子</th><th>多方</th><th>中性</th><th>空方</th><th>采集状态</th></tr></thead><tbody>{['X/Twitter','Reddit','StockTwits','LinkedIn','Discord'].map(platform=><tr key={platform} className="border-t border-slate-800"><td className="py-3">{platform}</td><td>未提供</td><td>未评级</td><td>未评级</td><td>未评级</td><td>未配置授权源</td></tr>)}</tbody></table></TabsContent>
      <TabsContent value="kol" className="m-0 p-3"><p>影响力账号最新观点（按互动量排序）</p><table className="mt-3 w-full text-left"><thead><tr><th>账号</th><th>粉丝</th><th>观点原文</th><th>原帖时间</th><th>互动</th></tr></thead><tbody><tr className="border-t border-slate-800"><td colSpan={5} className="py-3">没有经授权采集并保留原帖链接的观点记录，不为真实人物编造言论。</td></tr></tbody></table></TabsContent>
      <TabsContent value="series" className="m-0 p-3"><p>近7日各平台多方情绪分走势（0-100）</p><p className="mt-3 text-amber-200">尚无带来源、采样窗口、去重方法与模型版本的历史情绪序列。曲线保持空状态。</p></TabsContent>
      <TabsContent value="tickers" className="m-0 p-3"><p>社交媒体热门标的（24小时提及量 & 情绪分）</p><table className="mt-3 w-full text-left"><thead><tr><th>标的</th><th>24小时提及</th><th>情绪分</th><th>24h变化</th></tr></thead><tbody><tr className="border-t border-slate-800"><td colSpan={4} className="py-3">缺少真实帖文与证券实体关联，无法计算热门标的；不复用其他新闻模块榜单。</td></tr></tbody></table></TabsContent>
    </Tabs>
  </div>;
}
