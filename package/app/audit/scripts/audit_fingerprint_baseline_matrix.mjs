import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const projectRoot = "/home/ubuntu/finance-hub-recovery";
const outerWorkspace = "/home/ubuntu/finance-hub-recovery-evidence/outer-archive-2026-08-26/workspace";
const nestedArchiveProject = "/home/ubuntu/finance-hub-recovery-evidence/outer-archive-2026-08-26/workspace/_baseline_archive/project";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function hashAt(root, relativePath) {
  const path = join(root, relativePath);
  return existsSync(path) ? sha256(path) : null;
}

const fingerprintTests = walk(join(projectRoot, "server"))
  .filter((path) => /(?:Fingerprint|Preservation|Protection)\.test\.ts$/.test(path));
const rows = [];

for (const testPath of fingerprintTests) {
  const source = readFileSync(testPath, "utf8");
  const entries = [...source.matchAll(/'([^']+)':\s*'([a-f0-9]{64})'/g)];
  for (const [, protectedPath, expectedSha256] of entries) {
    const currentSha256 = hashAt(projectRoot, protectedPath);
    const outerSha256 = hashAt(outerWorkspace, protectedPath);
    const nestedArchiveSha256 = hashAt(nestedArchiveProject, protectedPath);
    rows.push({
      test: relative(projectRoot, testPath),
      path: protectedPath,
      expectedSha256,
      currentSha256,
      outerWorkspaceSha256: outerSha256,
      nestedArchiveProjectSha256: nestedArchiveSha256,
      matchesCurrent: currentSha256 === expectedSha256,
      matchesOuterWorkspace: outerSha256 === expectedSha256,
      matchesNestedArchiveProject: nestedArchiveSha256 === expectedSha256,
      currentMatchesOuterWorkspace: currentSha256 !== null && currentSha256 === outerSha256,
    });
  }
}

const summary = {
  protectedEntries: rows.length,
  currentExpectedMatches: rows.filter((row) => row.matchesCurrent).length,
  outerExpectedMatches: rows.filter((row) => row.matchesOuterWorkspace).length,
  nestedArchiveExpectedMatches: rows.filter((row) => row.matchesNestedArchiveProject).length,
  currentOuterMatches: rows.filter((row) => row.currentMatchesOuterWorkspace).length,
  unmatchedEveryAvailableBaseline: rows.filter((row) => !row.matchesCurrent && !row.matchesOuterWorkspace && !row.matchesNestedArchiveProject).length,
};

const unmatchedEveryAvailableBaseline = rows
  .filter((row) => !row.matchesCurrent && !row.matchesOuterWorkspace && !row.matchesNestedArchiveProject)
  .map(({ test, path, expectedSha256, currentSha256, outerWorkspaceSha256, nestedArchiveProjectSha256 }) => ({ test, path, expectedSha256, currentSha256, outerWorkspaceSha256, nestedArchiveProjectSha256 }));

console.log(JSON.stringify({ auditKind: "fingerprint-baseline-matrix", summary, unmatchedEveryAvailableBaseline, rows }, null, 2));
