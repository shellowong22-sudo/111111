import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type GlobalApiCandidateStatus = "public_candidate" | "key_or_account" | "licensed" | "non_official";
export type GlobalApiCandidate = {
  recordNumber: number;
  name: string;
  status: GlobalApiCandidateStatus;
  capability: string;
  source: "user-provided-catalog";
};

const CATALOG_PATH = resolve(process.cwd(), "data/global-api-catalog-1000.txt");
const RECORD_PATTERN = /(?<!\d)(\d{1,4})｜([^｜\r\n]+)｜(✅|💰|🔒|⚠️)｜([^\r\n]*?)(?=\s+\d{1,4}｜|\r?\n|$)/g;

function statusFor(marker: string): GlobalApiCandidateStatus {
  if (marker === "💰") return "key_or_account";
  if (marker === "🔒") return "licensed";
  if (marker === "⚠️") return "non_official";
  return "public_candidate";
}

function normalizeName(name: string) {
  return name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function readCandidates(): GlobalApiCandidate[] {
  if (!existsSync(CATALOG_PATH)) return [];
  const raw = readFileSync(CATALOG_PATH, "utf8");
  const output: GlobalApiCandidate[] = [];
  for (const match of raw.matchAll(RECORD_PATTERN)) {
    const recordNumber = Number(match[1]);
    const name = match[2].trim();
    const capability = match[4].trim();
    if (!Number.isInteger(recordNumber) || !name || !capability) continue;
    output.push({ recordNumber, name, capability, status: statusFor(match[3]), source: "user-provided-catalog" });
  }
  return output.sort((a, b) => a.recordNumber - b.recordNumber);
}

const allCandidates = readCandidates();
const uniqueByName = new Map<string, GlobalApiCandidate>();
for (const candidate of allCandidates) {
  const key = normalizeName(candidate.name);
  if (!uniqueByName.has(key)) uniqueByName.set(key, candidate);
}

export const GLOBAL_API_CANDIDATES = [...uniqueByName.values()];
export const GLOBAL_API_CANDIDATE_SUMMARY = {
  sourceRecordCount: allCandidates.length,
  uniqueCandidateCount: GLOBAL_API_CANDIDATES.length,
  duplicateRecordCount: Math.max(allCandidates.length - GLOBAL_API_CANDIDATES.length, 0),
  publicCandidates: GLOBAL_API_CANDIDATES.filter(item => item.status === "public_candidate").length,
  keyOrAccount: GLOBAL_API_CANDIDATES.filter(item => item.status === "key_or_account").length,
  licensed: GLOBAL_API_CANDIDATES.filter(item => item.status === "licensed").length,
  nonOfficial: GLOBAL_API_CANDIDATES.filter(item => item.status === "non_official").length,
  configured: 0,
  sourcePath: "data/global-api-catalog-1000.txt",
  boundary: "清单登记、去重、授权分级与实际连接分离；候选项没有凭据和成功观察时不得进入可用行情。",
};

export function assertGlobalApiCandidateCatalog() {
  if (GLOBAL_API_CANDIDATE_SUMMARY.sourceRecordCount < 1) throw new Error("GLOBAL_API_CANDIDATE_SOURCE_EMPTY");
  if (new Set(GLOBAL_API_CANDIDATES.map(item => normalizeName(item.name))).size !== GLOBAL_API_CANDIDATES.length) throw new Error("GLOBAL_API_CANDIDATE_NAME_DUPLICATE");
  return true;
}
