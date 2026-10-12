import type { ReactNode } from 'react';

function normalize(id: string) { return id.toUpperCase().replace(/\s+/g, '_'); }

export function ForexEntryBoundary({ code, title }: { code: string; title: string }) {
  return <section className="m-4 rounded border border-amber-900/80 bg-amber-950/20 p-4 text-xs text-amber-100"><p className="font-semibold text-amber-300">{code} · {title} · 当前功能区数据扩展</p><p className="mt-2 text-amber-100/80">本窗口保留原菜单入口、字段和资料结构；数据卡、筛选、详情和图表均在当前功能区内展开。没有可核验公开来源时，终端显示加载、空或不可用状态，不以示例报价替代。</p></section>;
}

export default function ForexPreservedModule({ moduleId, children }: { moduleId: string; children?: ReactNode }) {
  void normalize(moduleId);
  // 各外汇功能均为完整实时面板；不再在下方追加资料归档层（与 WCRS 央行利率重复，且含来源信息）。
  return <div className="h-full min-h-0 overflow-y-auto bg-slate-950 pb-20"><>{children}</></div>;
}
