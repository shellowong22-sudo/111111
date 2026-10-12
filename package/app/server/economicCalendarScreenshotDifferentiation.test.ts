import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const originalHub = readFileSync(`${root}/client/src/pages/EconomicDataHub.tsx`, 'utf8');
const wrapper = readFileSync(`${root}/client/src/components/econ/EconomicDataHubPreservedRoute.tsx`, 'utf8');
const region = readFileSync(`${root}/client/src/components/econ/OfficialResearchWorkbench.tsx`, 'utf8');

describe('经济中心 29 项原始功能与重复追加区边界', () => {
  it('保持 ZIP 原经济中心字节级不变，并从当前路由移除统一后置扩展区', () => {
    expect(createHash('sha256').update(originalHub).digest('hex')).toBe('ecc9e2e85ae0cd27dda5e5dddcd7911683749cfdb834c9f6922a8cb8def5815c');
    expect(wrapper).toContain('data-preserved-economic-hub="true"');
    expect(wrapper).toContain('<EconomicDataHub />');
    expect(wrapper).toContain('<ModuleLiveDeliveryTable {...openBBDelivery}');
    expect(wrapper).not.toContain('<EconOneToOneExtensionBridge />');
    expect(wrapper).not.toContain('ZIP CONTEXT EXTENSION');
    expect(wrapper).not.toMatch(/OfficialResearchWorkbench|EconomicCalendarOfficialObservations|MacroEvidenceWorkflowDesk|EconomicFieldSourceDirectory/);
  });

  it('旧统一工作台文件仅作历史审计，不能通过当前保留路由回到用户截图区域', () => {
    expect(region).toContain('FEDS PRIMARY-TEXT READING DESK');
    expect(wrapper).not.toContain('OfficialResearchWorkbench');
  });
});
