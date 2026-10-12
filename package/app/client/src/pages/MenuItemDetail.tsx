import { lazy, Suspense, ComponentType, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MENU_ITEM_CONFIG } from '@/lib/menuItemHandler';
import CommodityPreservedModule from '@/components/commodity/CommodityPreservedModule';
import ForexPreservedModule from '@/components/forex/ForexPreservedModule';
import NewsPreservedModule from '@/components/news/NewsPreservedModule';

// --- 22 个新闻模块 -> 专属面板（懒加载，避免首屏体积膨胀） -----------------------
const NEWS_PANELS: Record<string, () => Promise<{ default: ComponentType }>> = {
  TOP: () => import('@/components/news/TOPPanel'),
  BTDY: () => import('@/components/news/BTDYPanel'),
  FRNT: () => import('@/components/news/FRNTPanel'),
  CN: () => import('@/components/news/CNPanel'),
  READ: () => import('@/components/news/READPanel'),
  NI: () => import('@/components/news/NIPanel'),
  NH: () => import('@/components/news/NHPanel'),
  FIRS: () => import('@/components/news/FIRSPanel'),
  BI: () => import('@/components/news/BIPanel'),
  BECO: () => import('@/components/news/BECOPanel'),
  DAYB: () => import('@/components/news/DAYBPanel'),
  MAG: () => import('@/components/news/MAGPanel'),
  MEDI: () => import('@/components/news/MEDIPanel'),
  OPIN: () => import('@/components/news/OPINPanel'),
  BNEF: () => import('@/components/news/BNEFPanel'),
  MYN: () => import('@/components/news/MYNPanel'),
  NLRT: () => import('@/components/news/NLRTPanel'),
  NSUB: () => import('@/components/news/NSUBPanel'),
  MREP: () => import('@/components/news/MREPPanel'),
  NZPD: () => import('@/components/news/NZPDPanel'),
  SOCI: () => import('@/components/news/SOCIPanel'),
  TREN: () => import('@/components/news/TRENPanel'),
};

// 分组标题/别名 -> 代表性面板（消除概念性栏目的死链）
const NEWS_ALIASES: Record<string, string> = {
  'NI BMRDRV': 'NI',
  BMAP: 'FRNT',
};

// 衍生品功能模块 -> 直接跳转到对应深度页面
const DERIVATIVES_REDIRECT: Record<string, string> = {
  'SWPM': '/swpm', 'WBF': '/wbf', 'CDSW': '/cdsw', 'WCDS': '/wcds',
  'OVME': '/ovme', 'MOSO': '/moso', 'OVML': '/ovml', 'WVOL': '/wvol',
  'GLCO': '/glco', 'OVCV': '/ovcv', 'DLIB': '/dlib', 'VCA': '/vca',
  'MARS': '/mars', 'BICO': '/bico', 'NI DRV': '/ni-drv', 'DERI': '/deri',
  'FOM': '/fom', 'WBF-AI': '/wbf-ai', 'CREDIT-MONITOR': '/credit-monitor',
};

function resolveNewsCode(itemId: string): string | null {
  const upper = itemId.toUpperCase();
  if (NEWS_PANELS[upper]) return upper;
  if (NEWS_ALIASES[upper]) return NEWS_ALIASES[upper];
  return null;
}

// --- 商品 / 指数自设工具板块 -> 专属面板 -----------------------------------
const MARKET_PANELS: Record<string, () => Promise<{ default: ComponentType }>> = {
  CPLY: () => import('@/components/markets/CPLYPanel'),
  COSY: () => import('@/components/markets/COSYPanel'),
  GP: () => import('@/components/markets/GPPanel'),
  MAP: () => import('@/components/markets/MAPPanel'),
  WBIX: () => import('@/components/markets/WBIXPanel'),
  INP: () => import('@/components/markets/INPPanel'),
  CIX: () => import('@/components/markets/CIXPanel'),
  WTWTR: () => import('@/components/markets/WTWTRPanel'),
  CIXX: () => import('@/components/markets/CIXXPanel'),
  // 大宗商品模块
  COMM: () => import('@/components/markets/COMMPanel'),
  SPOT: () => import('@/components/markets/SPOTPanel'),
  CTM: () => import('@/components/markets/CTMPanel'),
  SEAG: () => import('@/components/markets/SEAGPanel'),
  CCRV: () => import('@/components/markets/CCRVPanel'),
  CMRV: () => import('@/components/markets/CMRVPanel'),
  // 指数模块
  WEI: () => import('@/components/markets/WEIPanel'),
  GMM: () => import('@/components/markets/GMMPanel'),
  RRG: () => import('@/components/markets/RRGPanel'),
  WEIF: () => import('@/components/markets/WEIFPanel'),
};
const COMMODITY_RESEARCH_CODES = new Set(['COMM', 'SPOT', 'CTM', 'SEAG', 'CCRV', 'CMRV', 'MAP', 'CPLY', 'COSY', 'GP']);

