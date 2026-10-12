import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const terminal = readFileSync(resolve(import.meta.dirname, '../client/src/pages/Terminal.tsx'), 'utf8');

describe('终端深链模块路由', () => {
  it('保留既有模块回退逻辑，并覆盖所有具备子菜单分发器的市场与经济模块', () => {
    [
      'credit-bonds', 'mortgage-bonds', 'money-market', 'local-bonds',
      'preferred-stock', 'stocks', 'derivatives', 'commodities', 'forex',
      'indices', 'economics',
    ].forEach((moduleId) => expect(terminal).toContain(`requestedModule === '${moduleId}'`));
    expect(terminal).toContain(": 'sovereign-bonds'");
  });

  it('对新增深链模块保留对应的专属子菜单分发器，而非落入默认窗口', () => {
    ["if (moduleId === 'commodities')", "if (moduleId === 'forex')", "if (moduleId === 'indices')", "if (moduleId === 'economics')"].forEach((branch) => {
      expect(terminal).toContain(branch);
    });
  });
});
