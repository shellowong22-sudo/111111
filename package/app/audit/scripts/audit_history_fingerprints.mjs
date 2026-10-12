import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const currentRoot = path.join(root, 'client/src');
const archiveRoot = path.join(root, 'recovery-evidence/outer-archive-2026-08-26/workspace/client/src');
const outputPath = path.join(root, 'audit/runtime/history-fingerprint-manifest.json');

function files(rootDir, suffix = '.tsx') {
  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) return files(full, suffix);
    return entry.name.endsWith(suffix) ? [full] : [];
  });
}

function rel(rootDir, file) { return path.relative(rootDir, file).split(path.sep).join('/'); }
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function classify(expression) {
  const trimmed = expression.trim();
  if (trimmed.startsWith('`data:') || trimmed.startsWith('"data:') || trimmed.startsWith("'data:")) return 'local-export';
  if (['icsHref', 'icsUrl', 'webcal', 'webcalHref'].includes(trimmed)) return 'subscription';
  if (trimmed === 'item.path' || trimmed.startsWith('`/')) return 'internal';
  return 'external-or-unknown';
}
function inventory(rootDir) {
  const entries = [];
  for (const file of files(rootDir)) {
    const source = readFileSync(file, 'utf8');
    const relative = rel(rootDir, file);
    const dynamic = [...source.matchAll(/href=\{([^}]*)\}/g)].map((match) => ({ file: relative, expression: match[1].trim(), kind: classify(match[1]) }));
    const statics = [...source.matchAll(/href="(https?:\/\/[^"\s]+)"/g)].map((match) => ({ file: relative, href: match[1] }));
    entries.push({ file: relative, sha256: sha256(file), bytes: statSync(file).size, dynamic, statics });
  }
  return entries.sort((a, b) => a.file.localeCompare(b.file));
}

function flatten(entryList, key) { return entryList.flatMap((entry) => entry[key]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))); }
function difference(left, right) {
  const remaining = new Map();
  for (const item of right) { const key = JSON.stringify(item); remaining.set(key, (remaining.get(key) ?? 0) + 1); }
  const out = [];
  for (const item of left) { const key = JSON.stringify(item); const count = remaining.get(key) ?? 0; if (count > 0) remaining.set(key, count - 1); else out.push(item); }
  return out;
}
function diff(current, archived) {
  const currentMap = new Map(current.map((entry) => [entry.file, entry]));
  const archiveMap = new Map(archived.map((entry) => [entry.file, entry]));
  const files = [...new Set([...currentMap.keys(), ...archiveMap.keys()])].sort();
  return files.flatMap((file) => {
    const now = currentMap.get(file); const old = archiveMap.get(file);
    if (!old) return [{ file, kind: 'added', currentSha256: now.sha256 }];
    if (!now) return [{ file, kind: 'removed', archiveSha256: old.sha256 }];
    return now.sha256 === old.sha256 ? [] : [{ file, kind: 'modified', archiveSha256: old.sha256, currentSha256: now.sha256 }];
  });
}

const current = inventory(currentRoot);
const archived = inventory(archiveRoot);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  currentRoot: 'client/src',
  archiveRoot: 'recovery-evidence/outer-archive-2026-08-26/workspace/client/src',
  currentFiles: current.map(({ file, sha256, bytes }) => ({ file, sha256, bytes })),
  archiveFiles: archived.map(({ file, sha256, bytes }) => ({ file, sha256, bytes })),
  fileDiff: diff(current, archived),
  dynamicHrefDiff: (() => { const now = flatten(current, 'dynamic').filter((item) => item.kind !== 'local-export'); const old = flatten(archived, 'dynamic').filter((item) => item.kind !== 'local-export'); return { currentOnly: difference(now, old), archiveOnly: difference(old, now) }; })(),
  staticHrefDiff: (() => { const now = flatten(current, 'statics'); const old = flatten(archived, 'statics'); return { currentOnly: difference(now, old), archiveOnly: difference(old, now) }; })(),
  review: {
    status: 'registered_drift',
    purpose: '保留历史归档的真实性，同时登记后续用户功能新增、审计入口和来源链接变化；不通过覆盖当前代码或修改历史字节来掩盖差异。',
    decision: '当前工作副本保留；归档只读；每次历史差异必须进入本清单并可由文件 SHA-256、动态来源和静态来源清单复核。',
  },
};
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, currentFiles: current.length, archiveFiles: archived.length, fileDiff: manifest.fileDiff.length, dynamicCurrentOnly: manifest.dynamicHrefDiff.currentOnly.length, dynamicArchiveOnly: manifest.dynamicHrefDiff.archiveOnly.length, staticCurrentOnly: manifest.staticHrefDiff.currentOnly.length, staticArchiveOnly: manifest.staticHrefDiff.archiveOnly.length }, null, 2));
