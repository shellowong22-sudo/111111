import { DatabaseZap, LockKeyhole, MessageCircleOff } from 'lucide-react';

type Scope = 'social' | 'soci' | 'tren';

const copy: Record<Scope, { code: string; title: string; focus: string }> = {
  social: { code: 'SOCL', title: '跨平台社交媒体分析', focus: '平台提及量、跨平台情绪与 14 天趋势' },
  soci: { code: 'SOCI', title: '社交监测', focus: '关键词提及、情绪雷达与市场关联' },
  tren: { code: 'TREN', title: '新闻趋势', focus: '主题热度、情绪分布与趋势排行' },
};

export default function SocialSourceEvidenceDesk({ scope }: { scope: Scope }) {
  const item = copy[scope];
  return <section className="rounded border border-violet-900/60 bg-slate-950 p-3 text-slate-100" data-social-source-evidence={scope}>
    <div className="flex items-start gap-2"><MessageCircleOff className="mt-0.5 h-4 w-4 text-violet-300" /><div><p className="text-sm font-bold text-violet-200">{item.code} · {item.title}证据状态</p><p className="mt-1 text-[10px] leading-4 text-slate-400">当前终端没有接入经授权的社交平台、关键词采集、原始帖文、时间范围、地域/语言过滤、去重规则或情绪模型审计记录；因此不显示{item.focus}，也不从固定数组、随机数或图表推导市场结论。</p></div></div>
    <div className="mt-3 grid gap-2 md:grid-cols-3"><Status icon={<DatabaseZap className="h-4 w-4 text-amber-300" />} label="原始社交来源" value="未接入" description="没有可核验的帖子、提及、账号或平台返回记录。" /><Status icon={<LockKeyhole className="h-4 w-4 text-amber-300" />} label="授权与方法" value="未导入" description="缺少采集权限、筛选范围、去重与模型方法证据。" /><Status icon={<MessageCircleOff className="h-4 w-4 text-amber-300" />} label="指标与图表" value="不可用" description="不能计算提及量、热度、情绪、相关性或趋势。" /></div>
    <p className="mt-3 rounded border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">暂无可验证社交数据。导入经授权的原始记录与方法审计后，才可在终端内按来源、时间和筛选条件展示。</p>
  </section>;
}

function Status({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
  return <div className="rounded border border-slate-800 bg-slate-900/35 p-2"><div className="flex items-center gap-1.5">{icon}<p className="text-[10px] text-slate-300">{label}</p></div><p className="mt-2 text-xs font-medium text-amber-200">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{description}</p></div>;
}
