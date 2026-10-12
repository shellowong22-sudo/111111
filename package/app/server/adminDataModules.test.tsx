// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminDataModules from '../client/src/pages/admin/AdminDataModules';

const mocks = vi.hoisted(() => ({ update: vi.fn(), updateRuntime: vi.fn(), refresh: vi.fn(), invalidate: vi.fn() }));
const modules = [
  { id: 'market', name: '市场数据', path: '/market', domain: '行情与市场', managementCapability: '专属后台', boundary: '公开观察', status: 'managed', adminNote: null },
  { id: 'news-top', name: 'TOP · 要闻精选', path: '/menu-item/TOP', domain: '新闻与研究', managementCapability: '来源与审核后台', boundary: '仅许可来源', status: 'restricted', adminNote: '需要来源核对' },
  { id: 'swpm', name: '掉期管理', path: '/swpm', domain: '衍生品', managementCapability: '统一目录配置', boundary: '不构造报价', status: 'attention', adminNote: null },
];

vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../client/src/pages/admin/AdminDataModuleProfileControls', () => ({
  AdminDataModuleProfileControls: ({ moduleId }: { moduleId: string }) => <div data-testid="module-profile-controls">后台配置：{moduleId}</div>,
}));
vi.mock('@/lib/trpc', () => ({ trpc: { useUtils: () => ({ adminDataModules: { list: { invalidate: mocks.invalidate }, listEvents: { invalidate: mocks.invalidate }, listControls: { invalidate: mocks.invalidate }, yfinanceProviderStatus: { invalidate: mocks.invalidate } } }), adminDataModules: { list: { useQuery: () => ({ data: modules, isLoading: false }) }, listEvents: { useQuery: () => ({ data: [], isLoading: false }) }, listControls: { useQuery: () => ({ data: modules.map((module) => ({ moduleId: module.id, state: module.id === 'market' ? 'available' : module.id === 'news-top' ? 'partial' : 'restricted', label: module.id === 'market' ? '公共日频市场来源' : module.id === 'news-top' ? '许可新闻来源' : '来源或权限受限', configuredSourceCount: module.id === 'swpm' ? 0 : 1, availableSourceCount: module.id === 'market' ? 1 : 0, actionable: module.id !== 'swpm', dataMode: 'inherit', isEnabled: true, lastRefreshedAt: null })) }) }, yfinanceProviderStatus: { useQuery: () => ({ data: { providerLabel: 'yfinance 社区封装 / Yahoo Finance 公共数据', dataContractId: 'market.ohlcv.daily.v1', available: true, lastStatus: 'succeeded', persistedObservationCount: 21, storage: 'database', lastSuccessAt: '2026-09-22T00:00:00.000Z', lastError: null }, isLoading: false }) }, probeYfinanceProvider: { useMutation: () => ({ isPending: false, mutate: mocks.refresh }) }, update: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.update(input); options.onSuccess?.({ ...input, changed: input.moduleIds.length }); } }) }, updateRuntimeControls: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.updateRuntime(input); options.onSuccess?.({ ...input, changed: input.moduleIds.length }); } }) }, refreshSources: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.refresh(input); options.onSuccess?.({ audited: input.moduleIds.length, refreshedGroups: [] }); } }) } } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => { cleanup(); mocks.update.mockClear(); mocks.updateRuntime.mockClear(); mocks.refresh.mockClear(); mocks.invalidate.mockClear(); });

describe('AdminDataModules', () => {
  it('uses the admin provider API for yfinance status and keeps one canonical contract', () => {
    render(<AdminDataModules />);
    expect(screen.getByTestId('yfinance-provider-status').textContent).toContain('最近查询成功');
    expect(screen.getByTestId('yfinance-provider-status').textContent).toContain('market.ohlcv.daily.v1');
    expect(screen.getByTestId('yfinance-provider-status').textContent).toContain('21');
    fireEvent.click(screen.getByRole('button', { name: '探测 yfinance 提供方' }));
    expect(mocks.refresh).toHaveBeenCalledWith({ symbol: 'SPY' });
  });

  it('逐项显示前端数据模块、原路径和对应后台能力而不渲染前端数据内容', () => {
    render(<AdminDataModules />);
    expect(screen.getAllByTestId('admin-data-module-row')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /\/market/ }).getAttribute('href')).toBe('/market');
    expect(screen.getByText('来源与审核后台')).toBeTruthy();
    expect(screen.getByText(/不会修改任何前端页面、数据、路由/)).toBeTruthy();
  });

  it('支持搜索、分类筛选和只传递后台模块 ID 的批量状态更新', () => {
    render(<AdminDataModules />);
    fireEvent.change(screen.getByRole('textbox', { name: '搜索前端数据模块' }), { target: { value: 'TOP' } });
    expect(screen.getAllByTestId('admin-data-module-row')).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: '全选筛选后的前端数据模块' }));
    fireEvent.click(screen.getByRole('button', { name: '批量已纳入管理' }));
    expect(mocks.update).toHaveBeenCalledWith({ moduleIds: ['news-top'], status: 'managed', adminNote: undefined });
    fireEvent.change(screen.getByRole('textbox', { name: '搜索前端数据模块' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: '前端模块分类筛选' }), { target: { value: '衍生品' } });
    expect(screen.getAllByTestId('admin-data-module-row')).toHaveLength(1);
  });

  it('提供单模块后台状态与备注管理，保存不包含前端数据编辑字段', () => {
    render(<AdminDataModules />);
    fireEvent.click(screen.getAllByRole('button', { name: '管理' })[1]);
    fireEvent.change(screen.getByRole('combobox', { name: '单个模块管理状态' }), { target: { value: 'attention' } });
    fireEvent.change(screen.getByRole('textbox', { name: '模块管理员备注' }), { target: { value: '等待许可来源确认' } });
    fireEvent.click(screen.getByRole('button', { name: '保存后台管理设置' }));
    expect(mocks.update).toHaveBeenCalledWith({ moduleIds: ['news-top'], status: 'attention', adminNote: '等待许可来源确认' });
  });

  it('在后台弹窗内以原路径只读预览模块，不触发任何后台数据写入', () => {
    render(<AdminDataModules />);
    fireEvent.click(screen.getByRole('button', { name: '前端预览 市场数据' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTitle('前端预览 市场数据').getAttribute('src')).toBe('/market');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('显示真实来源新鲜度，并且刷新只提交已选模块 ID 而不编辑前端内容', () => {
    render(<AdminDataModules />);
    expect(screen.getByText(/公共日频市场来源/)).toBeTruthy();
    expect(screen.getByText('来源可用')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '执行数据输送 市场数据' }));
    expect(mocks.refresh).toHaveBeenCalledWith({ moduleIds: ['market'] });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('可在后台批量设为明确模拟数据模式，且只提交模块 ID 与后台运行参数', () => {
    render(<AdminDataModules />);
    fireEvent.click(screen.getByRole('checkbox', { name: '选择数据模块 掉期管理' }));
    fireEvent.click(screen.getByRole('button', { name: '批量设为模拟数据' }));
    expect(mocks.updateRuntime).toHaveBeenCalledWith({ moduleIds: ['swpm'], dataMode: 'simulated', isEnabled: true, adminDetail: undefined });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
