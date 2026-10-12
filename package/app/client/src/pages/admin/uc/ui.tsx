/**
 * 佑诚数据工作台通用控件：与前端终端同一套深色青绿风格。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { UC_SLOTS } from '@shared/ucheerModules';

export const slotLabel = (id: string) => {
  const s = UC_SLOTS.find((x) => x.id === id);
  return s ? `${s.group} · ${s.label}` : id;
};
export const kindLabel: Record<string, string> = {
  zip: 'zip / 文件', script: '数据脚本', adapter: '公开数据适配器', agent_reach: 'RSS / 网页', http: 'HTTP 接口', database: '数据库', market: '实时行情', zipscript: 'zip 功能脚本',
};
export const statusTone: Record<string, string> = {
  succeeded: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  failed: 'text-red-300 border-red-400/30 bg-red-400/10',
  running: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
  never: 'text-slate-400 border-white/10 bg-white/5',
  published: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  draft: 'text-slate-300 border-white/10 bg-white/5',
  candidate: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  waiting: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  withdrawn: 'text-red-300 border-red-400/30 bg-red-400/10',
  rejected: 'text-red-300 border-red-400/30 bg-red-400/10',
  superseded: 'text-slate-400 border-white/10 bg-white/5',
  info: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
  warning: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  critical: 'text-red-300 border-red-400/30 bg-red-400/10',
  on: 'text-teal-200 border-teal-400/30 bg-teal-400/10',
};
export const statusText: Record<string, string> = {
  succeeded: '成功', failed: '失败', running: '运行中', never: '未运行', published: '已推送', draft: '草稿', candidate: '候选', withdrawn: '已撤回',
  rejected: '已驳回', superseded: '历史版本', waiting: '等待推送', info: '提示', warning: '警告', critical: '严重',
};
export const pushModeText: Record<string, string> = { realtime: '实时推送', schedule: '定时推送', trigger: '触发推送' };
export const fmtTime = (v: string | number | Date | null | undefined) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

export function Pill({ tone, children, title }: { tone?: string; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] ${statusTone[tone ?? 'never'] ?? statusTone.never}`}>{children}</span>;
}

export function Btn({ onClick, children, tone = 'default', disabled, title, type = 'button', size = 'md' }: { onClick?: () => void; children: ReactNode; tone?: 'default' | 'primary' | 'danger' | 'ghost'; disabled?: boolean; title?: string; type?: 'button' | 'submit'; size?: 'sm' | 'md' }) {
  const cls = {
    default: 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-teal-400/40 hover:text-teal-100',
    primary: 'border-teal-400/50 bg-teal-500/20 text-teal-50 hover:bg-teal-500/30',
    danger: 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    ghost: 'border-transparent text-slate-400 hover:text-teal-200',
  }[tone];
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={`inline-flex ${size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-8 px-3 text-xs'} items-center gap-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}>{children}</button>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <label className="block text-[11px] text-slate-400"><span className="mb-1 block">{label}</span>{children}{hint && <span className="mt-0.5 block text-[10px] text-slate-600">{hint}</span>}</label>;
}

export const inputCls = 'h-8 w-full rounded-lg border border-white/10 bg-[#071012] px-2 text-xs text-slate-100 outline-none focus:border-teal-400/50';
export const smallInputCls = 'h-7 w-full rounded-md border border-white/10 bg-[#071012] px-1.5 text-[11px] text-slate-100 outline-none focus:border-teal-400/50';

export function SlotSelect({ value, onChange, className = inputCls, allowAuto = false }: { value: string; onChange: (v: string) => void; className?: string; allowAuto?: boolean }) {
  const groups = [...new Set(UC_SLOTS.map((s) => s.group))];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {allowAuto && <option value="auto">自动判断（按表名与字段放到最合适的页面）</option>}
      {groups.map((g) => <optgroup key={g} label={g}>{UC_SLOTS.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.label}（{s.paths[0]}）</option>)}</optgroup>)}
    </select>
  );
}

export function Modal({ title, onClose, children, width = 'max-w-5xl' }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${width} rounded-2xl border border-teal-500/20 bg-[#081114] p-4 shadow-2xl`}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-100">{title}</h3><button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white" aria-label="关闭"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function downloadText(fileName: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs ${disabled ? 'opacity-40' : 'cursor-pointer text-slate-300'}`}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-4 w-7 rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-3.5' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{children}</div>;
}

export function PreviewTable({ columns, rows, max = 15 }: { columns: string[]; rows: Array<Record<string, unknown>>; max?: number }) {
  return (
    <div className="max-h-60 overflow-auto rounded-lg border border-white/5">
      <table className="text-[11px]">
        <thead className="sticky top-0 bg-[#0b1719]"><tr>{columns.slice(0, 16).map((c) => <th key={c} className="whitespace-nowrap px-2 py-1 text-left font-normal text-slate-400">{c}</th>)}</tr></thead>
        <tbody>{rows.slice(0, max).map((r, i) => <tr key={i} className="border-t border-white/5">{columns.slice(0, 16).map((c) => <td key={c} className="max-w-[220px] truncate whitespace-nowrap px-2 py-1 text-slate-200">{r[c] === null || r[c] === undefined ? '—' : String(r[c])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export const INTERVALS: Array<[number, string]> = [[0, '手动'], [1, '每分钟'], [5, '每 5 分钟'], [15, '每 15 分钟'], [30, '每 30 分钟'], [60, '每小时'], [240, '每 4 小时'], [1440, '每天'], [10080, '每周']];

