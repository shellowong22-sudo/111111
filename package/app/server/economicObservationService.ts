import { ECONOMIC_GROUPS, ECONOMIC_SERIES, type EconomicGroup, type EconomicPoint, type EconomicSeries, type EconomicSeriesId } from '../shared/economicObservations';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {replaceFileWithRetry} from './atomicFileReplace';

export function observationChanges(previous:EconomicPoint[],current:EconomicPoint[]){
 const before=new Map(previous.map(p=>[p.date,p.value]));
 const after=new Map(current.map(p=>[p.date,p.value]));
 return [...new Set([...before.keys(),...after.keys()])].sort().filter(date=>before.get(date)!==after.get(date)).map(date=>({date,before:before.get(date)??null,after:after.get(date)??null}));
}
export async function archiveSeries(series:EconomicSeries,dir=path.join(process.cwd(),'.runtime','economic-observations')):Promise<EconomicSeries>{
 await mkdir(dir,{recursive:true});const file=path.join(dir,series.id+'.json');
 let previous:EconomicSeries|null=null;
 try{previous=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(previous?.history))throw new Error('INVALID_OBSERVATION_ARCHIVE');}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 series={...series,history:[...series.history].sort((a,b)=>a.date.localeCompare(b.date))};
 const checksum=createHash('sha256').update(JSON.stringify(series.history)).digest('hex');
 const updateState=previous?.checksum===checksum?'unchanged':previous?'changed':'initial';
 const enriched: EconomicSeries={...series,checksum,updateState,changedAt:updateState==='unchanged'?previous!.changedAt:series.retrievedAt,changes:previous?observationChanges(previous.history,series.history):[]};
 // Keep immutable content versions as well as the latest snapshot, so revisions remain auditable.
 const versions=path.join(dir,series.id);await mkdir(versions,{recursive:true});
 try{await writeFile(path.join(versions,checksum+'.json'),JSON.stringify(enriched),{encoding:'utf8',flag:'wx'});}
 catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
 const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(enriched),'utf8');await replaceFileWithRetry(tmp,file);return enriched;
}

export function parseEconomicCsv(csv: string, id: string): EconomicPoint[] {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const headers = (lines.shift() ?? '').split(',').map(value => value.replace(/^"|"$/g, '').trim());
  const index = headers.indexOf(id);
  if (index < 1 || !['DATE', 'observation_date'].includes(headers[0])) throw new Error('SOURCE_SCHEMA_MISMATCH');
  const unique = new Map<string, number>();
  for (const line of lines) {
    const fields = line.split(',').map(value => value.replace(/^"|"$/g, '').trim());
    const date = fields[0]; const raw = fields[index];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !raw || raw === '.' || !Number.isFinite(Number(raw))) continue;
    if (date > new Date().toISOString().slice(0, 10)) continue;
    unique.set(date, Number(raw));
  }
  return [...unique].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

/** Parse the New York Fed GSCPI vintage matrix into one auditable observation series.
 * The file contains one row per observation month and one column per release vintage.
 * We select the newest vintage released no later than the current month and ignore
 * future observations, #N/A cells, and malformed dates instead of forward filling.
 */
