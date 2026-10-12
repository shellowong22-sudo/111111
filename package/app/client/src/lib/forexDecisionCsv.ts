type Point = { dayOffset: number; date: string; value: number; base100: number };
type DecisionRow = { decisionDate: string; centralBankId: string; centralBankName: string; decision: string; policyRatePct: number | null; changeBps: number | null; before: { date: string; value: number } | null; after: { date: string; value: number } | null; changePct: number | null; relativeWindow: Point[] };

function cell(value: unknown) { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

export function buildAudDecisionComparisonCsv(data: { reading?: { id?: string; label?: string; unit?: string } | null; boundary?: string; rows?: DecisionRow[] }) {
  const header = ['币种', '决议日期', '机构代码', '机构', '政策行动', '政策利率(%)', '变化(bp)', '决议前最近观察日', '决议前读数', '决议后最近观察日', '决议后读数', '窗口读数变化(%)', '相对决议日', '观察日期', '实际读数', '归一化读数(决议前=100)', '汇率序列', '序列单位', '数据来源', '数据边界'];
  const rows = (data.rows ?? []).flatMap((decision) => decision.relativeWindow.map((point) => ['AUD', decision.decisionDate, decision.centralBankId, decision.centralBankName, decision.decision, decision.policyRatePct, decision.changeBps, decision.before?.date, decision.before?.value, decision.after?.date, decision.after?.value, decision.changePct, point.dayOffset, point.date, point.value, point.base100, data.reading?.id ?? '', data.reading?.unit ?? '', 'FRED / 美联储 H.10', data.boundary ?? '']));
  return `\ufeff${[header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}`;
}
