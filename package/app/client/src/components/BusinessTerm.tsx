import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const BUSINESS_TERMS: Record<string, string> = {
  信用利差: '债券收益率相对可比基准的额外补偿，通常用于观察信用、流动性与期限等因素的综合影响。',
  流动性: '资产在不显著影响市场价格的情况下完成买卖或转让的便利程度。',
  利率敏感性: '市场利率变化时，债券价格可能发生变化的程度。',
  信用利差敏感性: '信用风险补偿变化时，债券价格可能发生变化的程度。',
  尾部情景: '发生概率较低、但潜在影响较大的不利市场情景。',
  OAS: '用于观察含权债券相对无风险曲线的综合补偿水平；应结合条款、期限与数据来源解读。',
  CDS: '信用违约互换。该合约用于转移或观察参考实体的信用风险补偿，不等同于现金债券报价。',
  回收假设: '信用事件发生后，研究或估值中对可收回价值比例采用的假设。',
  即期利率: '与特定期限现金流对应的当前利率参考。',
  远期利率: '由不同期限的当前利率关系推导出的期限比较参考，不代表确定的未来利率。',
  骑乘收益: '在收益率曲线形状保持相对稳定时，债券因剩余期限缩短而可能产生的相对收益变化。',
  拥挤度: '用于观察持仓集中、交易活跃和相对定价是否集中于同一方向的研究指标。',
  公允价值: '在有序交易中，市场参与者于计量日交换资产或转移负债时的估计价值参考。',
  数据时点: '数据所对应的观察、发布或记录时间；不同数据时点之间通常不可直接混用。',
  可执行报价: '在明确规模、方向、时点和条款下可进行交易的授权市场报价。',
  研究参考: '用于分析、比较或审批讨论的信息，不构成交易建议、保证或可执行报价。',
};

interface BusinessTermProps {
  term: keyof typeof BUSINESS_TERMS | string;
  children?: ReactNode;
  definition?: string;
  className?: string;
}

export function BusinessTerm({ term, children, definition, className = '' }: BusinessTermProps) {
  const explanation = definition ?? BUSINESS_TERMS[term] ?? '该术语用于业务研究说明；请结合数据来源、时点和适用范围理解。';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={`inline-flex items-center gap-0.5 cursor-help border-b border-dotted border-current/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${className}`}
          aria-label={`${term}：${explanation}`}
        >
          {children ?? term}
          <CircleHelp aria-hidden="true" className="h-3 w-3 opacity-65" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-72 border border-slate-700 bg-[#111827] px-3 py-2 text-left text-slate-200 leading-5 shadow-xl">
        <div className="font-semibold text-amber-300">{term}</div>
        <div className="mt-1 text-slate-300">{explanation}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export { BUSINESS_TERMS };
