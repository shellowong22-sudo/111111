import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const shard = process.argv[2];
const shards = {
  'index-extension': {
    purpose: '指数原工作区保留、24 个专属分派与关键组件交互。',
    command: 'pnpm vitest run server/indexDistinctExtension.test.ts server/indexDistinctExtension.interaction.test.tsx --reporter=dot && node audit/scripts/audit_index_extension_uniqueness.mjs',
  },
  'portfolio-extension': {
    purpose: '投资组合/风险原工作区隔离、24 个专属分派与关键组件交互。',
    command: 'pnpm vitest run server/portfolioRiskDistinctExtension.test.ts server/portfolioRiskDistinctExtension.interaction.test.tsx --reporter=dot && node audit/scripts/audit_portfolio_extension_uniqueness.mjs',
  },
  'admin-navigation': {
    purpose: '管理员入口公开可见、路由保护与 OAuth 安全回跳。',
    command: 'pnpm vitest run server/terminalCommandBar.admin-menu.test.ts server/oauthStateReturnPath.test.ts --reporter=dot',
  },
  'mobile-shell': {
    purpose: '窄屏首帧断点状态与终端侧栏默认状态。',
    command: 'pnpm vitest run server/useMobile.test.tsx --reporter=dot',
  },
  'imported-market-data': {
    purpose: '已导入行情快照与历史曲线相关契约；不请求外部行情。',
    command: 'pnpm vitest run server/market.test.ts server/treasuryHistoricalCurve.test.ts server/treasuryDailyYieldEvidence.test.ts --reporter=dot',
  },
};

if (!shard || !(shard in shards)) {
  console.error(`用法：node audit/scripts/run_recovery_shard.mjs <${Object.keys(shards).join('|')}>`);
  process.exit(2);
}

const selected = shards[shard];
const startedAt = new Date().toISOString();
const result = spawnSync(selected.command, { cwd: root, shell: true, encoding: 'utf8', timeout: 120_000 });
const finishedAt = new Date().toISOString();
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
const status = result.status === 0 && !result.error ? '通过' : '失败';
const reportDir = resolve(root, 'audit/runtime/check-shards');
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, `${shard}.md`);
writeFileSync(reportPath, `# 恢复检查分片：${shard}\n\n| 项目 | 内容 |\n|---|---|\n| 目的 | ${selected.purpose} |\n| 开始时间 | ${startedAt} |\n| 结束时间 | ${finishedAt} |\n| 结果 | ${status} |\n| 命令 | \`${selected.command}\` |\n\n## 原始输出\n\n\`\`\`text\n${output}\n\`\`\`\n`);
console.log(JSON.stringify({ shard, status, reportPath, exitCode: result.status ?? 1 }));
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
