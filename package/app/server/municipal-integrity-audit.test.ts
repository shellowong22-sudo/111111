import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const municipalModules = [
  ['1', 'MuniSecInfoPanel.tsx'], ['MSRC', 'MSRCPanel.tsx'], ['SMUN', 'SMUNPanel.tsx'], ['AAA', 'AAAPanel.tsx'], ['BTMM', 'MunicipalBTMMPanel.tsx'], ['PICK', 'PICKPanel.tsx'], ['MBWD', 'MBWDPanel.tsx'], ['CDRN', 'CDRNPanel.tsx'], ['CDRC', 'CDRCPanel.tsx'], ['CDRA', 'CDRAPanel.tsx'], ['CNDS', 'CNDSPanel.tsx'], ['CDRV', 'CDRVPanel.tsx'], ['DEAL', 'DEALPanel.tsx'], ['CACT', 'MunicipalCACTPanel.tsx'], ['MCAL', 'MCALPanel.tsx'], ['MBIX', 'MBIXPanel.tsx'], ['VRDN', 'VRDNPanel.tsx'], ['BMA', 'BMAPanel.tsx'], ['BOOM', 'BOOMPanel.tsx'], ['MSRB', 'MSRBPanel.tsx'], ['SLGS', 'SLGSPanel.tsx'],
] as const;

describe('municipal terminal integrity audit', () => {
  it('keeps all 21 original entries ordered, preserved and covered by a distinct terminal-native research route', () => {
    const menu = read('client/src/components/LocalBondMenu.tsx');
    const terminal = read('client/src/pages/Terminal.tsx');
    const research = read('client/src/components/municipal/MunicipalResearchLayer.tsx');
    const preserved = read('client/src/components/municipal/MunicipalPreservedModule.tsx');

    const menuOffsets = municipalModules.map(([id]) => menu.indexOf(`id: '${id}'`));
    expect(menuOffsets.every((offset) => offset >= 0)).toBe(true);
    expect(menuOffsets.every((offset, index) => index === 0 || offset > menuOffsets[index - 1]!)).toBe(true);

    municipalModules.forEach(([id]) => {
      expect(terminal).toMatch(new RegExp(`retained\\(\\s*["']${id}["'],`));
      expect(research).toContain(`${id === '1' ? `'1'` : id}: { code:`);
    expect(preserved).toContain('MunicipalTerminalWorkbench');
    });
  });

  it('keeps original municipal panels in-platform without external-navigation code', () => {
    municipalModules.forEach(([, file]) => {
      const source = read(`client/src/components/${file}`);
      expect(source).not.toMatch(/window\.open\s*\(/);
      expect(source).not.toMatch(/location\.(href|assign|replace)/);
      expect(source).not.toMatch(/<a\s[^>]*href=/);
      expect(source).not.toMatch(/target=["']_blank["']/);
    });

    const additions = [
      'client/src/components/municipal/MunicipalResearchLayer.tsx',
      'client/src/components/municipal/MunicipalRestrictedTools.tsx',
      'client/src/components/municipal/MunicipalIssuerEvidenceWorkspace.tsx',
    ].map(read).join('\n');
    expect(additions).not.toMatch(/window\.open\s*\(/);
    expect(additions).not.toMatch(/<a\s[^>]*href=/);
  });

  it('keeps static-only market displays explicitly bounded and routes practical work to the terminal', () => {
    const preserved = read('client/src/components/municipal/MunicipalPreservedModule.tsx');
    const research = read('client/src/components/municipal/MunicipalResearchLayer.tsx');
    const issuerWorkspace = read('client/src/components/municipal/MunicipalIssuerEvidenceWorkspace.tsx');

    expect(preserved).toContain('原工作区字段与交互保持不变');
    expect(research).toContain('不使用第三方网页、旧缓存、样例或推断结果替代');
    expect(research).toContain('不读取外部逐笔交易，也不补造成交统计、报价、收益率、库存或交易商字段');
    expect(issuerWorkspace).toContain('创建证据包');
    expect(issuerWorkspace).toContain('冻结并提交审阅');
  });

  it('adds an interactive terminal-native governance board after the original municipal overview', () => {
    const research = read('client/src/components/municipal/MunicipalResearchLayer.tsx');
    expect(research).toContain('地方债 21 项终端内完整性治理看板');
    expect(research).toContain('官方资料参照');
    expect(research).toContain('真实空状态/授权闸门');
    expect(research).toContain("if (moduleId === '1') return <MunicipalIntegrityBoard");
    expect(research).toContain('setFilter(item.id)');
  });

  it('connects every original function-overview card to the municipal window dispatcher', () => {
    const terminal = read('client/src/pages/Terminal.tsx');
    const overview = read('client/src/components/MuniSecInfoPanel.tsx');
    expect(terminal).toContain('<MuniSecInfoPanel');
    expect(terminal).toContain('const target = lbMap[targetId];');
    expect(terminal).toContain('const targetWindowId = `lb-${targetId}`;');
    expect(overview).toContain('onNavigate: (id: string, name: string) => void');
    expect(overview).toContain('onNavigate(fn.id, fn.name)');
    expect(overview).not.toContain('onNavigate?.(');
    expect(overview).toContain('const FUNCTIONS = [');
  });
});
