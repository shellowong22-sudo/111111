/** Counts source publications in the returned sample, never estimates coverage. */
export function buildNewsActivity(rows: Array<{ publishedAt: string | null }>, at: number) {
  const now = Number.isFinite(at) && at > 0 ? at : Date.now();
  const minuteStart = Math.floor(now / 60_000) * 60_000;
  const dayStart = Date.parse(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z');
  const times = rows.map(row => row.publishedAt ? Date.parse(row.publishedAt) : NaN).filter(time => Number.isFinite(time) && time <= now);
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour: String(hour).padStart(2, '0') + ':00', count: times.filter(time => time >= dayStart + hour * 3_600_000 && time < dayStart + (hour + 1) * 3_600_000).length }));
  const minutes = Array.from({ length: 60 }, (_, index) => {
    const start = minuteStart - (59 - index) * 60_000;
    return { minute: new Date(start).toISOString().slice(11, 16), count: times.filter(time => time >= start && time < start + 60_000).length };
  });
  const today = times.filter(time => time >= dayStart);
  const minuteCounts = new Map<number, number>();
  today.forEach(time => { const bucket = Math.floor(time / 60_000); minuteCounts.set(bucket, (minuteCounts.get(bucket) ?? 0) + 1); });
  return { hourly, minutes, today: today.length, peak: Math.max(0, ...minuteCounts.values()) };
}
