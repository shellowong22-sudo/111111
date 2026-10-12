import { BookOpenCheck, MessageSquareWarning, UserRoundX } from 'lucide-react';

export default function CommentaryEvidenceDesk({ scope = 'commentary' }: { scope?: 'commentary' | 'opin' }) {
  const isOpin = scope === 'opin';
  const title = isOpin ? 'OPIN · 专属观点来源证据状态' : '评论与分析 · 作者内容证据状态';
  const description = isOpin
    ? '当前终端没有接入经授权的品牌观点内容、作者身份、内容许可、原文、发布时间、编辑审核、观点标签、阅读或互动审计记录；因此不显示专属观点、作者文章、赞同率或阅读量。'
    : '当前终端没有接入经授权的作者稿件、作者身份、内容许可、原文、发布时间、编辑审核、观点标签、阅读或互动审计记录；因此不显示评论文章数、专家观点、深度分析、作者观点、赞同率、反对率或阅读量。';
  const empty = isOpin ? '暂无可验证专属观点记录。接入经授权内容及审核审计后，才可在终端内按作者和来源显示。' : '暂无可验证评论与分析记录。接入经授权稿件及审核审计后，才可在终端内按作者和来源显示。';
  return <section className="rounded border border-violet-900/60 bg-slate-950 p-3 text-slate-100" data-commentary-evidence="true" data-commentary-scope={scope}><div className="flex items-start gap-2"><MessageSquareWarning className="mt-0.5 h-4 w-4 text-violet-300" /><div><p className="text-sm font-bold text-violet-200">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{description}</p></div></div><div className="mt-3 grid gap-2 md:grid-cols-3"><Status icon={<UserRoundX className="h-4 w-4 text-amber-300" />} label="作者与稿件" value="未接入" description="没有可验证作者身份、原文或发布时间记录。" /><Status icon={<BookOpenCheck className="h-4 w-4 text-amber-300" />} label="许可与编辑审核" value="未导入" description="没有转载许可、审稿、标签或版本审计证据。" /><Status icon={<MessageSquareWarning className="h-4 w-4 text-amber-300" />} label="阅读与互动统计" value="不可用" description="不能生成赞同率、反对率、阅读量或热门观点。" /></div><p className="mt-3 rounded border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">{empty}</p></section>;
}

function Status({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
  return <div className="rounded border border-slate-800 bg-slate-900/35 p-2"><div className="flex items-center gap-1.5">{icon}<p className="text-[10px] text-slate-300">{label}</p></div><p className="mt-2 text-xs font-medium text-amber-200">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{description}</p></div>;
}
