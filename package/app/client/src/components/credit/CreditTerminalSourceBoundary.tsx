import { useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { FileText } from 'lucide-react';

type SourceMetadata = {
  host: string;
  path: string;
  label: string;
};

function parseSourceMetadata(href: string, label: string): SourceMetadata {
  try {
    const url = new URL(href);
    return { host: url.host, path: url.pathname || '/', label: label.trim() || '公开资料来源' };
  } catch {
    return { host: '未识别来源', path: '—', label: label.trim() || '公开资料来源' };
  }
}

/**
 * 仅包裹信用债新增研究层。
 * 所有公开来源均保留在终端内作为可追溯元数据，不将用户导航至第三方页面。
 */
export function CreditTerminalSourceBoundary({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SourceMetadata | null>(null);

  const interceptExternalSource = (event: MouseEvent<HTMLDivElement> | DragEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor || !/^https?:\/\//i.test(anchor.href)) return;
    event.preventDefault();
    event.stopPropagation();
    setSelected(parseSourceMetadata(anchor.href, anchor.textContent ?? ''));
  };

  return (
    <div
      onClickCapture={interceptExternalSource}
      onAuxClickCapture={interceptExternalSource}
      onContextMenuCapture={interceptExternalSource}
      onDragStartCapture={interceptExternalSource}
    >
      {selected && (
        <section role="status" className="mb-2 flex flex-wrap items-start justify-between gap-2 rounded border border-cyan-900/70 bg-cyan-950/20 px-3 py-2 text-[10px] text-slate-200">
          <div className="flex min-w-0 items-start gap-2">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <div>
              <p className="font-medium text-cyan-100">终端内来源元数据：{selected.label}</p>
              <p className="mt-0.5 break-all text-slate-400">机构：{selected.host} · 文件路径：{selected.path}</p>
              <p className="mt-0.5 text-slate-500">为保持资料在本终端内阅读，系统不打开第三方页面。若尚未通过服务端读取结构化字段，则该资料保持来源记录而非内容替代。</p>
            </div>
          </div>
          <button type="button" onClick={() => setSelected(null)} className="shrink-0 text-cyan-300 hover:text-cyan-100">关闭</button>
        </section>
      )}
      {children}
    </div>
  );
}
