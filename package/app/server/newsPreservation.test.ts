import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('新闻与研究原内容保护', () => {
  it('固定原始菜单、原新闻中心、主终端新闻面板及全部专属面板的内容指纹', () => {
    const menu = source('client/src/components/NewsResearchMenu.tsx');
    for (const [num, code, path] of [
      [13, 'MDIA', '/news-hub?tab=media'],
      [15, '3RD', '/news-hub?tab=third'],
      [16, 'INTL', '/news-hub?tab=intl'],
      [17, 'CMNT', '/news-hub?tab=commentary'],
      [20, 'PERS', '/news-hub?tab=personal'],
      [26, 'SOCL', '/news-hub?tab=social'],
      [29, 'DOCS', '/news-hub?tab=docs'],
    ] as const) {
      expect(menu).toContain(`num: ${num}, code: '${code}'`);
      expect(menu).toContain(`path: '${path}'`);
    }
    // The data implementation may evolve; preserve the actual 29 workspaces,
    // not a whole-file hash that also locks in synthetic values and feed bugs.
    const hub = source('client/src/pages/NewsResearchHub.tsx');
    const tabs = [...hub.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1]);
    expect(tabs).toEqual(['top','btdy','frnt','cn','read','ni','nh','firs','bi','beco','dayb','mag','media','medi','third','intl','commentary','opin','bnef','personal','myn','nlrt','nsub','mrep','nzpd','social','soci','tren','docs']);
    expect(source('client/src/components/NewsPanel.tsx')).toContain('NEWS_ITEMS.length');
    const top = source('client/src/components/news/TOPPanel.tsx');
    expect([...top.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(['official','curated','headlines','heat','sentiment','tickers','reaction','matrix','crossasset']);
    expect(top).toContain('setSelectedNews');
    expect(top).toContain('setFilter');
    expect(top).not.toContain('Math.max(72');
    expect(top).not.toContain("? 80 :");
    for (const panel of [
      'client/src/components/news/BTDYPanel.tsx',
      'client/src/components/news/FRNTPanel.tsx',
      'client/src/components/news/CNPanel.tsx',
    ]) {
      expect(source(panel)).toMatch(/export default|export function/);
    }
    { const panel = source('client/src/components/news/READPanel.tsx');
      expect([...panel.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(['articles','trend','readtime','engagement','forecast']);
      expect(panel).toContain('SourceReturnDesk');
      expect(panel).not.toMatch(/Math\.random|Math\.sin|Math\.cos/);
    }
    { const panel = source('client/src/components/news/NIPanel.tsx');
      expect([...panel.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(["bubble","trend","sentiment","tags","corr"]);
      expect(panel).not.toMatch(/Math\.random|Math\.sin|Math\.cos/);
    }
    const rolling = source('client/src/components/news/NHPanel.tsx');
    expect([...rolling.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(['live','hourly','impact','speed']);
    expect(rolling).toContain('getGlobalFeed.useQuery');
    expect(rolling).not.toContain('Math.random');
    expect(rolling).not.toContain('setInterval');
    for (const panel of [
      'client/src/components/news/FIRSPanel.tsx',
      'client/src/components/news/BIPanel.tsx',
      'client/src/components/news/BECOPanel.tsx',
      'client/src/components/news/DAYBPanel.tsx',
      'client/src/components/news/MAGPanel.tsx',
      'client/src/components/news/MEDIPanel.tsx',
      'client/src/components/news/OPINPanel.tsx',
      'client/src/components/news/BNEFPanel.tsx',
      'client/src/components/news/MYNPanel.tsx',
    ]) {
      expect(source(panel)).toMatch(/export default|export function/);
    }
    { const panel = source('client/src/components/news/NLRTPanel.tsx');
      expect([...panel.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(["rules","history","daily","reaction"]);
      expect(panel).not.toMatch(/Math\.random|Math\.sin|Math\.cos/);
    }
    { const panel = source('client/src/components/news/NSUBPanel.tsx');
      expect([...panel.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(["subs","reading","category","topics"]);
      expect(panel).not.toMatch(/Math\.random|Math\.sin|Math\.cos/);
    }
    expect(source('client/src/components/news/MREPPanel.tsx')).toMatch(/export default|export function/);
    const settings = source('client/src/components/news/NZPDPanel.tsx');
    expect([...settings.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(['prefs','push','radar','behavior','ingestion']);
    expect(settings).toContain('AdminNewsIngestionDesk');
    { const panel = source('client/src/components/news/SOCIPanel.tsx');
      expect([...panel.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(["platforms","kol","series","tickers"]);
      expect(panel).not.toMatch(/Math\.random|Math\.sin|Math\.cos/);
    }
    { const panel = source('client/src/components/news/TRENPanel.tsx');
      expect([...panel.matchAll(/<TabsContent value="([^"]+)"/g)].map(match => match[1])).toEqual(["trending","series","stocks","forecast"]);
      expect(panel).not.toMatch(/Math\.random|Math\.sin|Math\.cos/);
    }
  });

  it('保留原始菜单的 29 个入口、原新闻中心模块与主终端新闻入口', () => {
    const menu = source('client/src/components/NewsResearchMenu.tsx');
    const hub = source('client/src/pages/NewsResearchHub.tsx');
    const panel = source('client/src/components/NewsPanel.tsx');
    const terminal = source('client/src/pages/Terminal.tsx');
    expect(menu.match(/num: \d+/g)).toHaveLength(29);
    ['要闻精选', '新闻主题', '滚动新闻', '彭博行业研究', '新闻检索与提醒', '新闻趋势'].forEach((label) => expect(menu).toContain(label));
    expect(panel).toContain('NEWS_ITEMS.length');
    expect(terminal).toMatch(/<NewsPreservedModule moduleId="NEWS-TERMINAL">\s*<NewsPanel title="新闻与研究报告"\s*\/>\s*<\/NewsPreservedModule>/);
  });
});
