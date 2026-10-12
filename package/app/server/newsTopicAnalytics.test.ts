import { describe, expect, it } from 'vitest';
import { analyzeNewsSources, analyzeNewsTopics, type TopicNewsRow } from '../shared/newsTopicAnalytics';
const now = Date.parse('2026-09-19T12:00:00Z');
const row = (key: string, title: string, date: string | null, institution = 'Bank A'): TopicNewsRow => ({ key, title, summary: '', publishedAt: date, institution, url: `https://example.test/${key}` });
describe('news observations, not generated scores', () => {
  it('deduplicates source URLs and excludes missing, future and out-of-window publications', () => {
    const record = row('one', 'Monetary policy and inflation', '2026-09-19T10:00:00Z');
    const data = analyzeNewsTopics([record, {...record,key:'duplicate'},row('future','inflation','2026-09-20T00:00:00Z'),row('old','inflation','2025-09-19T00:00:00Z'),row('unknown','inflation',null)], now);
    expect(data.rows).toHaveLength(1);
    expect(data.excluded).toBe(3);
    expect(data.topics[0].rows).toHaveLength(1);
    expect(data.matrix[0][1]).toBe(1);
    expect(data.daily.at(-1)).toMatchObject({day:'2026-09-19',policy:1,prices:1});
  });
  it('compares consecutive seven UTC day windows and does not fabricate percentages for a zero denominator', () => {
    const data = analyzeNewsSources([row('a','policy','2026-09-19T01:00:00Z'),row('b','policy','2026-09-13T00:00:00Z'),row('c','policy','2026-09-12T23:59:59Z'),row('d','policy','2026-09-18T00:00:00Z','Bank B')],now);
    expect(data.sources[0]).toMatchObject({institution:'Bank A',current:2,previous:1,delta:1,change:100});
    expect(data.sources[1]).toMatchObject({institution:'Bank B',current:1,previous:0,change:null});
    expect(data.daily.reduce((sum,d)=>sum+d.count,0)).toBe(4);
  });
  it('never infers sentiment or ticker performance and accounts for unmatched source text', () => {
    const data = analyzeNewsTopics([row('a','Office opening times','2026-09-18T00:00:00Z')],now);
    expect(data.unmatched).toBe(1);
    expect(data.topics.every(topic=>topic.rows.length===0)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/sentiment|price_move|heat_now/);
  });
});
