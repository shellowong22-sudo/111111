import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { Download, FileUp, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type FhfaRow = {
  region: string;
  exposureWeightPct: number;
  hpiChangePct: number | null;
  observationDate: string;
  sourceUrl: string;
  sourceLabel: string;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

export function downloadFhfaTemplate() {
  const content = 'region,exposureWeightPct,hpiChangePct,observationDate,sourceUrl\nBoston-Cambridge,55.25,3.1,2026-01-01,https://www.fhfa.gov/data/hpi/datasets\nMiami-Fort Lauderdale,44.75,,2026-01-01,https://www.fhfa.gov/data/hpi/datasets\n';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'fhfa-geographic-exposure-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Mbs21FhfaCsvImport() {
  const [name, setName] = useState('FHFA 地理暴露导入');
  const [rows, setRows] = useState<FhfaRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const importRows = trpc.mortgageCollaboration.importMbs21FhfaCsv.useMutation({
    onSuccess: (result) => { toast.success(`FHFA 地理暴露已导入：${result.imported ?? rows.length} 行`); setRows([]); },
    onError: (error) => toast.error(error.message),
  });
  const totalWeight = useMemo(() => rows.reduce((sum, row) => sum + row.exposureWeightPct, 0), [rows]);

  const readFile = async (file: File) => {
    try {
      const lines = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
      const [header, ...body] = lines;
      const columns = parseCsvLine(header).map((cell) => cell.trim());
      const required = ['region', 'exposureWeightPct', 'observationDate', 'sourceUrl'];
      if (required.some((column) => !columns.includes(column))) throw new Error('CSV 必须包含 region、exposureWeightPct、observationDate、sourceUrl 列。');
      const parsed = body.map((line) => {
        const cells = parseCsvLine(line);
        const get = (column: string) => cells[columns.indexOf(column)] ?? '';
        const change = get('hpiChangePct');
        return { region: get('region'), exposureWeightPct: Number(get('exposureWeightPct')), hpiChangePct: change === '' ? null : Number(change), observationDate: get('observationDate'), sourceUrl: get('sourceUrl'), sourceLabel: 'FHFA House Price Index 数据集' };
      });
      if (!parsed.length) throw new Error('CSV 没有可导入的记录。');
      if (parsed.some((row) => !row.region || !Number.isFinite(row.exposureWeightPct) || (row.hpiChangePct !== null && !Number.isFinite(row.hpiChangePct)))) throw new Error('CSV 中存在无法解析的地区或数值字段。');
      setRows(parsed);
      setParseError(null);
    } catch (error) {
      setRows([]);
      setParseError(error instanceof Error ? error.message : 'CSV 解析失败。');
    }
  };

  return <section className="mt-4 rounded border border-cyan-900/60 bg-cyan-950/10 p-3" aria-label="FHFA 地理暴露 CSV 批量导入">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-cyan-100">FHFA 地理暴露 CSV 批量导入</p><p className="mt-1 text-xs leading-5 text-slate-400">浏览器仅预检结构；提交后由服务器重新校验 FHFA 官方域名、日期、重复地区与总权重。不会保存原始 CSV 文件字节。</p></div><Button type="button" size="sm" variant="outline" className="border-cyan-800 text-cyan-100" onClick={downloadFhfaTemplate}><Download className="mr-1 h-3.5 w-3.5" />下载模板</Button></div>
    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"><Input value={name} onChange={(event) => setName(event.target.value)} aria-label="导入名称" className="border-slate-700 bg-slate-950 text-slate-100" /><Input type="file" accept=".csv,text/csv" aria-label="FHFA CSV 文件" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} className="border-slate-700 bg-slate-950 text-slate-300" /></div>
    {parseError && <p className="mt-2 text-xs text-rose-300">{parseError}</p>}
    {rows.length > 0 && <div className="mt-3 rounded border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300"><div className="flex flex-wrap items-center justify-between gap-2"><span>已预检 {rows.length} 行，暴露权重合计 {totalWeight.toFixed(2)}%</span><Button type="button" size="sm" disabled={importRows.isPending || totalWeight > 100} onClick={() => importRows.mutate({ name, rows })}><FileUp className="mr-1 h-3.5 w-3.5" />{importRows.isPending ? '导入中' : '提交服务器校验并导入'}</Button></div>{totalWeight > 100 && <p className="mt-2 text-amber-300">当前权重超过 100%，提交已禁用。</p>}</div>}
    <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />仅 MBS-21 地域暴露台账可使用此导入；服务器会按账户权限和审计规则处理。</p>
  </section>;
}
