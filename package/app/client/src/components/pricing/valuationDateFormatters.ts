export function formatObservationDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-CA') : '—';
}
