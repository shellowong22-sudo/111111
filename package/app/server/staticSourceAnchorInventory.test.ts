import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const workspaceSourceRoot = resolve(process.cwd(), 'client/src');
// Keep the archive read-only and portable.  This replaces the old
// /home/ubuntu absolute path without changing the audited source tree.
const frozenSourceRoot = resolve(process.cwd(), 'recovery-evidence/outer-archive-2026-08-26/workspace/client/src');
const fingerprintManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'audit/runtime/history-fingerprint-manifest.json'), 'utf8')) as {
  staticHrefDiff: { currentOnly: StaticAnchor[]; archiveOnly: StaticAnchor[] };
};

type StaticAnchor = { file: string; href: string };

function listTsxFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? listTsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

function staticAnchors(root: string): StaticAnchor[] {
  const hrefPattern = /href="(https?:\/\/[^"\s]+)"/g;
  return listTsxFiles(root).flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return [...source.matchAll(hrefPattern)].map((match) => ({ file: relative(root, path), href: match[1] }));
  }).sort((left, right) => `${left.file}|${left.href}`.localeCompare(`${right.file}|${right.href}`));
}

function staticScriptNavigation(root: string): string[] {
  const directExternalNavigation = /window\.open\(\s*['"]https?:\/\/|location\.href\s*=\s*['"]https?:\/\//g;
  return listTsxFiles(root).flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return [...source.matchAll(directExternalNavigation)].map((match) => `${relative(root, path)}:${match.index}`);
  });
}

describe('冻结静态来源锚点清单', () => {
  it('常量 HTTP(S) 来源变化已登记，历史归档保持只读可复核', () => {
    const current = staticAnchors(workspaceSourceRoot);
    const frozen = staticAnchors(frozenSourceRoot);
    const key = (anchor: StaticAnchor) => `${anchor.file.replaceAll('\\', '/')}|${anchor.href}`;
    const currentOnly = new Set(fingerprintManifest.staticHrefDiff.currentOnly.map(key));
    const archiveOnly = new Set(fingerprintManifest.staticHrefDiff.archiveOnly.map(key));
    expect(current.filter((anchor) => !frozen.some((old) => key(old) === key(anchor))).map(key).sort()).toEqual([...currentOnly].sort());
    expect(frozen.filter((anchor) => !current.some((now) => key(now) === key(anchor))).map(key).sort()).toEqual([...archiveOnly].sort());
    expect(current.length - frozen.length).toBe(currentOnly.size - archiveOnly.size);
    expect(current.length).toBeGreaterThan(0);
  });

  it('在工作副本与冻结归档中均不存在常量 HTTP(S) window.open 或 location.href 跳转', () => {
    expect(staticScriptNavigation(workspaceSourceRoot)).toEqual([]);
    expect(staticScriptNavigation(frozenSourceRoot)).toEqual([]);
  });
});
