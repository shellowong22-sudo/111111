// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FCONTab from '../client/src/components/econ/FCONTab';
import ECSUTab from '../client/src/components/econ/ECSUTab';
import FOECTab from '../client/src/components/econ/FOECTab';
import CBRTTab from '../client/src/components/econ/CBRTTab';
import FCONPanel from '../client/src/components/FCONPanel';
import CBRTPanel from '../client/src/components/CBRTPanel';
import ECSUPanel from '../client/src/components/ECSUPanel';
import TAYLTab from '../client/src/components/econ/TAYLTab';
import { ECONOMIC_GROUPS, ECONOMIC_SERIES } from '../shared/economicObservations';

vi.mock('@/lib/trpc', () => ({trpc:{useUtils:()=>({legacyMarketData:{getEconomicObservations:{cancel:vi.fn(),setData:vi.fn()}},client:{legacyMarketData:{getEconomicObservations:{query:vi.fn().mockResolvedValue({series:[]})}}}}),legacyMarketData:{getFedFinancialStatements:{useQuery:()=>({data:{reportYear:2025,retrievedAt:'2026-09-19T00:00:00Z',status:'available',rows:[{year:2025,netInterest:-12082,remittances:6281,interestIncome:155299,interestExpense:167381,remittanceAccrual:-21245},{year:2024,netInterest:-68010,remittances:3533,interestIncome:158756,interestExpense:226766,remittanceAccrual:-79104}]},isFetching:false,error:null,refetch:vi.fn()})},getTaylorInternationalRates:{useQuery:()=>({data:{rows:[{country:'欧元区',label:'存款便利利率',value:2,date:'2026-09-01',status:'available',history:[{date:'2026-09-01',value:2}]}]}})},getEconomicObservations:{useQuery:({group}:{group:keyof typeof ECONOMIC_GROUPS})=>({data:{retrievedAt:'2026-09-19T00:00:00Z',series:ECONOMIC_GROUPS[group].map(id=>({id,label:ECONOMIC_SERIES[id][0],unit:ECONOMIC_SERIES[id][1],frequency:ECONOMIC_SERIES[id][2],status:'available',sourceUrl:'https://fred.stlouisfed.org/series/'+id,history:[{date:'2024-01-01',value:2},{date:'2024-02-01',value:3}],error:null}))},isFetching:false,error:null,refetch:vi.fn()})}}}}));
vi.mock('recharts', async () => {
  const React = await import('react'); const Box=({children}:any)=>React.createElement('div',null,children);
  return {ResponsiveContainer:Box,LineChart:Box,ScatterChart:Box,CartesianGrid:()=>null,Legend:()=>null,Line:()=>null,Scatter:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null};
});
afterEach(cleanup);
describe('existing economic subfunctions',()=>{
  it('expands annual financial details in the original table without navigating or duplicating the table',()=>{
    render(<FOECTab/>);fireEvent.click(screen.getByRole('tab',{name:'联储盈亏'}));
    expect(screen.getByRole('region',{name:'联储财务状况'}).textContent).toContain('-12.082');
    expect(screen.getByRole('region',{name:'联储财务状况'}).textContent).toContain('6.281');
    expect(screen.queryByText('财政部汇缴净额（权责发生制）')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'查看详细财务报表'}));
    expect(screen.getByRole('region',{name:'联储财务状况'}).textContent).toContain('-21.245');
    expect(screen.getAllByRole('region',{name:'联储财务状况'})).toHaveLength(1);
    expect(document.querySelector('a[href^="https:"]')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'查看详细财务报表'}));
    expect(screen.queryByText('财政部汇缴净额（权责发生制）')).toBeNull();
  });
  it('opens cleaned data inside the terminal without third-party navigation',()=>{
    render(<TAYLTab/>);fireEvent.click(screen.getByText('字段、单位与观测日期'));
    fireEvent.click(screen.getByRole('button',{name:'美国实际国内生产总值'}));
    expect(screen.getByLabelText('产出缺口配对核算筛选')).toBeTruthy();
    expect(document.querySelector('a[href^="https:"]')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'收起明细'}));
    expect(screen.queryByLabelText('产出缺口配对核算筛选')).toBeNull();
  });
  it('has distinct variant, sensitivity and international data interactions',()=>{
    render(<TAYLTab/>);fireEvent.click(screen.getByRole('tab',{name:'多版本对比'}));
    fireEvent.change(screen.getByLabelText('版本下钻'),{target:{value:'鹰派'}});
    fireEvent.click(screen.getByText('展开该版本计算明细'));
    expect(screen.getByLabelText('版本计算明细筛选')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab',{name:'敏感性分析'}));expect(screen.getByRole('table',{name:'敏感性矩阵'})).toBeTruthy();
    fireEvent.click(screen.getByRole('tab',{name:'国际比较'}));
    expect(screen.getByRole('cell',{name:'欧元区'}).closest('tr')?.textContent).toContain('2');
    fireEvent.change(screen.getByLabelText('国际利率国家'),{target:{value:'欧元区'}});
    expect(screen.getByLabelText('所选国家利率历史')).toBeTruthy();
  });
  it('retains ECSU regions and scoring fields without inventing missing surveys',()=>{
    render(<ECSUPanel/>);
    expect(screen.getAllByRole('tab').map(tab=>tab.textContent)).toEqual(['当前评分','历史走势']);
    for(const region of ['美国','欧元区','中国','日本','英国']) expect(screen.getByText(region).closest('tr')?.textContent).toContain('未计算');
    fireEvent.click(screen.getByRole('tab',{name:'历史走势'}));
    fireEvent.change(screen.getByLabelText('意外指数区域'),{target:{value:'日本'}});
    expect(screen.getByText('日本：未接入可核验意外指数历史，不绘制随机曲线。')).toBeTruthy();
  });
  it('retains all terminal central bank functions and empty unsupported decision votes',()=>{
    render(<CBRTPanel/>);
    expect(screen.getAllByRole('tab').map(tab=>tab.textContent)).toEqual(['利率历史','实际利率','最新决议','利率周期']);
    fireEvent.click(screen.getByRole('tab',{name:'最新决议'}));
    const row=screen.getByText('美联储').closest('tr');
    expect(row?.textContent).toContain('—');
    expect(screen.getByText('中国人民银行')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab',{name:'利率周期'}));
    expect(screen.getByText('2004-2006加息周期').closest('tr')?.textContent).toContain('十年窗口不足');
    expect(screen.getByText('2015-2018加息周期')).toBeTruthy();
    expect(screen.getByText('2022-2023加息周期')).toBeTruthy();
  });
  it('preserves the four terminal FCON tabs and converts OAS percent to basis points',()=>{
    render(<FCONPanel/>);
    expect(screen.getAllByRole('tab').map(tab=>tab.textContent)).toEqual(['金融条件指数','信用利差','货币市场','股票估值']);
    fireEvent.click(screen.getByRole('tab',{name:'信用利差'}));
    const row=screen.getByText('IG信用利差').closest('tr');
    expect(row?.textContent).toContain('300');
    expect(row?.textContent).toContain('200');
    expect(row?.textContent).toContain('100');
    fireEvent.click(screen.getByRole('tab',{name:'货币市场'}));
    expect(screen.getByRole('region',{name:'货币市场明细'})).toBeTruthy();
    fireEvent.click(screen.getByRole('tab',{name:'股票估值'}));
    expect(screen.getByText('S&P 500 Shiller CAPE')).toBeTruthy();
    expect(screen.getAllByText('缺少可核验指数估值源')).toHaveLength(5);
    expect(document.querySelector('[data-slot="card"]')).toBeNull();
  });
  it.each([['FCON',FCONTab],['ECSU',ECSUTab],['FDSP',FOECTab],['CBRT',CBRTTab],['TAYL',TAYLTab]] as const)('%s preserves six real interactive subfunctions without KPI cards',(name,Panel)=>{
    render(<Panel/>);
    const tabs=screen.getAllByRole('tab'); expect(tabs).toHaveLength(6);
    for(const tab of tabs){fireEvent.click(tab);expect(tab.getAttribute('aria-selected')).toBe('true');expect(screen.getByRole('tabpanel').getAttribute('aria-label')).toBe(tab.textContent);}
    expect(document.querySelector('[data-slot="card"]')).toBeNull();
    expect(screen.getByRole('button',{name:'刷新数据'})).toBeTruthy();
  });
  it('does not silently give the other 18 countries an invented policy rate',()=>{
    render(<CBRTTab/>);
    expect(screen.getByText('日本')).toBeTruthy();
    const row=screen.getByText('日本').closest('tr'); expect(row?.textContent).toContain('—');
    fireEvent.click(screen.getByRole('tab',{name:'利率周期分析'}));
    fireEvent.change(screen.getByLabelText('利率周期国家'),{target:{value:'日本'}});
    expect(screen.getByText(/当前没有可用观测/)).toBeTruthy();
    expect(screen.getByRole('region',{name:'政策周期状态'}).textContent).not.toContain('美国');
  });
  it('applies the filter to the actual observation table',()=>{
    render(<ECSUTab/>);fireEvent.click(screen.getByRole('tab',{name:'库存周期分析'}));
    fireEvent.change(screen.getByLabelText('库存周期明细筛选'),{target:{value:'no-matching-period'}});
    expect(screen.getByText('无匹配的真实观察。')).toBeTruthy();
  });
  it('opens actual balance-sheet history instead of a success toast',()=>{
    render(<FOECTab/>);
    fireEvent.click(screen.getByRole('button',{name:'查看详情'}));
    expect(screen.getByLabelText('资产负债表历史明细筛选')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'查看详情'}));
    expect(screen.queryByLabelText('资产负债表历史明细筛选')).toBeNull();
  });
  it('supports keyboard movement through the existing subfunctions',()=>{
    render(<FCONTab/>); const first=screen.getByRole('tab',{name:'历史走势'});
    fireEvent.keyDown(first,{key:'ArrowRight'});
    expect(screen.getByRole('tab',{name:'分项贡献'}).getAttribute('aria-selected')).toBe('true');
  });
});
