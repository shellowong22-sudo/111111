import { useEffect, useRef, type ReactNode } from 'react';

type Provenance = { label: string; detail: string; sourceId: string };

function provenanceFor(moduleId: string, fieldName: string): Provenance {
  const name = fieldName.replace(/\s+/g, ' ').trim().slice(0, 56) || '保留字段';
  const root = `地方债 ${moduleId} · 原工作区 · ${name}`;
  if (/成交|交易|价格|买价|卖价|收益率|利差|报价|交易量|成交额/i.test(name)) return { sourceId: `${root} · 历史交易字段`, label: '历史交易字段', detail: `${root}。该数值保留自原工作区界面，当前未订阅结构化成交资料；本平台不将其视为实时成交、可执行报价、当前收益率或真实交易量。` };
  if (/指数|曲线|BMA|SIFMA|VRDN|SLGS|期限|认购|赎回|库存/i.test(name)) return { sourceId: `${root} · 历史研究字段`, label: '历史研究字段', detail: `${root}。该字段保留原有图表或研究交互。当前可读取的财政部 SLGS 官方活动会在原面板之后的终端内深化层单独标识；该原字段不自动等同于当前指数、曲线、库存或重设资料。` };
  if (/评级|信用|健康|偿债|债务|税收|人口|发行人|财务/i.test(name)) return { sourceId: `${root} · 历史发行人字段`, label: '历史发行人字段', detail: `${root}。该字段是原工作区历史展示或分析设定，未附当前发行人文件或授权信用数据。请使用下方本平台发行人证据归档中的已保存文件链接、指纹和核验证据片段进行审阅。` };
  return { sourceId: `${root} · 原项目保留字段`, label: '原项目保留字段', detail: `${root}。原界面和交互保持不变，但该字段未附独立的当前公开或授权数据标识；请将其作为历史工作区上下文，而非当前市场事实。` };
}

function appendBadge(target: HTMLElement, provenance: Provenance) {
  if (target.dataset.municipalSourceAnnotated === 'true') return;
  target.dataset.municipalSourceAnnotated = 'true';
  const badge = document.createElement('span');
  badge.className = 'ml-1 inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 p-0 align-middle text-[8px] font-normal normal-case leading-none text-slate-400';
  badge.textContent = 'i'; badge.title = `${provenance.label}\n${provenance.detail}\n溯源标识：${provenance.sourceId}`; badge.tabIndex = 0; badge.dataset.sourceId = provenance.sourceId; badge.setAttribute('aria-label', badge.title);
  target.appendChild(badge);
}

export default function MunicipalWorkspaceFieldSources({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const decorate = () => {
      const root = rootRef.current; if (!root) return;
      root.querySelectorAll('label').forEach((node) => {
        if (!node.querySelector('input,select,textarea')) return;
        const name = node.childNodes[0]?.textContent?.trim() || node.textContent?.trim() || '用户输入';
        appendBadge(node as HTMLElement, { sourceId: `地方债 ${moduleId} · 用户核验输入 · ${name}`, label: '用户核验输入', detail: `地方债 ${moduleId} · 用户核验输入 · ${name}。该值仅供终端内研究工作流使用；系统不会将其自动视为实时市场数据、发行人事实或投资结论。` });
      });
      root.querySelectorAll('th').forEach((node) => appendBadge(node as HTMLElement, provenanceFor(moduleId, node.textContent ?? '表格字段')));
      // 大型原面板中只对明确的表头和输入控件一次性标注。避免遍历所有 div/span，
      // 也避免插入标签时触发观察器导致的重排循环。
    };
    decorate();
  }, [moduleId]);
  return <div ref={rootRef}>{children}</div>;
}