// --- 外汇门户板块 -> 专属面板 ----------------------------------------------
const FOREX_PANELS: Record<string, () => Promise<{ default: ComponentType }>> = {
  FXIP: () => import('@/components/forex/FXIPPanel'),
  FXDS: () => import('@/components/forex/FXDSPanel'),
  XDSH: () => import('@/components/forex/XDSHPanel'),
  ALLQ: () => import('@/components/forex/ALLQPanel'),
  FRD: () => import('@/components/forex/FRDPanel'),
  BFIX: () => import('@/components/forex/BFIXPanel'),
  FXFA: () => import('@/components/forex/FXFAPanel'),
  STNI: () => import('@/components/forex/STNIPanel'),
  ECMI: () => import('@/components/forex/ECMIPanel'),
  FXTF: () => import('@/components/forex/FXTFPanel'),
};

function resolveForexCode(itemId: string): string | null {
  const upper = itemId.toUpperCase();
  return FOREX_PANELS[upper] ? upper : null;
}

// --- 通讯与社区板块 -> 专属面板（部分共享组件，按 props 区分）-----------------
import type { ReactElement } from 'react';
const MSGPanel = lazy(() => import('@/components/comms/MSGPanel'));
const IBPanel = lazy(() => import('@/components/comms/IBPanel'));
const SPDLPanel = lazy(() => import('@/components/comms/SPDLPanel'));
const PEOPPanel = lazy(() => import('@/components/comms/PEOPPanel'));
const NOTEPanel = lazy(() => import('@/components/comms/NOTEPanel'));
const CMTYPanel = lazy(() => import('@/components/comms/CMTYPanel'));
const FILEPanel = lazy(() => import('@/components/comms/FILEPanel'));
const CommsSettings = lazy(() => import('@/components/comms/CommsSettings'));
const CommsPreservedModule = lazy(() => import('@/components/comms/CommsPreservedModule'));
const preserveComms = (moduleId: string, original: ReactElement) => <CommsPreservedModule moduleId={moduleId}>{original}</CommsPreservedModule>;

const COMMS_RENDERERS: Record<string, () => ReactElement> = {
  // 邮件客户端（不同文件夹/撰写入口共享 MSGPanel）
  MSG: () => preserveComms('MSG', <MSGPanel defaultFolder="inbox" />),
  MSGS: () => preserveComms('MSGS', <MSGPanel defaultFolder="inbox" />),
  'MSG 4': () => preserveComms('MSG-4', <MSGPanel defaultFolder="sent" />),
  'MSG 10': () => preserveComms('MSG-10', <MSGPanel defaultFolder="deleted" />),
  'MSG 8': () => preserveComms('MSG-8', <MSGPanel defaultFolder="delayed" />),
  DRAF: () => preserveComms('DRAF', <MSGPanel defaultFolder="draft" />),
  MSGE: () => preserveComms('MSGE', <MSGPanel defaultFolder="inbox" />),
  MSGA: () => preserveComms('MSGA', <MSGPanel defaultFolder="inbox" />),
  MSGN: () => preserveComms('MSGN', <MSGPanel defaultFolder="inbox" />),
  SMSG: () => preserveComms('SMSG', <MSGPanel defaultFolder="inbox" />),
  // 即时短信
  IB: () => preserveComms('IB', <IBPanel />),
  IBSR: () => preserveComms('IBSR', <IBPanel />),
  IBB: () => preserveComms('IBB', <IBPanel />),
  IBS: () => preserveComms('IBS', <IBPanel />),
  IBME: () => preserveComms('IBME', <IBPanel />),
  // 联系人
  SPDL: () => preserveComms('SPDL', <SPDLPanel />),
  SPDI: () => preserveComms('SPDI', <SPDLPanel importMode />),
  // 人物
  PEOP: () => preserveComms('PEOP', <PEOPPanel />),
  BIO: () => preserveComms('BIO', <PEOPPanel bioMode />),
  // 笔记
  NOTE: () => preserveComms('NOTE', <NOTEPanel />),
  SHAR: () => preserveComms('SHAR', <NOTEPanel sharedMode />),
  // 社区 / 文件
  CMTY: () => preserveComms('CMTY', <CMTYPanel />),
  FILE: () => preserveComms('FILE', <FILEPanel />),
  // 设置类
  MGU: () => preserveComms('MGU', <CommsSettings mode="MGU" />),
  MRUL: () => preserveComms('MRUL', <CommsSettings mode="MRUL" />),
  VACN: () => preserveComms('VACN', <CommsSettings mode="VACN" />),
  SMGM: () => preserveComms('SMGM', <CommsSettings mode="SMGM" />),
};
const EMSXPanel = lazy(() => import('@/components/EMSXPanel'));

