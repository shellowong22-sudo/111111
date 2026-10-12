import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const registryPath = resolve(projectRoot, 'shared/adminDataModules.ts');
const outputDir = resolve(projectRoot, 'audit/backend-only');
const source = await readFile(registryPath, 'utf8');

const factories = {
  market: { domain: '行情与市场', group: 'market_snapshot', target: 'market_data', sourceKind: 'real', canRefresh: true, canSchedule: true },
  rates: { domain: '利率与曲线', group: 'request_time_read', target: '既有按请求读取', sourceKind: 'none', canRefresh: false, canSchedule: false },
  credit: { domain: '信用与固收', group: 'simulation_control', target: '原模块模拟/受限数据边界', sourceKind: 'simulated', canRefresh: false, canSchedule: false },
  derivatives: { domain: '衍生品', group: 'simulation_control', target: '原模块模拟/受限数据边界', sourceKind: 'simulated', canRefresh: false, canSchedule: false },
  research: { domain: '宏观与研究', group: 'request_time_read', target: '原模块既有研究读取', sourceKind: 'none', canRefresh: false, canSchedule: false },
  news: { domain: '新闻与研究', group: 'news_review_pipeline', target: 'admin_news_ingestion_articles', sourceKind: 'real', canRefresh: true, canSchedule: true },
  workflow: { domain: '交易与工作流', group: 'no_server_contract', target: '无安全的共享写入目标', sourceKind: 'none', canRefresh: false, canSchedule: false },
  funds: { domain: '基金与组合', group: 'simulation_control', target: '原模块模拟/受限数据边界', sourceKind: 'simulated', canRefresh: false, canSchedule: false },
  system: { domain: '系统数据', group: 'no_server_contract', target: '无安全的共享写入目标', sourceKind: 'none', canRefresh: false, canSchedule: false },
};

const records = [];
const pattern = /(market|rates|credit|derivatives|research|news|workflow|funds|system)\('([^']+)', '([^']+)', '([^']+)'/g;
for (const match of source.matchAll(pattern)) {
  const [, factory, moduleId, moduleName, path] = match;
  const contract = factories[factory];
  records.push({ moduleId, moduleName, path, factory, ...contract });
}

if (!records.length) throw new Error('ADMIN_MODULE_REGISTRY_PARSE_EMPTY');
const seen = new Set();
for (const record of records) {
  if (seen.has(record.moduleId)) throw new Error(`ADMIN_MODULE_ID_DUPLICATE:${record.moduleId}`);
  seen.add(record.moduleId);
}

const generatedAt = new Date().toISOString();
const summary = Object.values(factories).map((factory) => ({
  deliveryGroup: factory.group,
  modules: records.filter((record) => record.group === factory.group).length,
  target: factory.target,
  canRefresh: factory.canRefresh,
  canSchedule: factory.canSchedule,
})).filter((item, index, items) => items.findIndex((other) => other.deliveryGroup === item.deliveryGroup) === index);

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'admin-module-ledger.json'), JSON.stringify({ generatedAt, source: 'shared/adminDataModules.ts', moduleCount: records.length, summary, records }, null, 2));
const columns = ['moduleId', 'moduleName', 'path', 'domain', 'group', 'target', 'sourceKind', 'canRefresh', 'canSchedule'];
const quote = (value) => String(value).includes('\t') || String(value).includes('"') ? `"${String(value).replaceAll('"', '""')}"` : String(value);
await writeFile(resolve(outputDir, 'admin-module-ledger.tsv'), [columns.join('\t'), ...records.map((record) => columns.map((column) => quote(record[column])).join('\t'))].join('\n') + '\n');
console.log(JSON.stringify({ moduleCount: records.length, summary }, null, 2));
