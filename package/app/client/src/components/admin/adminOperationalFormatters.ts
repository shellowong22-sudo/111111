export function formatOperationalMetricNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('zh-CN').format(value)
    : '—';
}