function resolveCommsCode(itemId: string): string | null {
  return COMMS_RENDERERS[itemId] ? itemId : null;
}

// CIX 系列 7 个编辑器：共享 CIXEditor，仅 mode 不同
const CIX_MODES: Record<string, string> = {
  CIXB: 'basket', CIXS: 'spread', CIXR: 'ratio', AGG: 'aggregate',
  CIXC: 'convert', CIXN: 'expression', CIXI: 'timeseries',
};

function resolveMarketCode(itemId: string): string | null {
  const upper = itemId.toUpperCase();
  if (MARKET_PANELS[upper]) return upper;
  if (CIX_MODES[upper]) return upper;
  return null;
}

// --- 其余类别（保留原通用面板推断） --------------------------------------------
function inferPanelType(itemId: string): { functionType: string; category: string } {
  const upper = itemId.toUpperCase();
  if (upper.startsWith('ECO') || upper.startsWith('WECO') || upper.startsWith('FOMC') || upper.startsWith('WIRP')) {
    return { functionType: 'economics', category: 'economics' };
  }
  if (upper.includes('BOND') || upper.includes('YIELD') || upper.includes('RATE') || upper.startsWith('FIT') || upper.startsWith('GOV')) {
    return { functionType: 'bonds', category: 'sovereign-bonds' };
  }
  if (upper.startsWith('FX') || upper.startsWith('WCR') || upper.startsWith('XCCY') || upper.startsWith('WVOL')) {
    return { functionType: 'forex', category: 'forex' };
  }
  if (upper.startsWith('GLC') || upper.startsWith('OIL') || upper.startsWith('AGRI') || upper.startsWith('COM') || upper.startsWith('ENER') || upper.startsWith('META')) {
    return { functionType: 'commodities', category: 'commodities' };
  }
  if (upper.startsWith('OV') || upper.startsWith('SWPM') || upper.startsWith('CDSW') || upper.startsWith('MOSO') || upper.startsWith('VCA') || upper.startsWith('DLIB') || upper.startsWith('MARS')) {
    return { functionType: 'options', category: 'derivatives' };
  }
  if (upper.startsWith('EMSX') || upper.startsWith('TSOX') || upper.startsWith('ALLQ') || upper.startsWith('BOLT') || upper.startsWith('ETA')) {
    return { functionType: 'trading', category: 'trading' };
  }
  if (upper.startsWith('BRES') || upper.startsWith('ANR') || upper.startsWith('BSR') || upper.startsWith('BRS')) {
    return { functionType: 'research', category: 'research' };
  }
  return { functionType: 'dashboard', category: 'stocks' };
}

function PanelLoading() {
  return (
    <div className="flex items-center justify-center py-32 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">正在加载面板…</span>
    </div>
  );
}

function UnpublishedFeatureNotice({ code, title }: { code: string; title: string }) {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-6">
      <div className="w-full border border-slate-800 bg-slate-950 p-6 text-center">
        <p className="font-mono text-xs text-amber-300">{code}</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-100">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          此入口尚未绑定可验证的真实组件和数据契约，系统不会创建静态占位面板或伪造数据。
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5 border-slate-700 text-slate-200"
          onClick={() => window.location.assign('/')}
        >
          返回终端目录
        </Button>
      </div>
    </section>
  );
}

