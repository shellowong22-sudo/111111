import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export default function ThirdPartySourceEvidenceDesk() {
  const [region, setRegion] = useState('all');
  const query = trpc.newsResearch.getGlobalFeed.useQuery({ language: 'all', region: 'all', keyword: '', limit: 1 }, { refetchInterval: 60_000, staleTime: 30_000 });
  const sources = (query.data?.sources ?? []).filter(source => region === 'all' || source.region === region);
  return <section className="border-y border-slate-700 bg-slate-950 text-xs text-slate-200" data-third-party-source-evidence="true">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 p-2"><h3 className="mr-auto font-semibold text-indigo-200">3RD · 外部来源评级证据状态</h3><select aria-label="来源地区" value={region} onChange={e => setRegion(e.target.value)} className="border border-slate-600 bg-slate-900 p-1">{['all', '欧洲', '美洲', '亚太', '全球'].map(value => <option key={value} value={value}>{value === 'all' ? '全部地区' : value}</option>)}</select><button onClick={() => void query.refetch()} disabled={query.isFetching} className="border border-slate-600 px-2 py-1 disabled:opacity-40">{query.isFetching ? '检测中' : '刷新来源状态'}</button></div>
    <p className="border-b border-slate-800 p-2 text-[10px] text-slate-400">授权内容来源：官方公开 RSS 元数据；评级方法与审核：仅显示实际连通、条目数、发布时间与响应耗时。排名与文章展示：不生成可信度评分，不复制其他功能的文章列表。商业转载许可需向来源机构确认。</p>
    {query.error && <p role="alert" className="p-2 text-red-300">{query.error.message}</p>}
    <div className="overflow-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-900 text-slate-400"><tr>{['来源 / API', '地区', '语言', '接口状态', '条目数', '响应 ms', '最新发布', '检查时间'].map(label => <th key={label} className="p-2 font-normal">{label}</th>)}</tr></thead><tbody>{sources.map(source => <tr key={source.id} className="border-t border-slate-800"><td className="p-2 text-indigo-200">{source.name}</td><td>{source.region}</td><td>{source.language}</td><td className={source.error ? 'text-amber-300' : 'text-emerald-300'}>{source.error || '返回有效数据'}</td><td>{source.rowCount}</td><td>{source.latencyMs}</td><td className="p-2 font-mono text-[10px]">{source.latestPublishedAt ? new Date(source.latestPublishedAt).toLocaleString('zh-CN') : '未提供'}</td><td className="p-2 font-mono text-[10px]">{new Date(source.fetchedAt).toLocaleString('zh-CN')}</td></tr>)}</tbody></table></div>
    <div className="border-t border-slate-800 px-2 py-1 text-[10px] text-slate-500">每 60 秒检查 · 抓取成功不等于本分钟发布 · 来源异常直接呈现，不以旧数据伪装成功</div>
  </section>;
}