export function parseGscpiCsv(csv: string, now = new Date()): { points: EconomicPoint[]; vintage: string } {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const parseLine = (line: string) => {
    const out: string[] = []; let value = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; continue; }
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === ',' && !quoted) { out.push(value.trim()); value = ''; continue; }
      value += ch;
    }
    out.push(value.trim()); return out;
  };
  const headers = parseLine(lines.shift() ?? '');
  if (headers[0] !== 'Date') throw new Error('GSCPI_SCHEMA_MISMATCH');
  const parseVintage = (text: string) => {
    const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/.exec(text);
    if (!match) return null;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return { key: text, year: 2000 + Number(match[2]), month: months.indexOf(match[1]) + 1 };
  };
  const vintages = headers.slice(1).map(parseVintage).filter((v): v is { key: string; year: number; month: number } => Boolean(v));
  const currentKey = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
  const usable = vintages.filter(v => v.year * 100 + v.month <= currentKey).sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));
  const selected = usable.at(-1);
  if (!selected) throw new Error('GSCPI_NO_CURRENT_VINTAGE');
  const valueIndex = headers.indexOf(selected.key);
  if (headers.filter(header => header === selected.key).length !== 1) throw new Error('GSCPI_DUPLICATE_VINTAGE');
  const points: EconomicPoint[] = [];
  const seen = new Map<string, number>();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (const line of lines) {
    const fields = parseLine(line); const rawDate = fields[0] ?? '';
    const match = /^(\d{1,2})-([A-Z][a-z]{2})-(\d{4})$/.exec(rawDate);
    if (!match || !months.includes(match[2])) continue;
    const year = Number(match[3]); const month = months.indexOf(match[2]); const day = Number(match[1]);
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) continue;
    const iso = date.toISOString().slice(0, 10);
    if (iso > now.toISOString().slice(0, 10)) continue;
    // A vintage represents the preceding month's observations, not a forecast.
    if (year * 100 + month + 1 >= selected.year * 100 + selected.month) continue;
    const raw = fields[valueIndex]; const value = Number(raw);
    if (!raw || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(value)) continue;
    const monthKey = iso.slice(0, 7);
    if (seen.has(monthKey)) {
      if (seen.get(monthKey) !== value) throw new Error('GSCPI_CONFLICTING_OBSERVATION');
      continue;
    }
    seen.set(monthKey, value);
    points.push({ date: iso, value });
  }
  const unique = new Map(points.map(point => [point.date, point]));
  return { points: [...unique.values()].sort((a, b) => a.date.localeCompare(b.date)), vintage: selected.key };
}
const cache = new Map<EconomicSeriesId, { at: number; series: EconomicSeries }>();
const pending = new Map<EconomicSeriesId, Promise<EconomicSeries>>();
const ttl = 5 * 60_000;
async function recoverArchivedSeries(id: EconomicSeriesId): Promise<EconomicSeries | null> {
  try {
    const archived: EconomicSeries = JSON.parse(await readFile(path.join(process.cwd(), '.runtime', 'economic-observations', id + '.json'), 'utf8'));
    const [label, unit, frequency] = ECONOMIC_SERIES[id];
    if (archived.id !== id || archived.unit !== unit || archived.frequency !== frequency || archived.status !== 'available' ||
        !Number.isFinite(Date.parse(archived.retrievedAt)) || Date.parse(archived.retrievedAt) > Date.now() ||
        !Array.isArray(archived.history) || !archived.history.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (archived.history.some((p, index, all) => !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
        !Number.isFinite(Date.parse(p.date)) || new Date(p.date).toISOString().slice(0,10) !== p.date ||
        p.date > today || typeof p.value !== 'number' || !Number.isFinite(p.value) || (index > 0 && all[index - 1].date >= p.date))) return null;
    if (createHash('sha256').update(JSON.stringify(archived.history)).digest('hex') !== archived.checksum) return null;
    const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 10);
    const history = id === 'GSCPI' ? archived.history : archived.history.filter(p => p.date >= cutoff.toISOString().slice(0, 10));
    return history.length ? { ...archived, label, history } : null;
  } catch { return null; }
}
export async function getEconomicSeries(id: EconomicSeriesId, refresh = false): Promise<EconomicSeries> {
  const cached = cache.get(id);
  const inFlight = pending.get(id);
  if (inFlight) return inFlight;
  if (cached && Date.now() - cached.at < (refresh ? 5000 : cached.series.status === 'available' ? ttl : 30_000)) return cached.series;
  const [label, unit, frequency] = ECONOMIC_SERIES[id];
  const task = (async (): Promise<EconomicSeries> => {
    const isGscpi = id === 'GSCPI';
    const sourceUrl = 'https://www.newyorkfed.org/medialibrary/research/interactives/data/gscpi/gscpi_interactive_data.csv';
    const base = { id, label, unit, frequency, sourceUrl: isGscpi ? sourceUrl : `https://fred.stlouisfed.org/series/${id}`, retrievedAt: new Date().toISOString() };
    try {
      const response = await fetch(isGscpi ? sourceUrl : `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
      const payload = await response.text();
      const parsed = isGscpi ? parseGscpiCsv(payload) : { points: parseEconomicCsv(payload, id), vintage: null };
      const points = parsed.points;
      if (!points.length) throw new Error('SOURCE_EMPTY');
      // Retain ten years for all frequencies; never disguise a transport cap as full history.
      const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 10);
      const history = isGscpi ? points : points.filter(point => point.date >= cutoff.toISOString().slice(0, 10));
      if (!history.length) throw new Error('SOURCE_NO_RECENT_OBSERVATIONS');
      // Fingerprint the complete source, not the sliding display window: a day rolling
      // out of the ten-year chart is not an upstream revision.
      const archived=await archiveSeries({ ...base, history:points, status: 'available', error: null, metadata: isGscpi ? { vintage: parsed.vintage, rawSha256: createHash('sha256').update(payload).digest('hex') } : undefined });
      return {...archived,history};
    } catch (error) {
      // A failed check must not erase the last valid observations or relabel
      // their acquisition time. Keep the failure explicit for all consumers.
      const retained = cached?.series.history.length ? cached.series : await recoverArchivedSeries(id);
      return { ...(retained ?? { ...base, history: [] }), status: 'unavailable', error: error instanceof Error ? error.message : 'SOURCE_UNAVAILABLE' };
    }
  })();
  pending.set(id, task);
  try { const series = await task; cache.set(id, { at: Date.now(), series }); return series; }
  finally { pending.delete(id); }
}
export async function getEconomicObservations(group: EconomicGroup, refresh = false) {
  const series: EconomicSeries[] = [];
  // Bounded upstream concurrency; duplicate browser requests share in-flight reads.
  const ids = ECONOMIC_GROUPS[group];
  for (let index = 0; index < ids.length; index += 4) series.push(...await Promise.all(ids.slice(index, index + 4).map(id => getEconomicSeries(id, refresh))));
  // Do not relabel a cache hit as a new upstream check.
  return { retrievedAt: series.map(s=>s.retrievedAt).sort()[0]??new Date().toISOString(), series };
}
