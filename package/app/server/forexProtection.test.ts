import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const fingerprint = (path: string) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
const protectedFiles: Record<string, string> = {
  'client/src/components/ForexMenu.tsx': 'cc39f22165c35ffebfeb48c7fce1541db9e9f628727586f04f0120c8ec831d4a',
  'client/src/components/ForexExtPanels.tsx': '05827a5cb214f7971e52693a0ad2e984b3ae5d61c9d653e9692d7f133deb4915',
  'client/src/components/forex/ALLQPanel.tsx': '15dfa014617ad323d242909906ceb49d46a99c7893a043b86de2c8583a541879',
  'client/src/components/forex/BFIXPanel.tsx': '5921cf0f9b677149069e2d811d9499117187e1d7160214702d34c089e259a02c',
  'client/src/components/forex/ECMIPanel.tsx': 'de58fb21c2c9c87e6cd0b56c436878ac9beabce1dbee40b08c45941a766f38b8',
  'client/src/components/forex/FRDPanel.tsx': '9b4be15a2b1e5c150471cfa2d54b65d34c576a79c6dd7dbe4bd124e74f8a9ebd',
  'client/src/components/forex/FXDSPanel.tsx': '4bf1238180c0632fb7dbcd5b50b10c868cd4faaf9b96aa97e06ee6b86dc5411c',
  'client/src/components/forex/FXFAPanel.tsx': '28de75ff38d07583eb9ba174b11a560941a33f1873a34380bb231311b22059e8',
  'client/src/components/forex/FXIPPanel.tsx': 'dfed1b197f9e8f804582ac6d0b5eca12183b3a7bef6f93e4649907c201c30a98',
  'client/src/components/forex/FXTFPanel.tsx': '3d30e1801ce8b2239e0521f8a6f30d7db18c8d786f8ccb8aa6c8fb3f6a4d6fd3',
  'client/src/components/forex/STNIPanel.tsx': 'e0033864ad6f80ca134b03ae855f868b69e0e3e728e23e6f8fc1b0ec0694bf87',
  'client/src/components/forex/XDSHPanel.tsx': 'a920021d58483d88263d92da629aaf2676ef7832b12799df96bb5154cf267b4f',
};

describe('forex original-content protection', () => {
  it('keeps the original forex menu, detail panels, and extension panels at their protected baselines', () => {
    for (const [file, expected] of Object.entries(protectedFiles)) expect(fingerprint(file)).toBe(expected);
  });

  it('keeps the original active forex menu entry order', () => {
    const source = readFileSync(join(root, 'client/src/components/ForexMenu.tsx'), 'utf8');
    const expected = ['FXIP', 'FXDS', 'FXTF', 'FXC', 'WCR', 'WVOL', 'XCCY', 'GMM', 'FXSW', 'XDSH', 'FXFC', 'WCRS', 'ECMI', 'MYQ', 'ALLQ', 'FRD', 'OVML', 'BFIX', 'FXFA', 'GP', 'FIRS', 'TOP FX', 'STNI', 'RES', 'BICO', 'MARS FX'];
    let cursor = 0; for (const code of expected) { const occurrence = source.indexOf(`code: '${code}'`, cursor); expect(occurrence).toBeGreaterThan(cursor); cursor = occurrence; }
  });

  it('renders original forex children before the independent research layer and keeps every menu entry in-terminal', () => {
    const preserved = readFileSync(join(root, 'client/src/components/forex/ForexPreservedModule.tsx'), 'utf8');
    const terminal = readFileSync(join(root, 'client/src/pages/Terminal.tsx'), 'utf8');
    const detail = readFileSync(join(root, 'client/src/pages/MenuItemDetail.tsx'), 'utf8');
    const research = readFileSync(join(root, 'client/src/components/forex/ForexResearchLayer.tsx'), 'utf8');
    expect(preserved.indexOf('{children}')).toBeLessThan(preserved.indexOf('<ForexResearchLayer'));
    for (const id of ['fxip', 'fxds', 'fxtf', 'fxc', 'wcr', 'wvol', 'xccy', 'gmm', 'fxsw', 'xdsh', 'fxfc', 'wcrs', 'ecmi', 'myq', 'allq', 'frd', 'ovml', 'bfix', 'fxfa', 'gp', 'firs', 'topfx', 'stni', 'res', 'bico', 'marsfx']) expect(terminal).toContain(`'${id}'`);
    expect(detail).toContain('<ForexPreservedModule moduleId={code}><Panel /></ForexPreservedModule>');
    expect(research).not.toMatch(/href\s*=/i);
  });
});
