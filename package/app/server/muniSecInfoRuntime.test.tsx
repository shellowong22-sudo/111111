/* @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MuniSecInfoPanel from '../client/src/components/MuniSecInfoPanel';

afterEach(cleanup);

describe('地方债证券功能页', () => {
  it('保留全部20个子入口并将点击交给原有导航回调', () => {
    const onNavigate = vi.fn();
    render(<MuniSecInfoPanel onNavigate={onNavigate} />);
    const ids = ['MSRC', 'SMUN', 'AAA', 'BTMM', 'PICK', 'MBWD', 'CDRN', 'CDRC', 'CDRA', 'CNDS', 'CDRV', 'DEAL', 'CACT', 'MCAL', 'MBIX', 'VRDN', 'BMA', 'BOOM', 'MSRB', 'SLGS'];
    expect(ids.every(id => screen.getByText(id))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /MSRC 地方债检索/ }));
    expect(onNavigate).toHaveBeenCalledWith('MSRC', '地方债检索');
  });

  it('支持功能筛选且不展示原先伪造的实时摘要', () => {
    render(<MuniSecInfoPanel onNavigate={vi.fn()} />);
    expect(screen.queryByText('$3.9T')).toBeNull();
    expect(screen.queryByText('LIVE')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: '查找地方债功能' }), { target: { value: 'VRDN' } });
    expect(screen.getByText('BOOM')).toBeTruthy();
    expect(screen.queryByText('地方债检索')).toBeNull();
  });

  it('在曲线工具输入AAA和UST后计算利差及税等价收益率', () => {
    render(<MuniSecInfoPanel onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '收益率曲线' }));
    fireEvent.change(screen.getByRole('textbox', { name: '1Y AAA 收益率（%）' }), { target: { value: '3.20' } });
    fireEvent.change(screen.getByRole('textbox', { name: '1Y UST 收益率（%）' }), { target: { value: '2.80' } });
    fireEvent.change(screen.getByRole('textbox', { name: '边际税率（%）' }), { target: { value: '20' } });
    expect(screen.getByLabelText('1Y AAA与UST利差').textContent).toBe('40.00');
    expect(screen.getByLabelText('1Y AAA税等价收益率').textContent).toBe('4.00');
  });

  it('板块和资金流工具仅汇总用户输入', () => {
    render(<MuniSecInfoPanel onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '板块分布' }));
    fireEvent.change(screen.getByRole('textbox', { name: '一般义务发行金额' }), { target: { value: '10' } });
    fireEvent.change(screen.getByRole('textbox', { name: '教育发行金额' }), { target: { value: '5' } });
    expect(screen.getByLabelText('已输入板块合计').textContent).toContain('15.00');
    fireEvent.click(screen.getByRole('tab', { name: '资金流向' }));
    fireEvent.change(screen.getByRole('textbox', { name: '第1期流入' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('textbox', { name: '第1期流出' }), { target: { value: '3' } });
    expect(screen.getByLabelText('第1期净流入').textContent).toBe('5.00');
    expect(screen.getByLabelText('完整记录累计净流入').textContent).toBe('5.00');
  });
});
