// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import WFIIFinancialStressView from '../client/src/components/econ/WFIIFinancialStressView';
import {EconomicDeliveryContext} from '../client/src/components/econ/EconomicDeliveryContext';
const mocks=vi.hoisted(()=>({refetch:vi.fn()}));
vi.mock('@/lib/trpc',()=>({trpc:{useUtils:()=>({legacyMarketData:{getEconomicObservations:{cancel:vi.fn(),setData:vi.fn()}},client:{legacyMarketData:{getEconomicObservations:{query:mocks.refetch.mockResolvedValue({series:[]})}}}}),legacyMarketData:{getEconomicObservations:{useQuery:()=>({data:{retrievedAt:'2025-04-01T00:00:00Z',series:[['STLFSI4','标准差','周度'],['VIXCLS','指数点','工作日']].map(([id,unit,frequency])=>({id,unit,frequency,status:'available',retrievedAt:'2025-04-01T00:00:00Z',history:Array.from({length:60},(_,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),value:id==='STLFSI4'?-1+i/100:15+i/10}))}))},isFetching:false,refetch:mocks.refetch})}}}}));
vi.mock('recharts',()=>({ResponsiveContainer:({children}:any)=><div>{children}</div>,LineChart:({children}:any)=><div>{children}</div>,CartesianGrid:()=>null,Legend:()=>null,Line:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null}));
afterEach(cleanup);
describe('WFII existing financial stress interaction',()=>{
 it('preserves six indicators, changes units/history with selection, and does not fill missing regions',async()=>{
  render(<WFIIFinancialStressView/>);
  for(const name of ['美国 FSI','欧元区 FSI','新兴市场 FSI','VIX 恐慌指数','MOVE 债券波动','美元指数 DXY'])expect(screen.getByRole('button',{name})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'VIX 恐慌指数'}));
  expect(screen.getByText('VIX 恐慌指数 · 指数点')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('压力观察窗口'),{target:{value:'10000'}});
  expect((screen.getByLabelText('压力观察窗口') as HTMLSelectElement).value).toBe('10000');
  fireEvent.click(screen.getByRole('button',{name:'欧元区 FSI'}));
  expect(screen.getByText('欧元区 FSI · 未接入')).toBeTruthy();
  expect(screen.getByRole('region',{name:'金融压力历史明细'}).querySelectorAll('tbody tr')).toHaveLength(0);
  expect(document.querySelectorAll('a[href^="http"]')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'刷新数据'}));await waitFor(()=>expect(mocks.refetch).toHaveBeenCalledWith({group:'wfii-stress',refresh:true}));
 });
 it('only acknowledges accepted visible-series delivery; another series waits until selected',()=>{
  const applied=vi.fn();
  const item=(itemKey:string,series:string,unit:string,value:number)=>({itemKey,dataset:{rows:[{series,unit,date:'2025-03-01',value}],metadata:{provider:'FRED',queriedAt:'2025-04-02T00:00:00Z'}}});
  render(<EconomicDeliveryContext.Provider value={{items:[item('fsi','STLFSI4','标准差',-0.3),item('vix','VIXCLS','指数点',18)] as any,applied}}><WFIIFinancialStressView/></EconomicDeliveryContext.Provider>);
  expect(applied).toHaveBeenLastCalledWith(['fsi']);
  fireEvent.click(screen.getByRole('button',{name:'VIX 恐慌指数'}));
  expect(applied).toHaveBeenLastCalledWith(['vix']);
 });
});
