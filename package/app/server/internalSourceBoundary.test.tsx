// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import InternalSourceBoundary from '../client/src/components/InternalSourceBoundary';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-external-anchor]').forEach((node) => node.remove());
});

describe('站内来源边界层', () => {
  it('拦截直接 HTTP(S) 锚点并只在终端内展示来源元数据', async () => {
    render(<InternalSourceBoundary />);
    const anchor = document.createElement('a');
    anchor.href = 'https://www.sec.gov/edgar/search/';
    anchor.textContent = '打开 SEC EDGAR';
    anchor.setAttribute('data-test-external-anchor', 'true');
    document.body.append(anchor);

    const navigationAllowed = anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(navigationAllowed).toBe(false);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('来源链接已保留在终端内')).toBeTruthy();
    expect(screen.getByText('https://www.sec.gov/edgar/search/')).toBeTruthy();

    const boundary = read('client/src/components/InternalSourceBoundary.tsx');
    expect(boundary).toContain("document.addEventListener('click', onExternalAnchorClick, true)");
    expect(boundary).toContain('event.preventDefault()');
    expect(boundary).toContain('IN-TERMINAL SOURCE BOUNDARY');
    expect(boundary).toContain('当前终端未读取、转述或验证该外部页面内容');
    expect(boundary).toContain('来源地址（仅作可审计元数据）');
    expect(boundary).toContain("document.addEventListener('auxclick', onExternalAnchorClick, true)");
  });

  it('同样阻止带修饰键的点击和中键辅助点击', async () => {
    render(<InternalSourceBoundary />);
    const anchor = document.createElement('a');
    anchor.href = 'https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/';
    anchor.textContent = '原始字段';
    anchor.setAttribute('data-test-external-anchor', 'true');
    document.body.append(anchor);

    expect(anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true }))).toBe(false);
    expect(await screen.findByRole('dialog')).toBeTruthy();

    const middleAnchor = document.createElement('a');
    middleAnchor.href = 'https://finance.yahoo.com/';
    middleAnchor.textContent = '公开数据提供方说明';
    middleAnchor.setAttribute('data-test-external-anchor', 'true');
    document.body.append(middleAnchor);
    expect(middleAnchor.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))).toBe(false);
  });

  it('边界层挂载后新增的动态 href 同样在普通、修饰键和中键事件中留在终端', async () => {
    function DeferredExternalSource() {
      const [href, setHref] = React.useState<string | null>(null);
      React.useEffect(() => setHref('https://www.finra.org/finra-data/fixed-income/market-activity'), []);
      return href ? <a data-test-external-anchor="true" href={href}>动态 FINRA 来源</a> : null;
    }

    render(<><InternalSourceBoundary /><DeferredExternalSource /></>);
    const anchor = await screen.findByText('动态 FINRA 来源');

    expect(anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))).toBe(false);
    expect(anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true }))).toBe(false);
    expect(anchor.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))).toBe(false);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('https://www.finra.org/finra-data/fixed-income/market-activity')).toBeTruthy();
  });

  it('在路由之外挂载，不要求修改冻结页面锚点文本或布局', () => {
    const app = read('client/src/App.tsx');
    expect(app).toContain('import InternalSourceBoundary from "./components/InternalSourceBoundary"');
    expect(app).toContain('<Router />\n      <InternalSourceBoundary />');
  });
});
