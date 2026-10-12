import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const workspaceSourceRoot = resolve(process.cwd(), 'client/src');
// The original acceptance run used a Linux absolute path.  Resolve the
// restored, read-only archive relative to this checkout so the same byte
// inventory runs on Windows, Linux, CI and the standalone package.
const frozenSourceRoot = resolve(process.cwd(), 'recovery-evidence/outer-archive-2026-08-26/workspace/client/src');
const fingerprintManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'audit/runtime/history-fingerprint-manifest.json'), 'utf8')) as {
  dynamicHrefDiff: { currentOnly: DynamicHref[]; archiveOnly: DynamicHref[] };
};

type DynamicHref = { file: string; expression: string; kind: 'internal' | 'subscription' | 'external-or-unknown' | 'local-export' };

function listTsxFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? listTsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

function classify(expression: string): DynamicHref['kind'] {
  const trimmed = expression.trim();
  if (trimmed.startsWith('`data:') || trimmed.startsWith('"data:') || trimmed.startsWith("'data:")) return 'local-export';
  if (['icsHref', 'icsUrl', 'webcal', 'webcalHref'].includes(trimmed)) return 'subscription';
  if (trimmed === 'item.path' || trimmed.startsWith('`/')) return 'internal';
  return 'external-or-unknown';
}

function dynamicHrefs(root: string): DynamicHref[] {
  const pattern = /href=\{([^}]*)\}/g;
  return listTsxFiles(root).flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return [...source.matchAll(pattern)].map((match) => ({
      file: relative(root, path),
      expression: match[1].trim(),
      kind: classify(match[1]),
    }));
  }).sort((left, right) => `${left.file}|${left.expression}`.localeCompare(`${right.file}|${right.expression}`));
}

function auditedEntries(entries: DynamicHref[]): DynamicHref[] {
  return entries.filter((entry) => entry.kind !== 'local-export');
}

function fileDistribution(entries: DynamicHref[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((distribution, entry) => {
    distribution[entry.file] = (distribution[entry.file] ?? 0) + 1;
    return distribution;
  }, {});
}

function multisetDifference(left: DynamicHref[], right: DynamicHref[], key: (entry: DynamicHref) => string) {
  const counts = new Map<string, number>();
  right.forEach((entry) => counts.set(key(entry), (counts.get(key(entry)) ?? 0) + 1));
  return left.filter((entry) => {
    const count = counts.get(key(entry)) ?? 0;
    if (count > 0) { counts.set(key(entry), count - 1); return false; }
    return true;
  });
}

describe('冻结动态 href 清单', () => {
  it('逐文件动态 href 差异已登记，归档保持只读可复核', () => {
    const current = auditedEntries(dynamicHrefs(workspaceSourceRoot));
    const frozen = auditedEntries(dynamicHrefs(frozenSourceRoot));
    const key = (entry: DynamicHref) => `${entry.file.replaceAll('\\', '/')}|${entry.expression}|${entry.kind}`;
    const currentOnly = fingerprintManifest.dynamicHrefDiff.currentOnly.map(key);
    const archiveOnly = fingerprintManifest.dynamicHrefDiff.archiveOnly.map(key);
    expect(multisetDifference(current, frozen, key).map(key).sort()).toEqual(currentOnly.sort());
    expect(multisetDifference(frozen, current, key).map(key).sort()).toEqual(archiveOnly.sort());
    expect(current.length - frozen.length).toBe(currentOnly.length - archiveOnly.length);
    expect(Object.keys(fileDistribution(current)).length).toBeGreaterThanOrEqual(31);
  });

  it('保持动态来源数量、分类和差异登记的一致性', () => {
    const entries = auditedEntries(dynamicHrefs(workspaceSourceRoot));
    const count = (kind: DynamicHref['kind']) => entries.filter((entry) => entry.kind === kind).length;
    const archived = auditedEntries(dynamicHrefs(frozenSourceRoot));
    expect(entries.length).toBeGreaterThan(0);
    expect(count('internal') + count('subscription') + count('external-or-unknown')).toBe(entries.length);
    expect(entries.length - archived.length).toBe(fingerprintManifest.dynamicHrefDiff.currentOnly.length - fingerprintManifest.dynamicHrefDiff.archiveOnly.length);
  });
});
