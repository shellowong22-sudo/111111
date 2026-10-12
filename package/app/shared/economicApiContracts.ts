import { ECONOMIC_GROUPS, ECONOMIC_SERIES, type EconomicGroup, type EconomicSeriesId } from './economicObservations';

// Every observation has one distribution owner. Shared inputs can be read by
// existing analytical functions without replicating the same published table.
const ownerGroups = ['tayl','fcon','ecsu','fdsp','cbrt','fcon-market','wfii-fx','wfii-stress'] as const;
export const ECONOMIC_API_CONTRACTS = [...new Set(ownerGroups.flatMap(group => [...ECONOMIC_GROUPS[group]]))].map(id => {
  const owner = ownerGroups.find(group => (ECONOMIC_GROUPS[group] as readonly string[]).includes(id))!;
  const group = owner === 'fcon-market' ? 'fcon' : owner === 'wfii-fx' || owner === 'wfii-stress' ? 'wfii' : owner;
  return {
    id: id === 'GSCPI' ? 'official_nyfed_GSCPI' : `official_fred_${id}`, seriesId: id as EconomicSeriesId,
    label: ECONOMIC_SERIES[id][0], unit: ECONOMIC_SERIES[id][1], frequency: ECONOMIC_SERIES[id][2],
    provider: id === 'GSCPI' ? 'New York Fed' : 'FRED', sourceUrl: id === 'GSCPI' ? 'https://www.newyorkfed.org/medialibrary/research/interactives/data/gscpi/gscpi_interactive_data.csv' : `https://fred.stlouisfed.org/series/${id}`,
    endpoint: id === 'GSCPI' ? 'https://www.newyorkfed.org/medialibrary/research/interactives/data/gscpi/gscpi_interactive_data.csv' : `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
    primaryModuleId: `economic-${group}`, path: `/econ-hub?tab=${group}`,
    consumerGroups: ownerGroups.filter(g => (ECONOMIC_GROUPS[g] as readonly string[]).includes(id)) as EconomicGroup[],
  };
});

export function economicApiContract(id: string) { return ECONOMIC_API_CONTRACTS.find(contract => contract.id === id); }
