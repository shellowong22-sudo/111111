import { useMemo, useRef, useState, type RefObject } from 'react';
import { Download, FileDown, ImageDown, Printer } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card, PanelShell } from '@/components/sovereign/PanelKit';
import CreditInteractiveVisualizationPanels from './CreditInteractiveVisualizationPanels';

const COLORS: Record<string, string> = { IG: '#22d3ee', AAA: '#a78bfa', AA: '#60a5fa', BBB: '#f59e0b', HY: '#fb7185' };
const OAS_BUCKETS = ['IG', 'AAA', 'AA', 'BBB', 'HY'] as const;
type OasBucket = (typeof OAS_BUCKETS)[number];
type OasRow = { date: string; bucket: readonly OasBucket[] } & Partial<Record<OasBucket, number>>;

function svgToDataUrl(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
}

async function downloadPng(svg: SVGSVGElement, filename: string) {
  const image = new Image(); image.src = svgToDataUrl(svg);
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('图表图片转换失败')); });
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
  const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器不支持图片导出画布。');
  context.fillStyle = '#020617'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = filename; link.click();
}

function printAsPdf(svg: SVGSVGElement, title: string, boundary: string) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!popup) throw new Error('浏览器阻止了打印窗口；请允许本站打开窗口后重试。');
  const markup = new XMLSerializer().serializeToString(svg.cloneNode(true));
  popup.document.write(`<!doctype html><html><head><title>${title}</title><style>body{margin:30px;background:#fff;color:#111;font-family:Arial,"Noto Sans SC",sans-serif}.chart{width:100%;border:1px solid #ddd}p{font-size:12px;line-height:1.6;color:#444}@media print{body{margin:15mm}}</style></head><body><h1>${title}</h1>${markup}<p><strong>数据与方法边界：</strong>${boundary}</p><p>导出时间：${new Date().toLocaleString()}</p><script>window.addEventListener('load',()=>window.print())<\/script></body></html>`);
  popup.document.close();
}

function ExportButtons({ chartRef, filename, title, boundary, available }: { chartRef: RefObject<SVGSVGElement | null>; filename: string; title: string; boundary: string; available: boolean }) {
  const exportPng = async () => { if (!chartRef.current) return; try { await downloadPng(chartRef.current, `${filename}.png`); } catch (error) { alert(error instanceof Error ? error.message : '图片导出失败'); } };
  const exportPdf = () => { if (!chartRef.current) return; try { printAsPdf(chartRef.current, title, boundary); } catch (error) { alert(error instanceof Error ? error.message : 'PDF 导出失败'); } };
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={exportPng} disabled={!available} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-40"><ImageDown className="h-3 w-3" />PNG 图片</button><button type="button" onClick={exportPdf} disabled={!available} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"><Printer className="h-3 w-3" />打印 / 保存 PDF</button></div>;
}

function OasExportCard() {
  const chartRef = useRef<SVGSVGElement>(null); const query = trpc.creditResearch.getOasSnapshot.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: false });
  const rows = useMemo<OasRow[]>(() => { const byDate = new Map<string, Partial<Record<OasBucket, number>>>(); (query.data?.series ?? []).forEach((series) => { const bucket = series.bucket as OasBucket; if (!OAS_BUCKETS.includes(bucket)) return; series.history.slice(-90).forEach((point) => { byDate.set(point.date, { ...(byDate.get(point.date) ?? {}), [bucket]: point.valuePct * 100 }); }); }); return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, values]) => ({ date, ...values, bucket: OAS_BUCKETS })); }, [query.data]);
  const values = rows.flatMap((row) => OAS_BUCKETS.map((bucket) => Number(row[bucket])).filter(Number.isFinite)); const min = values.length ? Math.min(...values) : 0; const max = values.length ? Math.max(...values) : 1; const range = Math.max(1, max - min);
  const point = (index: number, value: number) => `${55 + (index / Math.max(1, rows.length - 1)) * 690},${235 - ((value - min) / range) * 180}`;
  return <Card title="OAS 图表导出" action={<ExportButtons chartRef={chartRef} filename="credit-oas-window" title="信用 OAS 多评级路径" boundary="FRED / ICE BofA 指数级日度 OAS；不是单券报价、实时 TRACE、CDS 或投资建议。" available={rows.length > 0} />}>{query.isLoading ? <div className="h-48 animate-pulse rounded bg-slate-800" /> : !rows.length ? <div className="rounded border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">当前无可导出的真实 OAS 观察值。数据恢复后会在此生成导出预览。</div> : <><svg ref={chartRef} viewBox="0 0 800 300" className="w-full rounded border border-slate-800 bg-slate-950" role="img" aria-label="FRED ICE BofA 信用 OAS 多评级路径"><rect width="800" height="300" fill="#020617" /><text x="55" y="28" fill="#e2e8f0" fontSize="15">信用 OAS 多评级路径 · 最近 90 个观察日</text><text x="55" y="48" fill="#94a3b8" fontSize="10">单位：bp · FRED / ICE BofA Indices</text>{[0, 1, 2, 3, 4].map((step) => { const value = min + (range * step) / 4; const y = 235 - (step * 180) / 4; return <g key={step}><line x1="55" x2="745" y1={y} y2={y} stroke="#1e293b" strokeDasharray="4 4" /><text x="8" y={y + 4} fill="#94a3b8" fontSize="10">{value.toFixed(0)}</text></g>; })}{OAS_BUCKETS.map((bucket) => { const pairs = rows.map((row, index) => typeof row[bucket] === 'number' ? point(index, Number(row[bucket])) : null).filter((value): value is string => !!value); return <g key={bucket}><polyline fill="none" stroke={COLORS[bucket]} strokeWidth="2" points={pairs.join(' ')} /> <text x={55 + OAS_BUCKETS.indexOf(bucket) * 58} y="275" fill={COLORS[bucket]} fontSize="11">● {bucket}</text></g>; })}<text x="55" y="252" fill="#64748b" fontSize="10">{rows[0]?.date}</text><text x="665" y="252" fill="#64748b" fontSize="10">{rows.at(-1)?.date}</text></svg><p className="mt-2 text-[10px] text-slate-500">导出的 PNG 与打印式 PDF 均来自当前已加载的真实 FRED 观察值，并在文件中保留来源与数据边界。</p></>}</Card>;
}

