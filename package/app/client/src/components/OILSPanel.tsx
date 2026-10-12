import React, { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { trpc } from '@/lib/trpc';

interface OILSPanelProps {
  onClose: () => void;
}

type MainTab = '价格' | '基本面' | '研究';
type AssetTab = '石油' | '天然气';
type ResearchTab = '新闻' | '研究边界';
type Range = '1y' | '3y' | '5y' | 'max';

const SERIES = {
  wti: { id: 'DCOILWTICO' as const, label: '美国原油价格（WTI）', unit: '美元/桶' },
  brent: { id: 'DCOILBRENTEU' as const, label: '欧洲原油（Brent）', unit: '美元/桶' },
  gas: { id: 'DHHNGSP' as const, label: 'Henry Hub 天然气', unit: '美元/百万英热单位' },
};

const chartTooltip = {
  contentStyle: {
    backgroundColor: '#0d0d0d',
    border: '1px solid #854d0e',
    color: '#f8fafc',
    fontSize: 10,
  },
};

function formatNumber(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

function formatDate(value: string | null | undefined) {
  return value ? value : '未提供';
}

function StatusMessage({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'warn' | 'error' }) {
  const color = tone === 'error' ? 'text-rose-300 border-rose-900/60 bg-rose-950/20' : tone === 'warn' ? 'text-amber-200 border-amber-900/60 bg-amber-950/20' : 'text-[#777] border-[#222] bg-[#080808]';
  return <div className={`border px-3 py-3 text-xs ${color}`}>{children}</div>;
}

function MetricCard({ label, value, sub, tone = 'normal' }: { label: string; value: string; sub: string; tone?: 'normal' | 'positive' | 'negative' }) {
  const valueClass = tone === 'positive' ? 'text-[#00e676]' : tone === 'negative' ? 'text-[#ff6b6b]' : 'text-white';
  return (
    <div className="border border-[#222] bg-[#090909] px-3 py-2">
      <div className="text-[10px] text-[#666]">{label}</div>
      <div className={`mt-1 text-base font-semibold ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[10px] text-[#555]">{sub}</div>
    </div>
  );
}

function SeriesRow({ label, unit, latest, observationDate, change, status }: {
  label: string;
  unit: string;
  latest: number | null | undefined;
  observationDate: string | null | undefined;
  change: number | null | undefined;
  status: string | undefined;
}) {
  const available = status === 'available' && latest != null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_90px_78px_110px] items-center gap-2 border-b border-[#111] px-2 py-2 text-xs">
      <span className="truncate text-[#f5a623]">{label}</span>
      <span className="text-right text-white">{available ? formatNumber(latest) : '—'}</span>
      <span className={`text-right ${change == null ? 'text-[#555]' : change >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]'}`}>
        {change == null ? '—' : `${change >= 0 ? '+' : ''}${formatNumber(change)}`}
      </span>
      <span className="truncate text-right text-[#666]">{available ? `${formatDate(observationDate)} · ${unit}` : '暂不可读'}</span>
    </div>
  );
}

export default function OILSPanel({ onClose }: OILSPanelProps) {
  const [mainTab, setMainTab] = useState<MainTab>('价格');
  const [assetTab, setAssetTab] = useState<AssetTab>('石油');
  const [researchTab, setResearchTab] = useState<ResearchTab>('新闻');
  const [range, setRange] = useState<Range>('3y');

  const wti = trpc.commodityResearch.getSeries.useQuery({ id: SERIES.wti.id, range }, { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 });
  const brent = trpc.commodityResearch.getSeries.useQuery({ id: SERIES.brent.id, range }, { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 });
  const gas = trpc.commodityResearch.getSeries.useQuery({ id: SERIES.gas.id, range }, { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 });
  const operations = trpc.commodityResearch.getEnergyOperations.useQuery({ range }, { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 });
  const news = trpc.newsResearch.getGlobalFeed.useQuery(
    { language: 'all', region: 'all', keyword: 'oil', limit: 30 },
    { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true, retry: 1 },
  );
  const cftc = trpc.derivativesResearch.getFinceptCftcSnapshot.useQuery(undefined, {
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const refresh = async () => {
    await Promise.all([wti.refetch(), brent.refetch(), gas.refetch(), operations.refetch(), news.refetch(), cftc.refetch()]);
  };

  const priceRows = assetTab === '石油'
    ? [
      { ...SERIES.brent, data: brent.data?.series, query: brent },
      { ...SERIES.wti, data: wti.data?.series, query: wti },
    ]
    : [{ ...SERIES.gas, data: gas.data?.series, query: gas }];

  const priceChart = useMemo(() => {
    const wtiHistory = wti.data?.series?.history ?? [];
    const brentHistory = brent.data?.series?.history ?? [];
    const brentByDate = new Map(brentHistory.map((point) => [point.date, point.value]));
    return wtiHistory.flatMap((point) => {
      const brentValue = brentByDate.get(point.date);
      return brentValue == null ? [] : [{ date: point.date, wti: point.value, brent: brentValue }];
    });
  }, [wti.data, brent.data]);

  const operationRows = operations.data?.series ?? [];
  const operationById = new Map(operationRows.map((row) => [row.id, row]));
  const cftcHistory = cftc.data?.history ?? [];
  const wtiCot = cftcHistory.find((item) => {
    const fields = (item.fields ?? {}) as Record<string, unknown>;
    const symbol = String(item.symbol ?? '');
    const name = String(fields.name ?? fields.contractName ?? '');
    return symbol.includes('067651') || /WTI|原油/.test(name);
  }) ?? null;
  const wtiCotFields = (wtiCot?.fields ?? {}) as Record<string, unknown>;
  const cotPositionRows = [
    ['生产商/贸易商', wtiCotFields.producerLong, wtiCotFields.producerShort, wtiCotFields.producerNet],
    ['掉期交易商', wtiCotFields.swapLong, wtiCotFields.swapShort, wtiCotFields.swapNet],
    ['管理资金', wtiCotFields.managedMoneyLong, wtiCotFields.managedMoneyShort, wtiCotFields.managedMoneyNet],
    ['其他报告机构', wtiCotFields.otherReportLong, wtiCotFields.otherReportShort, wtiCotFields.otherReportNet],
    ['非报告机构', wtiCotFields.nonReportableLong, wtiCotFields.nonReportableShort, wtiCotFields.nonReportableNet],
  ] as const;
  const feedRows = (news.data?.rows ?? []) as Array<{
    title?: string;
    summary?: string;
    publishedAt?: string | null;
    region?: string;
    language?: string;
  }>;

  const loadingPrices = priceRows.some((row) => row.query.isLoading);
  const hasPriceError = priceRows.some((row) => row.query.isError);
  const hasOperations = operationRows.some((row) => row.status === 'available');

  return (
    <div className="flex h-full flex-col bg-black text-white font-mono text-xs">
      <div className="flex items-center gap-3 border-b border-[#333] bg-[#0a0a0a] px-3 py-1.5">
        <span className="font-bold text-[#f5a623]">OILS</span>
        <span className="text-[#aaa]">石油冲击</span>
        <button type="button" onClick={onClose} className="ml-auto text-[#aaa] hover:text-white" aria-label="关闭 OILS 石油冲击">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#333] bg-[#270000] px-3 py-1.5">
        {(['价格', '基本面', '研究'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`border px-2 py-0.5 text-xs ${mainTab === tab ? 'border-[#f5a623] bg-[#f5a623] text-black' : 'border-[#444] text-[#aaa] hover:border-[#f5a623]'}`}
          >
            {tab}
          </button>
        ))}
        <button type="button" onClick={() => void refresh()} disabled={wti.isFetching || brent.isFetching || gas.isFetching || operations.isFetching || news.isFetching || cftc.isFetching} className="ml-auto inline-flex items-center gap-1 border border-[#555] px-2 py-0.5 text-[#aaa] hover:border-[#f5a623] disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${(wti.isFetching || brent.isFetching || gas.isFetching || operations.isFetching || news.isFetching || cftc.isFetching) ? 'animate-spin' : ''}`} />
          刷新真实数据
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-[#222] bg-[#0d0d0d] px-3 py-1">
        {(['石油', '天然气'] as const).map((tab) => (
          <button type="button" key={tab} onClick={() => setAssetTab(tab)} className={`pb-0.5 text-xs ${assetTab === tab ? 'border-b border-[#f5a623] text-white' : 'text-[#666] hover:text-[#aaa]'}`}>{tab}</button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[10px] text-[#666]">
          历史窗口
          <select value={range} onChange={(event) => setRange(event.target.value as Range)} className="border border-[#333] bg-[#090909] px-1 py-0.5 text-[10px] text-[#aaa]">
            <option value="1y">1 年</option>
            <option value="3y">3 年</option>
            <option value="5y">5 年</option>
            <option value="max">全部可读历史</option>
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {mainTab === '价格' && (
          <div className="grid gap-3 p-3 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="border-r border-[#222] pr-3">
              <div className="mb-2 flex items-center justify-between border-b border-[#111] pb-1.5">
                <span className="font-bold text-[#f5a623]">能源价格</span>
                <span className="text-[10px] text-[#555]">实际观察 · 非实时成交报价</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_90px_78px_110px] gap-2 border-b border-[#111] px-2 py-1 text-[10px] text-[#555]">
                <span>关键指标</span><span className="text-right">最新</span><span className="text-right">前值变动</span><span className="text-right">观察日 / 单位</span>
              </div>
              {loadingPrices ? <StatusMessage>正在读取商品价格…</StatusMessage> : hasPriceError ? <StatusMessage tone="error">价格数据暂未更新，请稍后刷新。</StatusMessage> : priceRows.map((row) => (
                <SeriesRow key={row.id} label={row.label} unit={row.unit} latest={row.data?.latest} observationDate={row.data?.observationDate} change={row.data?.change} status={row.query.data?.status} />
              ))}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {priceRows.map((row) => (
                  <MetricCard key={row.id} label={row.label} value={row.query.data?.status === 'available' ? formatNumber(row.data?.latest) : '—'} sub={row.data?.observationDate ? `${row.data.observationDate} · ${row.unit}` : '暂无观察'} tone={(row.data?.change ?? 0) >= 0 ? 'positive' : 'negative'} />
                ))}
              </div>
            </section>

            <section className="min-w-0">
              {assetTab === '石油' ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-bold text-[#f5a623]">WTI / Brent 共同观测日曲线</span>
                    <span className="text-[10px] text-[#555]">仅共同日期</span>
                  </div>
                  {!priceChart.length ? <StatusMessage tone="warn">当前没有足够的 WTI 与 Brent 共同日期数据，终端不插值、不补造曲线。</StatusMessage> : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={priceChart}>
                          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} minTickGap={28} />
                          <YAxis tick={{ fill: '#666', fontSize: 9 }} domain={['auto', 'auto']} />
                          <Tooltip {...chartTooltip} />
                          <Line type="monotone" dataKey="wti" name="WTI（美元/桶）" stroke="#f5a623" dot={false} strokeWidth={1.8} />
                          <Line type="monotone" dataKey="brent" name="Brent（美元/桶）" stroke="#22d3ee" dot={false} strokeWidth={1.8} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetricCard label="Henry Hub 天然气" value={gas.data?.status === 'available' ? formatNumber(gas.data.series?.latest) : '—'} sub={gas.data?.series?.observationDate ? `${gas.data.series.observationDate} · ${SERIES.gas.unit}` : '暂无观察'} />
                </div>
              )}
            </section>
          </div>
        )}

        {mainTab === '基本面' && (
          <div className="grid gap-3 p-3">
            <section className="border border-[#222] bg-[#080808] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-[#f5a623]">美国能源周度运行数据</span>
                <span className="text-[10px] text-[#555]">{operations.data?.asOf ? `读取时间 ${new Date(operations.data.asOf).toLocaleString('zh-CN')}` : '读取中'}</span>
              </div>
              {!hasOperations ? <StatusMessage tone="warn">{operations.isLoading ? '正在读取周度库存数据…' : operations.error ? '周度库存数据暂未更新；不使用静态库存或利用率。' : '当前没有可读取的 EIA 实际观察。'}</StatusMessage> : (
                <div className="grid gap-2 md:grid-cols-2">
                  {['WCESTUS1', 'WPULEUS3'].map((id) => {
                    const row = operationById.get(id);
                    return <MetricCard key={id} label={row?.label ?? id} value={row?.status === 'available' ? formatNumber(row.latest, id === 'WPULEUS3' ? 1 : 0) : '—'} sub={row?.observationDate ? `${row.observationDate} · ${row.unit}` : '暂无观察'} tone={(row?.change ?? 0) >= 0 ? 'positive' : 'negative'} />;
                  })}
                </div>
              )}
              
            </section>
          </div>
        )}

        {mainTab === '研究' && (
          <div className="p-3">
            <section className="mb-3 border border-[#222] bg-[#080808] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[#f5a623]">WTI 持仓结构</span>
                  <span className="ml-2 text-[10px] text-[#666]">周度持仓报告</span>
                </div>
                <span className={`text-[10px] ${wtiCot ? 'text-[#00e676]' : cftc.isError ? 'text-[#ff6b6b]' : 'text-[#777]'}`}>
                  {cftc.isFetching ? '读取中' : wtiCot ? `报告日 ${String(wtiCotFields.reportDate ?? wtiCot.date ?? '—')}` : cftc.isError ? '暂不可读' : '暂无 WTI 记录'}
                </span>
              </div>
              {cftc.isError ? (
                <StatusMessage tone="error">WTI 持仓周报读取失败；不使用旧值或其他合约替代。</StatusMessage>
              ) : !wtiCot ? (
                <StatusMessage tone="warn">当前归档周报没有可验证的 WTI 合约记录。</StatusMessage>
              ) : (
                <>
                  <div className="mb-2 grid gap-2 sm:grid-cols-3">
                    <MetricCard label="合约名称" value={String(wtiCotFields.contractName ?? wtiCotFields.name ?? wtiCot.symbol)} sub="报告标的" />
                    <MetricCard label="未平仓量" value={formatNumber(typeof wtiCotFields.openInterest === 'number' ? wtiCotFields.openInterest : null, 0)} sub="合约数" />
                    <MetricCard label="观察时效" value="周度" sub="不是实时成交/订单簿" />
                  </div>
                  <div className="overflow-x-auto border border-[#222]">
                    <table className="min-w-[620px] w-full text-left text-[11px]">
                      <thead className="text-[#666]">
                        <tr>
                          <th className="px-2 py-1.5">报告类别</th>
                          <th className="px-2 py-1.5 text-right">多头</th>
                          <th className="px-2 py-1.5 text-right">空头</th>
                          <th className="px-2 py-1.5 text-right">净仓</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cotPositionRows.map(([label, long, short, net]) => (
                          <tr key={label} className="border-t border-[#171717]">
                            <td className="px-2 py-1.5 text-[#ddd]">{label}</td>
                            <td className="px-2 py-1.5 text-right text-[#aaa]">{typeof long === 'number' ? long.toLocaleString() : '—'}</td>
                            <td className="px-2 py-1.5 text-right text-[#aaa]">{typeof short === 'number' ? short.toLocaleString() : '—'}</td>
                            <td className={`px-2 py-1.5 text-right ${typeof net !== 'number' ? 'text-[#555]' : net >= 0 ? 'text-[#00e676]' : 'text-[#ff6b6b]'}`}>
                              {typeof net === 'number' ? `${net >= 0 ? '+' : ''}${net.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
            {news.isLoading ? <StatusMessage>正在读取新闻…</StatusMessage> : news.isError ? <StatusMessage tone="error">新闻读取失败，请稍后刷新。</StatusMessage> : !feedRows.length ? <StatusMessage tone="warn">当前没有返回与石油主题匹配的公开新闻。</StatusMessage> : (
              <div className="space-y-2">
                {feedRows.map((item, index) => (
                  <article key={`${item.publishedAt ?? 'unknown'}-${item.title ?? index}`} className="border-b border-[#222] pb-2">
                    <div className="flex items-center gap-2 text-[10px] text-[#666]"><span>{item.publishedAt ? new Date(item.publishedAt).toLocaleString('zh-CN') : '时间未提供'}</span><span>{item.region ?? '地区未提供'}</span><span>{item.language ?? '语言未提供'}</span></div>
                    <h3 className="mt-1 text-xs leading-5 text-[#ddd]">{item.title ?? '标题未提供'}</h3>
                    {item.summary && <p className="mt-1 text-[10px] leading-4 text-[#777]">{item.summary}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#333] bg-[#0a0a0a] px-3 py-1.5">
        
        <span className="border border-[#555] px-2 py-0.5 text-[10px] text-[#777]">数据边界透明</span>
      </div>
    </div>
  );
}
