import { Database } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const SOURCES = {
  fhfa: { label: 'FHFA 公开数据', detail: 'FHFA All-Transactions 地区级季度 HPI。该指数描述重复交易或再融资样本的平均房价变化，不是单项抵押物估值、资产权重、信用损失或证券价格。' },
  rate: { label: 'FRED / Freddie Mac', detail: 'FRED 转载 Freddie Mac PMMS 周度抵押利率。该字段不是 MBS、TBA、OAS 或指定贷款池的可执行报价。' },
  input: { label: '用户核验输入', detail: '此字段由终端用户录入或选择。使用前应按账户流程确认来源、观察时点、口径和权限。' },
  workspace: { label: '原工作区字段', detail: '原有工作区的字段与交互已保留。当前公开观察、计算和来源状态优先显示在终端内深化层；该字段不会被自动视为实时市场事实。' },
} as const;

export function MortgageFieldSourceLabel({ kind }: { kind: keyof typeof SOURCES }) {
  const source = SOURCES[kind];
  return <Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label={`${source.label}：${source.detail}`} className="inline-flex cursor-help items-center gap-1 rounded border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-[9px] text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"><Database className="h-2.5 w-2.5 text-cyan-300" />{source.label}</span></TooltipTrigger><TooltipContent side="top" sideOffset={6} className="max-w-80 border border-slate-700 bg-[#111827] px-3 py-2 text-left text-slate-200 leading-5 shadow-xl"><div className="font-semibold text-cyan-200">{source.label}</div><div className="mt-1 text-slate-300">{source.detail}</div></TooltipContent></Tooltip>;
}
