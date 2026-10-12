/**
 * STP 直通式处理工作台。
 * 原页面的六个主标签读取空的服务端接口并展示示例数据，已整体替换为平台真实交易数据的功能面板；
 * 每个功能代码只有一个实现，同义代码（VCON/FXTB/ALEX/POST/STPE/RHAD）在面板文件中统一到对应实现。
 */
import { lazy, Suspense, useState, type ComponentType, type LazyExoticComponent } from 'react';

type PanelProps = { onClose?: () => void };
const L = (f: () => Promise<{ default: ComponentType<PanelProps> }>) => lazy(f);

const STP_PANEL_MAP: Record<string, LazyExoticComponent<ComponentType<PanelProps>>> = {
  RESD: L(() => import('@/components/stp/ResdPanel')), VCON: L(() => import('@/components/stp/VconPanel')),
  BLOT: L(() => import('@/components/stp/BlotPanel')), FXTB: L(() => import('@/components/stp/FxtbPanel')),
  FXSS: L(() => import('@/components/stp/FxssPanel')), ALEX: L(() => import('@/components/stp/AlexPanel')),
  TRPV: L(() => import('@/components/stp/TrpvPanel')), DTCP: L(() => import('@/components/stp/DtcpPanel')),
  POST: L(() => import('@/components/stp/PostPanel')), STPE: L(() => import('@/components/stp/StpePanel')),
  ALOB: L(() => import('@/components/stp/AlobPanel')), VCAD: L(() => import('@/components/stp/VcadPanel')),
  ALOS: L(() => import('@/components/stp/AlosPanel')), SREF: L(() => import('@/components/stp/SrefPanel')),
  ESTP: L(() => import('@/components/stp/EstpPanel')), IB: L(() => import('@/components/stp/IbPanel')),
  SPDL: L(() => import('@/components/stp/SpdlPanel')), FSTN: L(() => import('@/components/stp/FstnPanel')),
  MIFI: L(() => import('@/components/stp/MifiPanel')), BRRS: L(() => import('@/components/stp/BrrsPanel')),
  RHUB: L(() => import('@/components/stp/RhubPanel')), RHAD: L(() => import('@/components/stp/RhadPanel')),
  RHUD: L(() => import('@/components/stp/RhudPanel')), RHAB: L(() => import('@/components/stp/RhabPanel')),
};

/** 工作台主标签：按“成交 → 确认 → 轧差 → 交收 → 申报”的处理顺序排列 */
const HUB_TABS: Array<[string, string]> = [
  ['ESTP', '处理流程'], ['BLOT', '成交簿'], ['VCAD', '成交确认'], ['DTCP', '净额交收'], ['FXSS', '外汇交收'],
  ['ALOS', '交收路由'], ['FSTN', '交收预警'], ['SREF', '异常转介'], ['RESD', '交易申报'], ['RHUB', '监管报告'],
];

const urlPanel = () => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('panel')?.toUpperCase() || '');

function Loading({ code }: { code: string }) {
  return <div className="flex h-screen items-center justify-center bg-[#03070c] text-sm text-slate-400">加载 {code} …</div>;
}

export default function STPProcessing() {
  const fixed = urlPanel();
  const [tab, setTab] = useState(() => (fixed && STP_PANEL_MAP[fixed] ? fixed : 'ESTP'));

  // 带 ?panel= 打开：直接渲染对应功能面板
  if (fixed && STP_PANEL_MAP[fixed] && !HUB_TABS.some(([c]) => c === fixed)) {
    const Panel = STP_PANEL_MAP[fixed];
    return <Suspense fallback={<Loading code={fixed} />}><Panel /></Suspense>;
  }

  const Panel = STP_PANEL_MAP[tab];
  const choose = (c: string) => {
    setTab(c);
    try { const u = new URL(window.location.href); u.searchParams.set('panel', c); window.history.replaceState(null, '', u.toString()); } catch { /* 地址栏同步失败不影响使用 */ }
  };
  return (
    <div className="bg-[#03070c] text-slate-200">
      <div className="flex h-8 items-center gap-px overflow-x-auto border-b border-[#1a2a3c] bg-[#06101b] px-2 text-[11px]">
        <span className="mr-3 shrink-0 font-semibold text-amber-300">STP 直通式处理</span>
        {HUB_TABS.map(([c, n]) => (
          <button key={c} type="button" onClick={() => choose(c)} className={`shrink-0 px-2.5 py-1 ${tab === c ? 'bg-sky-600/30 text-sky-100' : 'text-slate-400 hover:bg-[#0a1726] hover:text-slate-200'}`}>
            <span className="mr-1 font-mono text-[10px] text-amber-300/80">{c}</span>{n}
          </button>
        ))}
      </div>
      <Suspense fallback={<Loading code={tab} />}><Panel key={tab} /></Suspense>
    </div>
  );
}
