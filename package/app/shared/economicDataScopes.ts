/** Existing economic tabs; these are delivery scopes, not new pages. */
export const ECONOMIC_DATA_SCOPES = [
  ['eco', '经济日历'], ['ecst', '世界经济统计数据'],
  ['ectr', '贸易流量'], ['wfii', '外国投资组合投资'],
  ['ecwb', '经济工作台'], ['rsan', '俄乌战争'],
  ['ecob', 'Economic Key Indicators'], ['ecfc', '经济预测'],
  ['shok', 'BE预测模型'], ['wirp', '利率概率'],
  ['fcon', '财务状况'], ['ecsu', '经济意外'],
  ['tayl', '泰勒规则模型'], ['ecan', '世界经济分析工具'],
  ['mosp', 'Most Active Predict Markets'], ['cenb', '央行查找'],
  ['cbrt', '央行利率分析'], ['fomc', '美联邦公开市场操作'],
  ['foms', 'FOMC 声明'], ['fdsp', '彭博经济联储分析仪'],
  ['be', '经济新闻与分析'], ['beco', '彭博经济'],
  ['bie', 'Bloomberg Eco Country Primers'], ['pmi', '标普全球PMI'],
] as const;

const aliases: Record<string, string> = { taylr: 'tayl', foec: 'fomc', 'ecst s': 'ecst' };
const menuTabs = ['ecst', 'ecst', 'ecst', 'eco', 'ectr', 'wfii', 'ecwb', 'rsan', 'ecob', 'ecfc', 'ecfc', 'shok', 'wirp', 'fcon', 'ecsu', 'tayl', 'ecan', 'mosp', 'ecsu', 'cenb', 'cenb', 'cbrt', 'fomc', 'foms', 'fdsp', 'be', 'beco', 'bie', 'pmi'];

export function economicTab(value: string) {
  const normalized = value.trim().toLowerCase();
  const tab = /^\d+$/.test(normalized) ? menuTabs[Number(normalized) - 1] : aliases[normalized] ?? normalized;
  return ECONOMIC_DATA_SCOPES.some(([id]) => id === tab) ? tab : null;
}

/** Explicit route ownership; an unknown function must never inherit a hub feed. */
export function economicModuleForPath(pathname: string, params: URLSearchParams): string | null | undefined {
  if (pathname === '/econ-hub') {
    if (!params.has('tab')) return 'econ-hub';
    const tab = economicTab(params.get('tab') ?? '');
    return tab ? `economic-${tab}` : null;
  }
  if (pathname === '/terminal' && params.get('module') === 'economics') {
    const tab = economicTab(params.get('open') ?? '');
    return tab ? `economic-${tab}` : null;
  }
  return undefined;
}

/** Only semantically matching operations have an automatic economic owner. */
export function economicModuleForOperation(apiPath: string): string | null {
  const path = apiPath.replace(/^\/api\/v\d+\//, '').toLowerCase();
  if (!/^(economy|imf_utils)\//.test(path)) return null;
  const parts = path.split('/');
  const section = parts[1];
  if (section === 'calendar') return 'economic-eco';
  if (section === 'shipping' || /trade|export|import|balance_of_payments|direction_of_trade/.test(path)) return 'economic-ectr';
  if (/forecast/.test(path)) return 'economic-ecfc';
  if (/trade|export|import|balance_of_payments/.test(section)) return 'economic-ectr';
  if (/portfolio|investment|fdi/.test(section)) return 'economic-wfii';
  if (/pmi/.test(path)) return 'economic-pmi';
  if (/fomc_documents/.test(path)) return 'economic-foms';
  if (/fomc/.test(path)) return 'economic-fomc';
  if (/interest|central_bank|policy_rate/.test(section)) return 'economic-cbrt';
  if (/financial_conditions|fcon/.test(section)) return 'economic-fcon';
  if (/survey|confidence|cli/.test(section)) return 'economic-ecob';
  if (/country_profile|dataflow|list_tables|table_choices|presentation_table/.test(path)) return 'economic-bie';
  if (/list_port_id_choices/.test(path)) return 'economic-ectr';
  if (/risk_premium|primary_dealer/.test(path)) return 'economic-fcon';
  if (/central_bank|interest_rates|fomc/.test(path)) return 'economic-cbrt';
  if (/^(gdp|cpi|unemployment|employment|inflation|pce|retail_sales|industrial_production|money_supply|fred_series|fred_search|fred_release_table|available_indicators|indicators)$/.test(section)) return 'economic-ecst';
  if (/^(money_measures|fred_regional|share_price_index|house_price_index|retail_prices|total_factor_productivity)$/.test(section)) return 'economic-ecst';
  if (section === 'composite_leading_indicator') return 'economic-ecob';
  // Unknown contracts remain unassigned until their fields have been reviewed.
  return null;
}
