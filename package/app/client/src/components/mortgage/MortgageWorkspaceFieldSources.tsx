import { useEffect, useRef, type ReactNode } from 'react';

const INPUT_DETAIL = '用户录入或选择的研究字段。使用前需按账户流程确认来源、观察时点、口径及权限；终端不会把该输入自动视为实时市场数据。';
const WORKSPACE_DETAIL = '保留原工作区的字段。当前公开观察、来源状态和终端内计算优先显示在上方深化层；该字段不会被自动视为新鲜市场事实。';

type FieldProvenance = { label: string; detail: string; sourceId: string };

function provenanceFor(moduleId: string, fieldName: string): FieldProvenance {
  const normalized = fieldName.replace(/\s+/g, ' ').trim();
  const base = `MBS-${moduleId} · 原工作区 · ${normalized.slice(0, 48) || '保留字段'}`;
  if (/OAS|Spread|利差|收益率|久期|凸性/i.test(normalized)) return { sourceId: `${base} · 历史市场字段`, label: '历史市场字段', detail: `${base}。该数值来自原工作区的历史界面保留，未附当前公开或授权报价来源；不得作为当前可执行报价、实时利差或估值事实。请以后方终端内公开观察或授权数据为准。` };
  if (/评级|迁移|违约|损失|信用/i.test(normalized)) return { sourceId: `${base} · 历史信用字段`, label: '历史信用字段', detail: `${base}。该字段为原工作区历史展示或分析设定，未附当前评级机构原件、授权迁移数据或证券级损失数据；不得作为当前信用结论。` };
  if (/城市|入驻率|DSCR|租金|CMBS|地域|地图/i.test(normalized)) return { sourceId: `${base} · 历史地域字段`, label: '历史地域字段', detail: `${base}。该字段为原工作区历史地域展示，未附当前公开或授权抵押物、物业经营或地域级 CMBS 数据；不得作为当前地域事实。` };
  if (/曲线|情景|压力|回测|趋势|矩阵/i.test(normalized)) return { sourceId: `${base} · 历史分析字段`, label: '历史分析字段', detail: `${base}。该字段为原工作区历史分析呈现或情景设定，未附当前可复算的公开输入；它只保留原有交互，不构成当前预测、市场路径或投资结论。` };
  return { sourceId: `${base} · 原项目界面`, label: '原项目保留字段', detail: `${base}。该字段的原始界面和交互已保留，但未附独立公开或授权数据标识；请将其作为历史工作区上下文，而非当前市场或抵押物事实。` };
}

function appendBadge(target: HTMLElement, label: string, detail: string, sourceId?: string) {
  if (target.dataset.sourceAnnotated === 'true') return;
  target.dataset.sourceAnnotated = 'true';
  const badge = document.createElement('span');
  badge.className = 'ml-1 inline-flex cursor-help items-center rounded border border-slate-700 bg-slate-900/70 px-1 py-0.5 align-middle text-[9px] font-normal normal-case tracking-normal text-slate-400';
  badge.tabIndex = 0;
  badge.title = detail;
  badge.setAttribute('aria-label', `${label}：${detail}`);
  if (sourceId) badge.dataset.sourceId = sourceId;
  badge.textContent = label;
  target.appendChild(badge);
}

export default function MortgageWorkspaceFieldSources({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const decorate = () => {
      const root = rootRef.current; if (!root) return;
      root.querySelectorAll('label').forEach((label) => {
        if (!label.querySelector('input, select, textarea')) return;
        const field = label.childNodes[0]?.textContent?.trim() || label.textContent?.trim() || '用户输入';
        appendBadge(label as HTMLElement, '数据：用户核验输入', `${INPUT_DETAIL}\n溯源标识：MBS-${moduleId} · 用户输入 · ${field}`, `MBS-${moduleId} · 用户输入 · ${field}`);
      });
      root.querySelectorAll('th').forEach((header) => {
        const field = header.textContent?.trim() || '表格字段';
        const provenance = provenanceFor(moduleId, field);
        appendBadge(header as HTMLElement, `来源：${provenance.label}`, provenance.detail, provenance.sourceId);
      });
      root.querySelectorAll('div, p, span').forEach((element) => {
        const target = element as HTMLElement;
        if (target.dataset.sourceAnnotated === 'true' || target.children.length > 0) return;
        const field = target.textContent?.trim() || '';
        if (!field || field.length > 48 || !/OAS|Spread|利差|收益率|久期|凸性|评级|迁移|违约|损失|信用|城市|入驻率|DSCR|租金|CMBS|地域|地图|曲线|情景|压力|回测|趋势|矩阵/i.test(field)) return;
        const provenance = provenanceFor(moduleId, field);
        appendBadge(target, `来源：${provenance.label}`, provenance.detail, provenance.sourceId);
      });
    };
    decorate();
    const observer = new MutationObserver(decorate);
    if (rootRef.current) observer.observe(rootRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [moduleId]);
  return <div ref={rootRef}>{children}</div>;
}