export default function MenuItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const [, setLocation] = useLocation();

  if (!itemId) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">页面未找到</h2>
          <Button onClick={() => setLocation('/')}>返回首页</Button>
        </div>
      </div>
    );
  }

  // 跨入口的 canonical 路由必须在这里收敛：WEI 只保留原有完整
  // WEIPanel 工作台，不能再由 /menu-item/WEI 渲染第二份简化面板。
  const normalizedItemId = itemId.toUpperCase();
  const weiRedirect = normalizedItemId === 'WEI'
    ? '/terminal?module=stocks&open=wei'
    : undefined;
  // 衍生品功能模块直接跳转到对应深度页面
  const derivRedirect = DERIVATIVES_REDIRECT[itemId] || DERIVATIVES_REDIRECT[normalizedItemId];
  // 新闻类代码统一进入新闻终端对应功能（同一功能只保留一个实现，避免重复）
  const newsRedirect = resolveNewsCode(itemId) ? `/news-hub?tab=${resolveNewsCode(itemId)!.toLowerCase()}` : undefined;
  useEffect(() => {
    const redirect = weiRedirect || derivRedirect || newsRedirect;
    if (redirect) {
      setLocation(redirect);
    }
  }, [derivRedirect, newsRedirect, setLocation, weiRedirect]);

  if (weiRedirect || derivRedirect || newsRedirect) return null;

  const config = MENU_ITEM_CONFIG[itemId];
  const title = config?.name || itemId;
  const newsCode = resolveNewsCode(itemId);
  const marketCode = resolveMarketCode(itemId);
  const forexCode = resolveForexCode(itemId);
  const commsCode = resolveCommsCode(itemId);
  const isEmsx = itemId.toUpperCase() === 'EMSX';
  const hideHeader = Boolean(newsCode || marketCode || forexCode || commsCode || isEmsx);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-foreground flex flex-col">
      {/* 顶部导航栏：专属新闻面板自带头部，避免重复 */}
      <div className={`sticky top-0 z-40 border-b border-slate-800 bg-[#0a0a0f]/95 backdrop-blur-sm ${hideHeader ? 'hidden' : ''}`}>
        <div className="px-4 py-2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-amber-400 font-mono font-semibold text-sm">{itemId}</span>
          <span className="text-slate-400 text-sm">{title}</span>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        {newsCode ? (
          <Suspense fallback={<PanelLoading />}>
            <NewsPanelRenderer code={newsCode} />
          </Suspense>
        ) : marketCode ? (
          <Suspense fallback={<PanelLoading />}>
            <MarketPanelRenderer code={marketCode} />
          </Suspense>
        ) : forexCode ? (
          <Suspense fallback={<PanelLoading />}>
            <ForexPanelRenderer code={forexCode} />
          </Suspense>
        ) : commsCode ? (
          <Suspense fallback={<PanelLoading />}>
            {COMMS_RENDERERS[commsCode]()}
          </Suspense>
        ) : isEmsx ? (
          <Suspense fallback={<PanelLoading />}>
            <EMSXPanel onClose={() => setLocation('/')} />
          </Suspense>
        ) : (
          <UnpublishedFeatureNotice code={itemId} title={title} />
        )}
      </div>
    </div>
  );
}

// 根据代码动态渲染对应的懒加载新闻面板
const panelCache: Record<string, ComponentType> = {};
function NewsPanelRenderer({ code }: { code: string }) {
  if (!panelCache[code]) {
    panelCache[code] = lazy(NEWS_PANELS[code]);
  }
  const Panel = panelCache[code];
  return <NewsPreservedModule moduleId={code}><Panel /></NewsPreservedModule>;
}

// 外汇面板渲染
const forexCache: Record<string, ComponentType> = {};
function ForexPanelRenderer({ code }: { code: string }) {
  if (!forexCache[code]) {
    forexCache[code] = lazy(FOREX_PANELS[code]);
  }
  const Panel = forexCache[code];
  return <ForexPreservedModule moduleId={code}><Panel /></ForexPreservedModule>;
}

// 商品 / 指数面板渲染（含 CIX 系列编辑器）
const marketCache: Record<string, ComponentType> = {};
const CIXEditorLazy = lazy(() => import('@/components/markets/CIXEditor'));
function MarketPanelRenderer({ code }: { code: string }) {
  if (CIX_MODES[code]) {
    const mode = CIX_MODES[code] as import('@/components/markets/CIXEditor').CIXMode;
    return <CIXEditorLazy mode={mode} />;
  }
  if (!marketCache[code]) {
    marketCache[code] = lazy(MARKET_PANELS[code]);
  }
  const Panel = marketCache[code];
  return COMMODITY_RESEARCH_CODES.has(code) ? <CommodityPreservedModule moduleId={code.toLowerCase()}><Panel /></CommodityPreservedModule> : <div><Panel /></div>;
}
