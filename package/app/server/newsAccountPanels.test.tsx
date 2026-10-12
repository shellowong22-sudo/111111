// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NLRTPanel from '../client/src/components/news/NLRTPanel';
import NSUBPanel from '../client/src/components/news/NSUBPanel';

const state = vi.hoisted(() => ({ mutate: vi.fn(), refetch: vi.fn(), fail: false }));
vi.mock('@/lib/trpc', () => ({ trpc: { newsResearch: {
  listSourceFreshnessRules: {useQuery: () => ({data:[{id:3,sourceKind:'fed_monetary',thresholdHours:48,isActive:false}],isError:false,refetch:state.refetch})},
  listSourceFreshnessEvents: {useQuery: () => ({data:[],refetch:vi.fn()})},
  saveSourceFreshnessRule: {useMutation:(options:any) => ({mutate:(input:any)=>{state.mutate(input);if(!state.fail)void options.onSuccess();},isPending:false,error:state.fail?new Error('DATABASE_UNAVAILABLE'):null})},
  listEvidence: {useQuery:()=>({data:[{id:1,sourceKind:'sec_press',status:'verified'}],refetch:vi.fn()})},
} } }));
describe('account-backed news workspaces', () => {
  afterEach(()=>{cleanup();state.mutate.mockClear();state.refetch.mockClear();state.fail=false;});
  it('loads an existing rule and sends edited values to the database API before reporting success', async () => {
    render(<NLRTPanel/>);
    fireEvent.click(screen.getByRole('button',{name:'编辑'}));
    expect((screen.getByLabelText('提醒来源') as HTMLSelectElement).value).toBe('fed_monetary');
    expect((screen.getByLabelText('时效阈值小时') as HTMLInputElement).value).toBe('48');
    fireEvent.change(screen.getByLabelText('时效阈值小时'),{target:{value:'96'}});
    fireEvent.click(screen.getByRole('button',{name:'保存规则'}));
    expect(state.mutate).toHaveBeenCalledWith({sourceKind:'fed_monetary',thresholdHours:96,isActive:false});
    await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('规则已保存到当前账户'));
    expect(state.refetch).toHaveBeenCalled();
  });
  it('does not report success on a failed save or permit invalid threshold values', () => {
    state.fail=true;render(<NLRTPanel/>);
    expect(screen.getByRole('alert').textContent).toContain('DATABASE_UNAVAILABLE');
    expect(screen.queryByText(/规则已保存到当前账户/)).toBeNull();
    fireEvent.change(screen.getByLabelText('时效阈值小时'),{target:{value:'1'}});
    expect((screen.getByRole('button',{name:'保存规则'}) as HTMLButtonElement).disabled).toBe(true);
  });
  it('does not claim premium subscriptions or fabricated reading counts from actual research records', () => {
    render(<NSUBPanel/>);
    expect(screen.getByText(/当前账户真实研究记录/).textContent).toContain('1');
    expect(screen.getByText(/尚未接入当前账户的付费新闻订阅权益/)).toBeTruthy();
    expect(screen.queryByText('PRO')).toBeNull();
    expect(screen.queryByText(/72%/)).toBeNull();
  });
});
