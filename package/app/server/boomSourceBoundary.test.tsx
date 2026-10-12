// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BOOMPanel from '../client/src/components/electronic-trading/BOOMPanel';
import BTMMEnhancedPanel from '../client/src/components/BTMMEnhancedPanel';
import CDSWPanel from '../client/src/components/CDSWPanel';
import DESBondPanel from '../client/src/components/DESBondPanel';
import DMMVPanel from '../client/src/components/DMMVPanel';
import DynamicFunctionPanel from '../client/src/components/DynamicFunctionPanel';
import ETBTPanel from '../client/src/components/electronic-trading/ETBTPanel';

describe('BOOM 可达模拟数据边界', () => {
  it('保留组件源文件但将实际渲染出口置为来源不可用状态', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/components/electronic-trading/BOOMPanel.tsx'), 'utf8');
    expect(source).toContain('generateMockOrders');
    expect(source).toContain('available: false');
    expect(source).toContain('数据源不可用');
    expect(source).toContain('不会显示随机生成的委托单、成交率、滑点、稳定性、拍卖结果或“实战信号”');
    expect(source).toContain('刷新数据（未接入）');
  });

  it('在实际渲染入口显示真实不可用状态而非模拟委托单', () => {
    const screen = render(<BOOMPanel />);
    expect(screen.getByText('数据源不可用')).toBeTruthy();
    expect(screen.getByText(/不会显示随机生成的委托单/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /刷新数据/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('BTMM 可达模拟数据边界', () => {
  it('在实际渲染入口显示来源不可用而非固定或随机利率数值', () => {
    const screen = render(<BTMMEnhancedPanel />);
    expect(screen.getAllByText('数据源不可用').length).toBeGreaterThan(0);
    expect(screen.getByText(/不会显示固定利率、随机 M2/)).toBeTruthy();
    expect(screen.queryByText('中国国债收益率曲线（%）')).toBeNull();
  });
});

describe('CDSW 可达模拟数据边界', () => {
  it('在实际渲染入口显示来源不可用而非伪 CDS 定价与信用曲线', () => {
    const screen = render(<CDSWPanel />);
    expect(screen.getAllByText('数据源不可用').length).toBeGreaterThan(0);
    expect(screen.getByText(/不会显示预设 CDS 公允利差/)).toBeTruthy();
    expect(screen.queryByText('CDS定价引擎 — 保护腿/溢价腿现值计算')).toBeNull();
  });
});

describe('DES 证券简介数据边界', () => {
  it('在实际渲染入口显示来源不可用而非预设条款、评级与价格历史', () => {
    const screen = render(<DESBondPanel />);
    expect(screen.getAllByText('数据源不可用').length).toBeGreaterThan(0);
    expect(screen.getByText(/不会显示预设债券条款/)).toBeTruthy();
    expect(screen.queryByText('24国债01')).toBeNull();
  });
});

describe('DMMV 跨国市场数据边界', () => {
  it('在实际渲染入口显示来源不可用而非伪全球曲线、热力图和策略结论', () => {
    const screen = render(<DMMVPanel />);
    expect(screen.getAllByText('数据源不可用').length).toBeGreaterThan(0);
    expect(screen.getByText(/不会显示预设全球收益率、随机历史曲线/)).toBeTruthy();
    expect(screen.queryByText('G10跨市场联动矩阵')).toBeNull();
  });
});

describe('DynamicFunction 通用分派数据边界', () => {
  it('在新闻、市场和研究类参数下均显示来源不可用而不分派伪业务子面板', () => {
    const screen = render(<DynamicFunctionPanel title="市场与研究" code="TEST" category="news" description="原菜单说明" />);
    expect(screen.getAllByText('数据源不可用').length).toBeGreaterThan(0);
    expect(screen.getByText(/不会显示随机或固定的市场价格/)).toBeTruthy();
    expect(screen.queryByText('美联储官员暗示年内可能降息两次')).toBeNull();
  });
});

describe('ETBT 电子交易记录簿数据边界', () => {
  it('在实际渲染入口显示来源不可用而不生成随机成交、VWAP、盈亏或伪刷新提示', () => {
    const screen = render(<ETBTPanel />);
    expect(screen.getAllByText('数据源不可用').length).toBeGreaterThan(0);
    expect(screen.getByText(/不会显示随机生成的交易、价格、成交量/)).toBeTruthy();
    expect(screen.queryByText('刷新数据...')).toBeNull();
  });
});
