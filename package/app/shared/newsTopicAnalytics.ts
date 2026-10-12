export type TopicNewsRow = { key: string; title: string; summary: string; publishedAt: string | null; institution: string; url: string };
export const NEWS_TOPICS = [
  { id: 'policy', label: '货币政策', pattern: /\b(monetary|interest rate|policy rate|central bank)\b|金融政策|金利/i },
  { id: 'prices', label: '通胀物价', pattern: /\b(inflation|prices|consumer price)\b|物価|通胀/i },
  { id: 'activity', label: '经济活动', pattern: /\b(growth|gdp|employment|labour|labor|economic activity)\b|雇用|経済/i },
  { id: 'stability', label: '金融稳定', pattern: /\b(stability|banking|capital|liquidity|risk)\b|金融システム/i },
  { id: 'payments', label: '支付与技术', pattern: /\b(payment|digital|technology|innovation|cyber)\b|決済/i },
] as const;
const DAY = 86_400_000;
export function analyzeNewsTopics<T extends TopicNewsRow>(input: T[], nowMs: number, windowDays = 14) {
  const seen = new Set<string>();
  const rows = input.filter(row => { const identity = row.url || row.key; if (seen.has(identity)) return false; seen.add(identity); return true; });
  const dayStart = Math.floor(nowMs / DAY) * DAY;
  const dated = rows.filter(row => { const date = Date.parse(row.publishedAt ?? ''); return Number.isFinite(date) && date <= nowMs && date >= dayStart - (windowDays - 1) * DAY; });
  const matches = (row: TopicNewsRow, pattern: RegExp) => pattern.test(row.title + ' ' + row.summary);
  const topics = NEWS_TOPICS.map(topic => ({ id: topic.id, label: topic.label, rows: dated.filter(row => matches(row, topic.pattern)) }));
  const daily = Array.from({ length: windowDays }, (_, index) => {
    const day = new Date(dayStart - (windowDays - 1 - index) * DAY).toISOString().slice(0, 10);
    const counts: Record<string, string | number> = { day };
    for (const topic of topics) counts[topic.id] = topic.rows.filter(row => row.publishedAt!.slice(0, 10) === day).length;
    return counts;
  });
  const matrix = topics.map(left => topics.map(right => { const ids = new Set(right.rows.map(row => row.key)); return left.rows.filter(row => ids.has(row.key)).length; }));
  const unmatched = dated.filter(row => !NEWS_TOPICS.some(topic => matches(row, topic.pattern))).length;
  return { rows: dated, topics, daily, matrix, unmatched, excluded: rows.length - dated.length };
}
export function analyzeNewsSources(input: TopicNewsRow[], nowMs: number) {
  const analytics = analyzeNewsTopics(input, nowMs, 14);
  const boundary = Math.floor(nowMs / DAY) * DAY - 6 * DAY;
  const institutions = [...new Set(analytics.rows.map(row => row.institution))].sort();
  const sources = institutions.map(institution => {
    const rows = analytics.rows.filter(row => row.institution === institution);
    const current = rows.filter(row => Date.parse(row.publishedAt!) >= boundary).length;
    const previous = rows.length - current;
    return { institution, current, previous, delta: current - previous, change: previous ? (current - previous) / previous * 100 : null, latest: rows.map(row => row.publishedAt!).sort().at(-1)! };
  }).sort((a, b) => b.current - a.current || a.institution.localeCompare(b.institution));
  const daily = analytics.daily.map(day => ({ day: day.day, count: analytics.rows.filter(row => row.publishedAt!.slice(0, 10) === day.day).length }));
  return { sources, daily, excluded: analytics.excluded, total: analytics.rows.length };
}
