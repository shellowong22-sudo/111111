// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {WorldBankExistingView} from '../client/src/components/econ/WorldBankExistingViews';
import {WORLD_BANK_CONTRACTS} from '../shared/worldBankContracts';
import {EconomicDeliveryContext} from '../client/src/components/econ/EconomicDeliveryContext';
const refreshMocks=vi.hoisted(()=>({query:vi.fn(),cancel:vi.fn(),setData:vi.fn()}));
vi.mock('@/lib/trpc',()=>({trpc:{useUtils:()=>({client:{legacyMarketData:{getWorldBankPanel:{query:refreshMocks.query}}},legacyMarketData:{getWorldBankPanel:{cancel:refreshMocks.cancel,setData:refreshMocks.setData}}}),legacyMarketData:{getWorldBankPanel:{useQuery:({group}:any)=>({data:{retrievedAt:'2026-09-19',series:WORLD_BANK_CONTRACTS.filter(c=>c.primaryModuleId===`economic-${group}`).map(c=>({...c,status:'available',error:null,rows:[{date:'2024-01-01',country:'United States',country_code:'USA',indicator:c.indicator,value:100e9,unit:'美元',source_updated:'2026-01-01'},{date:'2025-01-01',country:'United States',country_code:'USA',indicator:c.indicator,value:120e9,unit:'美元',source_updated:'2026-01-01'},{date:'2025-01-01',country:'China',country_code:'CHN',indicator:c.indicator,value:150e9,unit:'美元',source_updated:'2026-01-01'}]}))},isFetching:false,refetch:vi.fn()})}}}}));
vi.mock('recharts',()=>({ResponsiveContainer:({children}:any)=><div>{children}</div>,LineChart:({children}:any)=><div>{children}</div>,BarChart:({children}:any)=><div>{children}</div>,Bar:()=>null,CartesianGrid:()=>null,Legend:()=>null,Line:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null}));
afterEach(cleanup);
describe('original World Bank tab bodies',()=>{
 it('the existing refresh control requests fresh observations and updates the original cache key',async()=>{
  refreshMocks.query.mockResolvedValueOnce({retrievedAt:'2026-09-19T05:00:00Z',series:[]});
  render(<WorldBankExistingView mode="flows"/>);
  fireEvent.click(screen.getByRole('button',{name:'刷新数据'}));
  await waitFor(()=>expect(refreshMocks.query).toHaveBeenCalledWith({group:'wfii',refresh:true}));
  await waitFor(()=>expect(refreshMocks.setData).toHaveBeenCalledWith({group:'wfii'},expect.anything()));
  expect(refreshMocks.cancel).toHaveBeenCalledWith({group:'wfii'});
 });
 it('shows refresh failure without losing the existing country data',async()=>{
  refreshMocks.query.mockRejectedValueOnce(new Error('offline'));
  render(<WorldBankExistingView mode="fdi"/>);
  fireEvent.click(screen.getByRole('button',{name:'刷新数据'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','刷新失败，保留已有数据，请重试。');
  expect(screen.getAllByRole('row')[1].textContent).toContain('China');
 });
 it('retains the last valid series when an individual provider request fails',async()=>{
  const contract=WORLD_BANK_CONTRACTS.find(c=>c.primaryModuleId==='economic-wfii')!;
  refreshMocks.query.mockResolvedValueOnce({retrievedAt:'',series:[{...contract,status:'unavailable',error:'offline',rows:[],retrievedAt:null}]});
  render(<WorldBankExistingView mode="flows"/>);
  fireEvent.click(screen.getByRole('button',{name:'刷新数据'}));
  await screen.findByRole('alert');
  const update=refreshMocks.setData.mock.calls.at(-1)![1];
  const previous={series:[{...contract,status:'available',error:null,rows:[{value:123}],retrievedAt:'2026-09-19T00:00:00Z'}]};
  expect(update(previous).series[0]).toEqual({...previous.series[0],status:'unavailable',error:'offline'});
 });
 it('acknowledges data actually reconciled into the existing view, not an unmatched payload',()=>{
  const applied=vi.fn();
  const base={date:'2025-01-01',country:'United States',country_code:'USA',indicator:'BX.KLT.DINV.CD.WD',value:120e9,unit:'美元',source_updated:'2026-01-01'};
  const item=(key:string,value:number,queriedAt='2026-01-01')=>({itemKey:key,title:'FDI',body:'',topic:'',category:'',sourceKind:'observation' as const,dataset:{label:'FDI',columns:Object.keys(base),rows:[{...base,value}],metadata:{provider:'World Bank',queriedAt}}});
  render(<EconomicDeliveryContext.Provider value={{items:[item('matching',120e9,'2026-09-19T01:00:00Z'),item('stale-same',120e9),item('stale-different',90e9)] as any,applied}}><WorldBankExistingView mode="flows"/></EconomicDeliveryContext.Provider>);
  expect(applied).toHaveBeenCalledWith(['matching']);
  expect(screen.queryByText('后台定向内容')).toBeNull();
 });
 it('FDI ranks numerically and country selection filters the existing table',()=>{
  render(<WorldBankExistingView mode="fdi"/>);
  const dataRows=screen.getAllByRole('row').slice(1);
  expect(dataRows[0].textContent).toContain('China');expect(dataRows[1].textContent).toContain('United States');
  fireEvent.change(screen.getByLabelText('国际数据国家'),{target:{value:'USA'}});
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getAllByRole('row')[1].textContent).toContain('120');
  expect(screen.getAllByRole('row')[1].textContent).toContain('20');
  expect(document.querySelector('[data-slot="card"]')).toBeNull();
 });
 it('keeps trade and capital-flow fields different; changing years never fills absent observations',()=>{
  const view=render(<WorldBankExistingView mode="balance"/>);
  expect(screen.getByRole('button',{name:'出口($B)'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'FDI流入($B)'})).toBeNull();
  fireEvent.change(screen.getByLabelText('国际数据年度'),{target:{value:'2024'}});
  fireEvent.change(screen.getByLabelText('国家年度贸易比较筛选'),{target:{value:'China'}});
  expect(screen.getAllByRole('row')[1].textContent).toBe('China2024———————');
  view.unmount();render(<WorldBankExistingView mode="flows"/>);
  expect(screen.getByRole('button',{name:'证券投资净额($B)'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'出口($B)'})).toBeNull();
 });
});
