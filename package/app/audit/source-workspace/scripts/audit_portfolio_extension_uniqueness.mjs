import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const extensionPath = resolve(root, "client/src/components/portfolio/PortfolioRiskDistinctExtension.tsx");
const wrapperPath = resolve(root, "client/src/components/portfolio/PortfolioRiskPreservedModule.tsx");
const mappingPath = resolve(root, "audit/runtime/portfolio-risk-24-tab-mapping.tsv");
const outPath = resolve(root, "audit/runtime/portfolio-risk-uniqueness-audit.json");
const extension = readFileSync(extensionPath, "utf8");
const wrapper = readFileSync(wrapperPath, "utf8");
const lines = readFileSync(mappingPath, "utf8").trim().split("\n");
const [header, ...rows] = lines.map((line) => line.split("\t"));
const entries = rows.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])));
const duplicateTitles = Object.entries(entries.reduce((groups, entry) => {
  const key = entry["独立组件"];
  groups[key] = [...(groups[key] ?? []), entry.tab];
  return groups;
}, {})).filter(([, tabs]) => tabs.length > 1);
const requiredTabs = ["SYS", "PRTU", "BBU", "PORT", "PORT IP", "PDSP", "PORT TE", "PORT VR", "PORT SA", "PORT HD", "PORT CH", "PORT HP", "PORT PA", "PORT TS", "PORT OP", "NL", "EVTS", "PREP", "MIFI", "ALRT", "DRPT", "AUDT", "INTG", "BOND RISK"];
const missingTabs = requiredTabs.filter((tab) => !entries.some((entry) => entry.tab === tab));
const uniqueTasks = new Set(entries.map((entry) => entry["独立组件"])).size;
const missingBoundary = entries.filter((entry) => !entry["明确边界"]?.trim()).map((entry) => entry.tab);
const emptyStateBlock = extension.match(/const emptyStateHints: Record<string, string> = \{([\s\S]*?)\n\};/);
const emptyStateCodes = [...(emptyStateBlock?.[1] ?? "").matchAll(/^\s*(?:'([^']+)'|([A-Z]+)):/gm)].map((match) => match[1] ?? match[2]);
const missingEmptyState = requiredTabs.filter((tab) => !emptyStateCodes.includes(tab));
const result = {
  generatedAt: new Date().toISOString(),
  source: { extensionPath, wrapperPath, mappingPath },
  tabCount: entries.length,
  uniqueTaskCount: uniqueTasks,
  missingTabs,
  emptyStateGuidanceCount: emptyStateCodes.length,
  missingEmptyState,
  duplicateComponentAssignments: duplicateTitles,
  missingBoundary,
  oldUnifiedResearchLayerMounted: wrapper.includes("PortfolioRiskResearchLayer") || wrapper.includes("data-portfolio-risk-research-layer"),
  originalWorkspacePreserved: wrapper.includes('data-preserved-portfolio-workspace="true"'),
  explicitHonestyBoundaries: ["不创建订单", "不发网络请求或伪造连通性", "不抓取或生成新闻", "不构成合规意见"].filter((phrase) => extension.includes(phrase)),
};
result.pass = result.tabCount === 24 && result.missingTabs.length === 0 && result.missingBoundary.length === 0 && result.missingEmptyState.length === 0 && !result.oldUnifiedResearchLayerMounted && result.originalWorkspacePreserved;
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
