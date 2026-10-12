/** Human-readable exchange product names; the code remains the stable observation identity. */
export function taiwanDerivativeUnderlying(code: string) {
  const normalized = code.toUpperCase();
  if (normalized === 'TX' || normalized === 'TXO') return '台湾加权股价指数';
  return '标的名称待核验';
}

/** Display older archived records without changing their permanent ledger identity. */
export function displayTaiwanDerivativeUnderlyingName(value: string) {
  return value.replaceAll('（非个股）', '');
}

export function taiwanDerivativeProduct(code: string) {
  const normalized = code.toUpperCase();
  if (normalized === 'TX') return '台股指数期货';
  if (normalized === 'TXO') return '台股指数选择权';
  return '合约名称待核验';
}

export function formatTaiwanContractMonth(value: string): string {
  const match = value.match(/^(\d{4})(0[1-9]|1[0-2])(W[1-5])?$/i);
  if (match) return `${match[1]}年${Number(match[2])}月${match[3] ? `第${match[3].slice(1)}周` : ''}`;
  if (value.includes('/')) return value.split('/').map(formatTaiwanContractMonth).join(' / ');
  return value || '到期月份未提供';
}

export function taiwanFuturesContractName(code: string, month: string) {
  const product = taiwanDerivativeProduct(code);
  return month.includes('/')
    ? `${product}跨月价差 ${formatTaiwanContractMonth(month)}`
    : `${product} ${formatTaiwanContractMonth(month)}`;
}

export function taiwanOptionContractName(code: string, month: string, strike: number | null, right: string) {
  const option = right.toUpperCase();
  const rightLabel = option === 'PUT' || option === 'P' ? '卖权' : option === 'CALL' || option === 'C' ? '买权' : '权别未提供';
  return `${taiwanDerivativeProduct(code)} ${formatTaiwanContractMonth(month)} ${strike === null ? '履约价未提供' : `${strike.toLocaleString('zh-CN')}点`} ${rightLabel}`;
}

export function taiwanTradingSession(value: string) {
  if (value === 'after_market') return '盘后交易';
  if (value === 'position') return 'POSITION（时段待核验）';
  return value || '时段未提供';
}
