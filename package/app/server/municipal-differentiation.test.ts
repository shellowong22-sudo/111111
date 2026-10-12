import { describe, expect, it } from 'vitest';
import { MUNICIPAL_MODULE_META } from '../client/src/components/municipal/MunicipalResearchLayer';

describe('municipal module differentiation', () => {
  it('assigns a distinct research focus to all 21 preserved local-bond entry points', () => {
    const modules = Object.values(MUNICIPAL_MODULE_META);
    expect(modules).toHaveLength(21);
    expect(new Set(modules.map((module) => module.focus)).size).toBe(21);
    expect(new Set(modules.map((module) => module.kind))).toEqual(new Set(['catalog', 'curve', 'flow', 'structure', 'restricted', 'event']));
  });

  it('labels modules without freely readable structured market data as restricted rather than presenting artificial values', () => {
    ['MBWD', 'CDRV', 'DEAL', 'MBIX', 'VRDN', 'BOOM'].forEach((id) => {
      expect(MUNICIPAL_MODULE_META[id as keyof typeof MUNICIPAL_MODULE_META].kind).toBe('restricted');
    });
  });
});
