import { curveDataPoints } from '../drizzle/schema';
import { getDb } from './db';

async function main() {
  const db = await getDb();
  if (!db) { console.error('No DB'); process.exit(1); }
  
  const data = [
    {curveId: 1, dataDate: '2026-06-20', period: '3M', value: '5.28'},
    {curveId: 1, dataDate: '2026-06-20', period: '2Y', value: '4.85'},
    {curveId: 1, dataDate: '2026-06-20', period: '5Y', value: '4.55'},
    {curveId: 1, dataDate: '2026-06-20', period: '10Y', value: '4.35'},
    {curveId: 1, dataDate: '2026-06-20', period: '30Y', value: '4.52'},
    {curveId: 2, dataDate: '2026-06-20', period: '3M', value: '5.28'},
    {curveId: 2, dataDate: '2026-06-20', period: '2Y', value: '4.85'},
    {curveId: 2, dataDate: '2026-06-20', period: '10Y', value: '4.35'},
    {curveId: 3, dataDate: '2026-06-20', period: '2Y', value: '4.85'},
    {curveId: 3, dataDate: '2026-06-20', period: '5Y', value: '4.55'},
    {curveId: 3, dataDate: '2026-06-20', period: '10Y', value: '4.35'},
    {curveId: 3, dataDate: '2026-06-20', period: '30Y', value: '4.52'},
    {curveId: 5, dataDate: '2026-06-20', period: '2Y', value: '4.65'},
    {curveId: 5, dataDate: '2026-06-20', period: '5Y', value: '4.38'},
    {curveId: 5, dataDate: '2026-06-20', period: '10Y', value: '4.22'},
    {curveId: 7, dataDate: '2026-06-20', period: '2Y', value: '2.95'},
    {curveId: 7, dataDate: '2026-06-20', period: '10Y', value: '2.85'},
    {curveId: 9, dataDate: '2026-06-20', period: '2Y', value: '0.12'},
    {curveId: 9, dataDate: '2026-06-20', period: '10Y', value: '1.05'},
  ];
  
  for (const d of data) {
    try {
      await db.insert(curveDataPoints).values(d).onDuplicateKeyUpdate({set: {value: d.value}});
    } catch(e: any) {
      console.log('Insert error:', e.message);
    }
  }
  console.log('Curve data inserted:', data.length, 'rows');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
