import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('municipal restricted-module tools and reading boundaries', () => {
  it('gives every restricted entry point a distinct terminal-internal control surface', () => {
    const tools = read('client/src/components/municipal/MunicipalRestrictedTools.tsx');
    ['MaturityCompare', 'VrdnScope', 'ExecutionScope', 'IndexCoverage'].forEach((name) => expect(tools).toContain(`function ${name}`));
    ['MBWD', 'CDRV', 'DEAL', 'MBIX', 'VRDN', 'BOOM'].forEach((id) => expect(tools).toContain(`'${id}'`));
  });

  it('keeps the 21 preserved municipal panels free of external-web navigation as a core reading path', () => {
    const components = ['MuniSecInfoPanel', 'MSRCPanel', 'SMUNPanel', 'AAAPanel', 'BTMMPanel', 'PICKPanel', 'MBWDPanel', 'CDRNPanel', 'CDRCPanel', 'CDRAPanel', 'CNDSPanel', 'CDRVPanel', 'DEALPanel', 'CACTPanel', 'MCALPanel', 'MBIXPanel', 'VRDNPanel', 'BMAPanel', 'MSRBPanel', 'SLGSPanel'];
    components.forEach((name) => {
      const source = read(`client/src/components/${name}.tsx`);
      expect(source).not.toMatch(/href\s*=\s*['"]https?:\/\//);
      expect(source).not.toMatch(/window\.open\s*\(\s*['"]https?:\/\//);
    });
    const boom = read('client/src/components/electronic-trading/BOOMPanel.tsx');
    expect(boom).not.toMatch(/href\s*=\s*['"]https?:\/\//);
    expect(boom).not.toMatch(/window\.open\s*\(\s*['"]https?:\/\//);
  });
});
