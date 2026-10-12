import type { EconomicPoint } from './economicObservations';

/** An empirical, trailing rank is descriptive, never a default probability. */
export function stressHistory(points: EconomicPoint[], window = 52) {
  if(!Number.isInteger(window)||window<1)throw new Error('INVALID_STRESS_WINDOW');
  const sorted = [...points].filter(p => Number.isFinite(p.value)).sort((a,b) => a.date.localeCompare(b.date));
  return sorted.map((p,i) => {
    const sample = sorted.slice(Math.max(0,i-window+1),i+1);
    const previous = sorted[i-1];
    return {...p, previous:previous?.value??null, previousDate:previous?.date??null,
      change:previous?p.value-previous.value:null, samples:sample.length,
      percentile:sample.length===window?100*sample.filter(x=>x.value<=p.value).length/sample.length:null,
      high:sample.length===window?Math.max(...sample.map(x=>x.value)):null,
      low:sample.length===window?Math.min(...sample.map(x=>x.value)):null};
  });
}
