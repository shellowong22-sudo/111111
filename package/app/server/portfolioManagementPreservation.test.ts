import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const fingerprints: Record<string, string> = {
  'client/src/components/PortfolioManagementMenu.tsx': '71c7d3c4609c1f237b1c873c7137d24d1499da8a0558fc674c5a6b73920e08de',
  'client/src/components/portfolio/PortfolioManagementPanel.tsx': 'a3e32c78b9b9897e776a3653828af3e0c448014429570c6479b57840f796845e',
  'client/src/components/portfolio/SystemMaintenancePanel.tsx': '7311707e6ac2d56b32e8a808202ce1e87710150979ef11127012a6557175eff7',
  'client/src/components/portfolio/PRTUPanel.tsx': '5df4cfe9ea7cc035c5bd8d2750e8c279ca424e3e617ed597260802f63d74ebad',
  'client/src/components/portfolio/BBUPanel.tsx': '8d55eed30ded00f48c87a3868d7e6a5d7e612818ab470ac15fbe12e7e6dd93ff',
  'client/src/components/portfolio/PORTOverviewPanel.tsx': '62211bfe32af96da40f556c05a34cfea813239ba2cf9192aae8a0a79a73b49ef',
  'client/src/components/portfolio/PORTIPPanel.tsx': '34f72bc5f94be9690b6b1a7173302b426d174d35911f8709c04239deaad90852',
  'client/src/components/portfolio/PDSPPanel.tsx': '83831839763635baa66c5679ae5da53e32f28e3276f55ae1bdb4a4e3e7c06fe5',
  'client/src/components/portfolio/PORTTEPanel.tsx': '613e27cee318e02bed0544d062ef99e5633238bf0a9a2f6eb98ec5d23873684e',
  'client/src/components/portfolio/PORTVRPanel.tsx': 'ef9da390e486365b227bdaa4510fef1cc60ead726a19b836807134d98958e645',
  'client/src/components/portfolio/PORTSAPanel.tsx': '3732a97a13dd7612a632572b9177f5114268b8294cf05793d1882dbdd8ce712f',
  'client/src/components/portfolio/PORTHDPanel.tsx': '2f9be4c0bbf979f8c12d258237e557abad9223fb036063551c1256fa7f9ba71e',
  'client/src/components/portfolio/PORTCHPanel.tsx': '7ab9c1f5ef23d5e156b9e6c7659f9b32a4b052c47925d0c0568ea7530bc19a79',
  'client/src/components/portfolio/PORTHPPanel.tsx': '278d91ef59ff7607d7408a4826123e306de70ac0ba6679bc149d03428b080577',
  'client/src/components/portfolio/PORTPAPanel.tsx': 'ea96209ddbb79841cc8f05886dfb20288e491e8598e79b301af232f819674246',
  'client/src/components/portfolio/PORTTSPanel.tsx': 'd170cf74acbe54f0b66340c06410b8b23a21abe401bad6187c5a72831e97c50e',
  'client/src/components/portfolio/PORTOPPanel.tsx': 'cd0be0bcb7ad8199653291831cbf60e424c1b0f765610f61f81ea5aa74df6041',
  'client/src/components/portfolio/NLPanel.tsx': 'c3ff99b5cc9a6206fe88a2075cbccbf834c72fc9574dd9e1e35575b7de7fd6e9',
  'client/src/components/portfolio/EVTSPortPanel.tsx': 'ae84a72bab2e992e9ca7e44ae57d6d42c418a39f90c59b5b88bc93df0f990947',
  'client/src/components/portfolio/PREPPanel.tsx': '4a84d4f13c07d41ecfebcd71cc312cb22ff1ba0dbdea239525eb1095a1e93b8a',
  'client/src/components/portfolio/MIFIPanel.tsx': '3af02290ffd8aef5f7c226b74565cb8645536bd1bb6b03ad5afbc898402a9112',
  'client/src/components/portfolio/AlertMonitorPanel.tsx': 'faea8270f1510b4e657ecdf83bf908c4a9d39dbc265f3d01853a831c30aaa0a0',
  'client/src/components/portfolio/DecisionReportPanel.tsx': '50f25d617fc42898323457a2cd9e7eb245c6b170a5b66abf367c20a03e8db034',
  'client/src/components/portfolio/AuditLogPanel.tsx': '726a605006b21fa8fc8fb4f8b7fe301c341b997790cd4fc49f75d79345baf1bf',
  'client/src/components/portfolio/IntegrationMonitorPanel.tsx': 'a11868fef7eab51194e36aea03fb3f4167dd36431f736481f7eeda8de872e7a7',
  'client/src/components/portfolio/BondPortfolioRiskImportPanel.tsx': '80b1d099f1d9407f21baeda67de8d1f3b9abed05bd5bf7e60ae4690fe5894574',
};

function hash(path: string) { return createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'); }

describe('portfolio management original content protection', () => {
  it('keeps the 24 original menu, workspace and sub-panels byte-for-byte unchanged', () => {
    expect(Object.keys(fingerprints)).toHaveLength(26);
    for (const [path, expected] of Object.entries(fingerprints)) expect(hash(path), path).toBe(expected);
  });

  it('keeps all 24 original entries and appends the research layer outside the original workspace', () => {
    const menu = readFileSync(resolve(root, 'client/src/components/PortfolioManagementMenu.tsx'), 'utf8');
    const panel = readFileSync(resolve(root, 'client/src/components/portfolio/PortfolioManagementPanel.tsx'), 'utf8');
    const wrapper = readFileSync(resolve(root, 'client/src/components/portfolio/PortfolioRiskPreservedModule.tsx'), 'utf8');
    const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
    expect((menu.match(/number: '/g) ?? [])).toHaveLength(24);
    expect((panel.match(/id: '/g) ?? [])).toHaveLength(24);
    expect(wrapper).toContain('data-preserved-portfolio-workspace="true"');
    expect(wrapper).toContain('data-portfolio-risk-research-layer="true"');
    expect(wrapper.indexOf('data-preserved-portfolio-workspace="true"')).toBeLessThan(wrapper.indexOf('data-portfolio-risk-research-layer="true"'));
    expect(terminal).toContain('<PortfolioRiskPreservedModule moduleId="PORTFOLIO-TERMINAL"><PortfolioManagementPanel initialTab={portfolioInitialTab} /></PortfolioRiskPreservedModule>');
    expect(terminal).toContain('<PortfolioRiskPreservedModule moduleId={`PORTFOLIO-${tabId}`}><PortfolioManagementPanel initialTab={tabId} /></PortfolioRiskPreservedModule>');
    expect(terminal).toContain("requestedModule === 'portfolio-management'");
    expect(terminal).toContain("if (moduleId === 'portfolio-management')");
  });
});
