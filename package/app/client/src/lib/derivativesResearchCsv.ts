const cell = (value: unknown) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function buildDerivativesResearchCsv(data: any, cotHistory: any[] = []) {
  const rows: unknown[][] = [
    ['研究模块', data?.title ?? ''],
    ['读取时点', data?.readAt ?? ''],
    ['数据边界', data?.boundary ?? ''],
    [],
    ['资料类型', '序列', '日期', '数值', '单位', '来源'],
  ];
  for (const series of data?.series ?? []) for (const point of series.history ?? []) rows.push(['公开时间序列', series.label, point.date, point.value, series.unit, series.source]);
  if (data?.cot) {
    rows.push([], ['CFTC 当前报告', '合约', '报告日', '未平仓量', '', data.cot.source]);
    rows.push(['CFTC 当前报告', data.cot.contract, data.cot.reportDate, data.cot.openInterest ?? '', '', data.cot.source]);
    rows.push(['CFTC 周度历史', '报告日', '报告类别', '多头', '空头', '净仓']);
    for (const snapshot of cotHistory) for (const row of snapshot.rows ?? []) rows.push(['CFTC 周度历史', snapshot.reportDate, row.category, row.long ?? '', row.short ?? '', row.net ?? '']);
  }
  return `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\r\n')}`;
}
