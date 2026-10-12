// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminAutomationCenter from '../client/src/pages/admin/AdminAutomationCenter';

const mocks = vi.hoisted(() => ({ startSingle: vi.fn(), startGroup: vi.fn(), startSite: vi.fn(), startCrawlerUpgrade: vi.fn(), process: vi.fn(), retry: vi.fn(), cancel: vi.fn(), enableSchedule: vi.fn(), setScheduleEnabled: vi.fn(), invalidate: vi.fn() }));
const runKey = 'modrun_1234567890abcdef1234567890abcdef';
const profiles = [
  { moduleId: 'market', moduleGroup: '市场快照', automationEnabled: true, runtimeStatus: 'enabled' },
  { moduleId: 'news-top', moduleGroup: '新闻内容', automationEnabled: true, runtimeStatus: 'enabled' },
  { moduleId: 'swpm', moduleGroup: '模拟与模型', automationEnabled: false, runtimeStatus: 'enabled' },
];

vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/trpc', () => ({ trpc: {
  useUtils: () => ({ adminDataModuleAutomation: { listRuns: { invalidate: mocks.invalidate }, listDeliveryEvents: { invalidate: mocks.invalidate }, getSchedule: { invalidate: mocks.invalidate }, getCrawlerUpgradeReadiness: { invalidate: mocks.invalidate } }, adminDataModules: { listProfiles: { invalidate: mocks.invalidate } } }),
  adminDataModules: { listProfiles: { useQuery: () => ({ data: profiles, isLoading: false }) } },
  adminDataModuleAutomation: {
    listRuns: { useQuery: () => ({ data: [], isLoading: false }) },
    listDeliveryEvents: { useQuery: () => ({ data: [], isLoading: false }) },
    getSchedule: { useQuery: () => ({ data: null, isLoading: false }) },
    getCrawlerUpgradeReadiness: { useQuery: () => ({ data: { valid: true, strategyCount: 140, moduleCount: 140, routedCount: 140, securityCount: 48756, articleCount: 131, activeSourceCount: 6, sourceCount: 7 }, isLoading: false }) },
    process: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.process(input); options.onSuccess?.({ runKey: input.runKey, succeeded: 1, skipped: 0 }); } }) },
    startSingle: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.startSingle(input); options.onSuccess?.({ runKey, requestedCount: 1 }); } }) },
    startGroup: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.startGroup(input); options.onSuccess?.({ runKey, requestedCount: 2 }); } }) },
    startSite: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { mocks.startSite(input); options.onSuccess?.({ runKey, requestedCount: 2 }); } }) },
    startCrawlerUpgrade: { useMutation: (options: any) => ({ isPending: false, mutate: () => { mocks.startCrawlerUpgrade(); options.onSuccess?.({ runKey, requestedCount: 140, readiness: { strategyCount: 140 } }); } }) },
    retry: { useMutation: () => ({ isPending: false, mutate: mocks.retry }) },
    cancel: { useMutation: () => ({ isPending: false, mutate: mocks.cancel }) },
    enableSchedule: { useMutation: () => ({ isPending: false, mutate: mocks.enableSchedule }) },
    setScheduleEnabled: { useMutation: () => ({ isPending: false, mutate: mocks.setScheduleEnabled }) },
  },
} }));

afterEach(() => { cleanup(); Object.values(mocks).forEach((mock) => mock.mockClear()); });

describe('AdminAutomationCenter', () => {
  it('按单模块创建持久任务后立刻调用处理契约，不是静态成功按钮', () => {
    render(<AdminAutomationCenter />);
    fireEvent.change(screen.getByRole('combobox', { name: '自动化单模块选择' }), { target: { value: 'market' } });
    fireEvent.click(screen.getByRole('button', { name: '运行模块' }));
    expect(mocks.startSingle).toHaveBeenCalledWith({ moduleId: 'market', mode: 'fast_draft' });
    expect(mocks.process).toHaveBeenCalledWith({ runKey });
  });

  it('支持分组任务、移除一键全站入口，并展示持久化队列空态', () => {
    render(<AdminAutomationCenter />);
    expect(screen.getByText(/尚无自动化任务/)).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: '自动化分组选择' }), { target: { value: '新闻内容' } });
    fireEvent.click(screen.getByRole('button', { name: '运行分组' }));
    expect(mocks.startGroup).toHaveBeenCalledWith({ moduleGroup: '新闻内容', mode: 'fast_draft' });
    expect(screen.queryByRole('button', { name: '一键自动化全站' })).toBeNull();
    expect(screen.getByRole('link', { name: '前往筛选并指定模块' })).toBeTruthy();
  });
});
