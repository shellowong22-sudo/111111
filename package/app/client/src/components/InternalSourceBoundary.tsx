import { ExternalLink, ShieldCheck, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

type SourceNotice = { url: string; label: string };

function normalizeLabel(anchor: HTMLAnchorElement) {
  return anchor.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) || '外部来源链接';
}

export default function InternalSourceBoundary() {
  const [notice, setNotice] = useState<SourceNotice | null>(null);

  useEffect(() => {
    const onExternalAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as Element | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href')?.trim() ?? '';
      if (!anchor || !/^https?:\/\//i.test(href)) return;

      event.preventDefault();
      event.stopPropagation();
      setNotice({ url: href, label: normalizeLabel(anchor) });
    };

    document.addEventListener('click', onExternalAnchorClick, true);
    document.addEventListener('auxclick', onExternalAnchorClick, true);
    return () => {
      document.removeEventListener('click', onExternalAnchorClick, true);
      document.removeEventListener('auxclick', onExternalAnchorClick, true);
    };
  }, []);

  if (!notice) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" role="presentation" onMouseDown={() => setNotice(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="internal-source-boundary-title" className="w-full max-w-xl rounded-lg border border-cyan-800 bg-slate-950 p-5 text-slate-100 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] tracking-wide text-cyan-300">IN-TERMINAL SOURCE BOUNDARY</p>
              <h2 id="internal-source-boundary-title" className="mt-1 text-base font-semibold">来源链接已保留在终端内</h2>
            </div>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="关闭来源边界提示"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <p>冻结页面保留了来源锚点“{notice.label}”，但根据当前恢复边界，点击不会打开第三方网页或将该网页作为功能结果展示。</p>
          <div className="rounded border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">来源地址（仅作可审计元数据）</p>
            <p className="mt-1 break-all font-mono text-xs text-cyan-200"><ExternalLink className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{notice.url}</p>
          </div>
          <p className="text-xs text-amber-200">当前终端未读取、转述或验证该外部页面内容。需要可用数据时，仅应通过已接入的终端内接口或经审计的授权来源提供。</p>
        </div>
        <div className="mt-5 flex justify-end"><button type="button" onClick={() => setNotice(null)} className="rounded border border-cyan-700 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-950">留在终端内</button></div>
      </section>
    </div>
  );
}
