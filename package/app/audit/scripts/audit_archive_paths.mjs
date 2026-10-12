import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '../..');
const packageRoot = path.resolve(appRoot, '..');
const outputPath = path.join(appRoot, 'audit/runtime/archive-path-manifest.json');

// Historical reports were produced in a Linux runner.  Keep those names as
// aliases only; all reads in the current Windows/Linux package resolve to the
// portable paths below and never write into the frozen archive.
const mappings = [
  {
    legacy: '/home/ubuntu/finance-hub-recovery',
    current: appRoot,
    currentRelative: '.',
    role: 'current application source',
  },
  {
    legacy: '/home/ubuntu/finance-hub-recovery-evidence/outer-archive-2026-08-26',
    current: path.join(appRoot, 'recovery-evidence/outer-archive-2026-08-26'),
    currentRelative: 'recovery-evidence/outer-archive-2026-08-26',
    role: 'read-only historical archive',
  },
  {
    legacy: '/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql',
    current: path.join(packageRoot, 'database/finance-hub.sql'),
    currentRelative: '../database/finance-hub.sql',
    role: 'read-only database export',
  },
];

function resolveLegacyPath(input) {
  const match = mappings
    .filter((entry) => input === entry.legacy || input.startsWith(`${entry.legacy}/`))
    .sort((a, b) => b.legacy.length - a.legacy.length)[0];
  if (!match) return null;
  const suffix = input.slice(match.legacy.length).replace(/^\//, '');
  return path.join(match.current, suffix);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  platform: process.platform,
  appRoot,
  archiveReadOnly: true,
  mappings: mappings.map((entry) => ({
    ...entry,
    exists: existsSync(entry.current),
  })),
  checks: [
    '/home/ubuntu/finance-hub-recovery/client/src',
    '/home/ubuntu/finance-hub-recovery-evidence/outer-archive-2026-08-26',
    '/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql',
  ].map((legacyPath) => {
    const resolved = resolveLegacyPath(legacyPath);
    return {
      legacyPath,
      resolvedPath: resolved,
      exists: Boolean(resolved && existsSync(resolved)),
    };
  }),
  notes: [
    '历史 Linux 绝对路径只作为可审计别名保留，不作为运行时写入目标。',
    'current application source 可写；历史归档和数据库导出仅用于只读核验。',
    '真实数据库连接由 DATABASE_URL 控制；该清单不会导入、覆盖或删除数据库。',
  ],
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));

// Keep the helper useful to scripts that import it without making the audit
// command itself depend on a specific shell path separator.
export { resolveLegacyPath };
