import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import ModuleLiveDeliveryTable from '@/components/ModuleLiveDeliveryTable';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';

function displayTime(value: string | null) {
  if (!value) return '等待首批数据';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '时间不可用' : parsed.toLocaleString();
}

export default function CommodityMarket() {
  const delivery = useModuleLiveFeed('/commodity-market', true);
  const datasetCount = delivery.items.filter(item => item.dataset).length;
  const rowCount = delivery.items.reduce((total, item) => total + (item.dataset?.metadata.displayedRowCount ?? 0), 0);
  const isLive = delivery.connection === 'live';

  return (
    <main className="min-h-screen bg-[#02070b] text-slate-100" data-openbb-module="commodity-market">
      <header className="border-b border-slate-800 bg-[#050c11] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-base font-semibold text-slate-100">商品市场</h1><p className="mt-0.5 text-[11px] text-slate-500">能源、金属与农产品的已校验市场数据</p></div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
            <span className={isLive ? 'text-emerald-300' : 'text-amber-300'}>{isLive ? <Wifi className="mr-1 inline h-3 w-3" /> : <WifiOff className="mr-1 inline h-3 w-3" />}{isLive ? 'SSE 实时连接' : delivery.connection === 'connecting' ? '正在连接' : '轮询补收'}</span>
            <span>结构化数据集 {datasetCount}</span><span>当前载入 {rowCount} 行</span><span>接收 {displayTime(delivery.receivedAt)}</span>
            <button type="button" onClick={() => void delivery.refetch()} disabled={delivery.isLoading} className="inline-flex h-7 items-center gap-1 border border-slate-700 px-2 text-slate-300 hover:border-cyan-700 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${delivery.isLoading ? 'animate-spin' : ''}`} />刷新</button>
          </div>
        </div>
      </header>
      {delivery.error ? <div role="alert" className="border-b border-rose-900/60 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-200">数据暂不可用，当前页面不会使用固定价格或模拟行情填充。可使用刷新重试；连接恢复后将自动补收。</div> : null}
      <ModuleLiveDeliveryTable items={delivery.items} connection={delivery.connection} receivedAt={delivery.receivedAt} title="商品市场结构化数据" />
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-black px-3 py-1.5 font-mono text-[10px] text-slate-600"><span>现货参考历史按观察期展示。</span><span>缺失数据以 — 表示。</span></footer>
    </main>
  );
}
