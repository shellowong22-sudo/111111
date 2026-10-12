import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADMIN_DATA_MODULES } from '@shared/adminDataModules';

const projectRoot = resolve(import.meta.dirname, '..');
const terminalSource = readFileSync(resolve(projectRoot, 'client/src/pages/Terminal.tsx'), 'utf8');
const menuSource = readFileSync(resolve(projectRoot, 'client/src/components/SovereignBondMenu.tsx'), 'utf8');
const panelKitSource = readFileSync(resolve(projectRoot, 'client/src/components/sovereign/PanelKit.tsx'), 'utf8');
const spiderSource = readFileSync(resolve(projectRoot, 'server/spiderPlatform.ts'), 'utf8');

describe('主权债 24 个原入口原位升级契约', () => {
  it('不再挂载或引用额外的统一工作区', () => {
    expect(terminalSource).not.toContain('SovereignModuleWorkspace');
    expect(() => readFileSync(resolve(projectRoot, 'client/src/components/sovereign/SovereignModuleWorkspace.tsx'), 'utf8')).toThrow();
  });

  it('不再展示统一观测时间刷新条和功能隔离验收条', () => {
    const visibleSources = [menuSource, panelKitSource, terminalSource];
    for (const source of visibleSources) {
      expect(source).not.toContain('主权债功能隔离检测');
      expect(source).not.toContain('目标 24/24');
      expect(source).not.toContain('数据基础 24/24');
      expect(source).not.toContain('数据流正常');
      expect(source).not.toContain('自动刷新 30s');
      expect(source).not.toContain('上次读取');
    }
    expect(menuSource).not.toContain('核心视图');
    expect(menuSource).not.toContain('建议功能');
    expect(menuSource).not.toContain('世界股票指数');
    expect(menuSource).not.toContain('评估全球利率');
    expect(() => readFileSync(resolve(projectRoot, 'client/src/components/sovereign/SovereignUniqueExtension.tsx'), 'utf8')).toThrow();
  });

  it('后台 24 个定向数据槽具有唯一标识和原入口绑定', () => {
    const sovereignModules = ADMIN_DATA_MODULES.filter(module => module.id.startsWith('sov-'));
    expect(sovereignModules).toHaveLength(24);
    expect(new Set(sovereignModules.map(module => module.id)).size).toBe(24);
    expect(new Set(sovereignModules.map(module => module.path)).size).toBe(24);
    for (let index = 1; index <= 24; index += 1) {
      expect(sovereignModules.some(module => module.path === `/terminal?open=${index}&module=sovereign-bonds`)).toBe(true);
      expect(terminalSource).toContain(`'${index}'`);
    }
  });

  it('终端共享组件不出现后台实现和爬虫版本描述', () => {
    for (const phrase of ['后台人工定向推送', '当前功能已映射', 'crawler-v2.0.130', '指定模块']) {
      expect(panelKitSource).not.toContain(phrase);
      expect(terminalSource).not.toContain(phrase);
    }
  });

  it('人工定向推送使用稳定内容身份去重并返回实际前端读取结果', () => {
    expect(spiderSource).toContain('targetModuleId: moduleId');
    expect(spiderSource).toContain('sourceEntityUuid: selected.uuid');
    expect(spiderSource).toContain('payload.sourceDataUuid === selected.uuid');
    expect(spiderSource).toContain('latestPushRelationUuid: relationUuid');
    expect(spiderSource).toContain('duplicateBlocked,');
    expect(spiderSource).toContain('frontReadConfirmed: Boolean(frontAckAt)');
  });
});
