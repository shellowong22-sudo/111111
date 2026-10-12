import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchEuroAreaStatistic, parseEurostatStatistic } from './eurostatStatistics';
const fixture = () => ({id:['geo','unit','time'],size:[1,1,3],dimension:{geo:{category:{index:{EA20:0}}},unit:{category:{index:{RCH_A:0}}},time:{category:{index:{'2026-06':0,'2026-07':1,'2026-08':2}}}},value:{0:2.1,1:null,2:2.2}});
describe('Euro area statistics', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('selects one explicitly matched region and unit and preserves missing periods', () => {
    expect(parseEurostatStatistic(fixture(),{geo:'EA20',unit:'RCH_A'},240)).toEqual([{date:'2026-06',value:2.1},{date:'2026-08',value:2.2}]);
  });
  it('rejects EU27 instead of relabelling it as euro area', () => {
    expect(() => parseEurostatStatistic(fixture(),{geo:'EU27_2020'},240)).toThrow('STATISTIC_DIMENSION_MISMATCH');
    expect(() => parseEurostatStatistic({...fixture(),size:[2,1,3]},{geo:'EA20'},240)).toThrow('AMBIGUOUS_STATISTIC_DIMENSIONS');
  });
  it('does not interpret upstream error objects as data on HTTP 200', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{status:400}}))));
    expect(await fetchEuroAreaStatistic('hicp')).toMatchObject({available:false,history:[]});
  });
  it('returns an empty series when the official response has a zero-sized dimension', () => {
    expect(parseEurostatStatistic({...fixture(),size:[1,1,0]},{geo:'EA20'},240)).toEqual([]);
  });
  it('accepts exact quarterly periods without treating them as monthly observations', () => {
    const quarterly = {...fixture(), dimension: {...fixture().dimension, time:{category:{index:{'2025-Q4':0,'2026-Q1':1,'2026-Q2':2}}}}, value:{0:0.3,1:0.6,2:0.1}};
    expect(parseEurostatStatistic(quarterly,{geo:'EA20',unit:'RCH_A'},240)).toEqual([{date:'2025-Q4',value:0.3},{date:'2026-Q1',value:0.6},{date:'2026-Q2',value:0.1}]);
  });
  it('requests the EA21 seasonally and calendar adjusted GDP quarter-on-quarter contract', async () => {
    const payload = {id:['freq','unit','s_adj','na_item','geo','time'],size:[1,1,1,1,1,2],dimension:{freq:{category:{index:{Q:0}}},unit:{category:{index:{CLV_PCH_PRE:0}}},s_adj:{category:{index:{SCA:0}}},na_item:{category:{index:{B1GQ:0}}},geo:{category:{index:{EA21:0}}},time:{category:{index:{'2026-Q1':0,'2026-Q2':1}}}},value:{0:0.6,1:0.1}};
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchEuroAreaStatistic('gdp');
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/namq_10_gdp?');
    for (const pair of ['freq=Q','unit=CLV_PCH_PRE','s_adj=SCA','na_item=B1GQ','geo=EA21']) expect(url).toContain(pair);
    expect(result).toMatchObject({available:true,symbol:'EA21:GDP_QOQ_SCA',observedAt:'2026-Q2'});
    expect(result.history).toEqual([{date:'2026-Q1',value:0.6},{date:'2026-Q2',value:0.1}]);
  });
});
