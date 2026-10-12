import { BellOff, BookmarkX, ShieldCheck, UserRoundX } from 'lucide-react';

type Mode = 'personal' | 'myn' | 'nlrt' | 'nsub';
const COPY: Record<Mode, { code: string; title: string; summary: string; empty: string }> = {
  personal: { code: 'PERS', title: '个性化新闻证据状态', summary: '当前没有已导入或已授权读取的兴趣档案、关注主题、阅读历史、屏蔽规则或推荐模型输入，因此不生成“为您推荐”、兴趣标签或未读数。', empty: '没有可验证的个人偏好或推荐记录。' },
  myn: { code: 'MYN', title: '我的新闻证据状态', summary: '当前没有已导入或已授权读取的个人订阅、保存文章、阅读状态或收件箱记录，因此不显示“我的订阅”、未读数、书签或个人文章流。', empty: '没有可验证的个人订阅或阅读记录。' },
  nlrt: { code: 'NLRT', title: '新闻提醒证据状态', summary: '当前没有已导入或已授权读取的提醒规则、收件渠道、触发日志或用户通知许可，因此不能创建、触发、关闭或统计提醒。', empty: '没有可验证的提醒规则、触发记录或通知授权。' },
  nsub: { code: 'NSUB', title: '新闻订阅证据状态', summary: '当前没有已导入或已授权读取的来源订阅、授权范围、文章收件记录或质量评估依据，因此不显示订阅数、文章数、质量评分或可切换状态。', empty: '没有可验证的来源订阅或质量评估记录。' },
};

export default function PrivateNewsEvidenceDesk({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const Icon = mode === 'nlrt' ? BellOff : mode === 'myn' ? BookmarkX : mode === 'personal' ? UserRoundX : ShieldCheck;
  return <section className="rounded-lg border border-cyan-900/50 bg-slate-950/40 p-3" data-private-news-evidence={mode}><div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 text-cyan-300" /><div><p className="text-sm font-bold text-cyan-200">{copy.code} · {copy.title}</p><p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-400">{copy.summary}</p></div></div><div className="mt-3 grid gap-2 md:grid-cols-3"><State label="账户私有记录" value="未导入" /><State label="授权读取范围" value="未连接" /><State label="写入与通知操作" value="不可用" /></div><p className="mt-3 rounded border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">{copy.empty} 终端保持真实空状态，不以固定样例、临时开关或浏览器本地状态伪造用户数据。</p><p className="mt-2 rounded border border-amber-900/60 bg-amber-950/20 p-2 text-[10px] leading-4 text-amber-100" data-private-news-historical-boundary={mode}>下方完整保留原窗口的订阅、未读、推荐、提醒、来源、文章数和质量评分结构；这些内容不是当前账户事实，且已禁用交互。</p></section>;
}

function State({ label, value }: { label: string; value: string }) { return <div className="rounded border border-slate-800 bg-slate-900/35 p-2"><p className="text-[9px] text-slate-400">{label}</p><p className="mt-2 text-xs font-semibold text-amber-200">{value}</p></div>; }