function YasExportCard() {
  const chartRef = useRef<SVGSVGElement>(null); const [base, setBase] = useState(''); const [macro, setMacro] = useState('0'); const [sector, setSector] = useState('0'); const [issuer, setIssuer] = useState('0');
  const items = [{ label: '起点', value: Number(base) }, { label: '宏观', value: Number(macro) }, { label: '行业', value: Number(sector) }, { label: '发行人', value: Number(issuer) }]; const valid = base.trim() && items.every((item) => Number.isFinite(item.value)); const total = valid ? items.reduce((sum, item) => sum + item.value, 0) : 0; const max = Math.max(1, ...items.map((item) => Math.abs(item.value)), Math.abs(total));
  return <Card title="YAS 情景图表导出" action={<ExportButtons chartRef={chartRef} filename="credit-yas-scenario" title="信用利差情景分解" boundary="图表全部数值均由用户输入的情景假设构成，不是实时 OAS、价格、预测或交易建议。" available={!!valid} />}><div className="grid gap-2 sm:grid-cols-4"><label className="text-[11px] text-slate-400">起点 OAS<input value={base} onChange={(event) => setBase(event.target.value)} inputMode="decimal" className="input-terminal mt-1 w-full" placeholder="bp" /></label><label className="text-[11px] text-slate-400">宏观<input value={macro} onChange={(event) => setMacro(event.target.value)} inputMode="decimal" className="input-terminal mt-1 w-full" /></label><label className="text-[11px] text-slate-400">行业<input value={sector} onChange={(event) => setSector(event.target.value)} inputMode="decimal" className="input-terminal mt-1 w-full" /></label><label className="text-[11px] text-slate-400">发行人<input value={issuer} onChange={(event) => setIssuer(event.target.value)} inputMode="decimal" className="input-terminal mt-1 w-full" /></label></div>{!valid ? <div className="mt-3 rounded border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">输入有效的起点 OAS 与情景假设后，生成可导出的分解图。</div> : <><svg ref={chartRef} viewBox="0 0 800 300" className="mt-3 w-full rounded border border-slate-800 bg-slate-950" role="img" aria-label="信用利差情景分解图"><rect width="800" height="300" fill="#020617" /><text x="55" y="28" fill="#e2e8f0" fontSize="15">信用利差情景分解</text><text x="55" y="48" fill="#94a3b8" fontSize="10">用户输入情景 · 单位：bp</text><line x1="55" x2="745" y1="235" y2="235" stroke="#475569" />{items.map((item, index) => { const height = (Math.abs(item.value) / max) * 150; const y = item.value >= 0 ? 235 - height : 235; return <g key={item.label}><rect x={95 + index * 145} y={y} width="76" height={height} fill={item.value >= 0 ? '#f59e0b' : '#fb7185'} rx="3" /><text x={95 + index * 145} y="258" fill="#cbd5e1" fontSize="11">{item.label}</text><text x={95 + index * 145} y={item.value >= 0 ? y - 8 : y + height + 16} fill="#e2e8f0" fontSize="11">{item.value >= 0 ? '+' : ''}{item.value.toFixed(1)}</text></g>; })}<rect x="670" y={235 - (Math.max(0, total) / max) * 150} width="55" height={(Math.abs(total) / max) * 150} fill="#22d3ee" rx="3" /><text x="670" y="258" fill="#cbd5e1" fontSize="11">情景</text><text x="670" y={235 - (Math.max(0, total) / max) * 150 - 8} fill="#67e8f9" fontSize="11">{total.toFixed(1)}</text></svg><p className="mt-2 text-[10px] text-slate-500">图形只可视化此处输入的情景数值；导出物不会暗示存在实时或未授权的市场数据。</p></>}</Card>;
}

export default function CreditChartExportPanels({ moduleId }: { moduleId: string }) {
  if (moduleId === '2') return <><CreditInteractiveVisualizationPanels moduleId="2" /><div className="mt-3"><PanelShell ticker="2E" title="OAS 图表分享导出" subtitle="将当前真实观察窗口导出为图片或打印式 PDF"><OasExportCard /></PanelShell></div></>;
  if (moduleId === '15') return <><CreditInteractiveVisualizationPanels moduleId="15" /><div className="mt-3"><PanelShell ticker="YAS-E" title="YAS 情景图表分享导出" subtitle="将用户输入的情景分解导出为图片或打印式 PDF"><YasExportCard /></PanelShell></div></>;
  return null;
}
