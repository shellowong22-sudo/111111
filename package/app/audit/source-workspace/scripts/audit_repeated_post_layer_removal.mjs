import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const wrappers = [
  ['定价与风险', 'client/src/components/pricing/PricingRiskPreservedRoute.tsx', '<PricingRisk />', /ValuationAutomationLayer/],
  ['投资组合与风险', 'client/src/components/portfolio/PortfolioRiskPreservedModule.tsx', 'data-preserved-portfolio-workspace="true"', /PortfolioRisk(DistinctExtension|DossierPanel|TrendPanel|ResearchLayer)/],
  ['指数', 'client/src/components/index/IndexPreservedModule.tsx', 'data-preserved-index-workspace="true"', /IndexDistinctExtension|index-research-|查看本入口独立工具/],
  ['交易委托簿', 'client/src/components/order-management/OrderManagementPreservedRoute.tsx', '<OrderManagement />', /OrderManagement(ResearchLayer|DistinctExtension)/],
  ['电子交易', 'client/src/components/electronic-trading/ElectronicTradingPreservedRoute.tsx', '<ElectronicTrading/>', /ElectronicTrading(ResearchLayer|DataListExperience|DistinctExtension)/],
  ['STP', 'client/src/components/stp/StpProcessingPreservedRoute.tsx', '<STPProcessing/>', /Stp(PrivateResearchLayer|PrivateTimelineOverlay|DistinctExtension)/],
  ['交易账簿', 'client/src/components/trade-book/TradeBookPreservedRoute.tsx', '<TradeBook/>', /TradeBook(PrivateResearchLayer|DistinctExtension)/],
];
const removed = [
  'client/src/components/pricing/ValuationAutomationLayer.tsx',
  'client/src/components/portfolio/PortfolioRiskDistinctExtension.tsx',
  'client/src/components/portfolio/PortfolioRiskDossierPanel.tsx',
  'client/src/components/portfolio/PortfolioRiskTrendPanel.tsx',
  'client/src/components/portfolio/PortfolioRiskResearchLayer.tsx',
  'client/src/components/index/IndexDistinctExtension.tsx',
  'client/src/components/index/IndexResearchLayer.tsx',
  'client/src/components/order-management/OrderManagementDistinctExtension.tsx',
  'client/src/components/order-management/OrderManagementResearchLayer.tsx',
  'client/src/components/electronic-trading/ElectronicTradingDistinctExtension.tsx',
  'client/src/components/electronic-trading/ElectronicTradingResearchLayer.tsx',
  'client/src/components/electronic-trading/ElectronicTradingDataListExperience.tsx',
  'client/src/components/stp/StpDistinctExtension.tsx',
  'client/src/components/stp/StpPrivateResearchLayer.tsx',
  'client/src/components/stp/StpPrivateTimelineOverlay.tsx',
  'client/src/components/trade-book/TradeBookDistinctExtension.tsx',
  'client/src/components/trade-book/TradeBookPrivateResearchLayer.tsx',
];
const findings = wrappers.map(([name, path, original, repeated]) => {
  const source = read(path);
  const originalPresent = source.includes(original);
  const repeatedAbsent = !repeated.test(source);
  if (!originalPresent || !repeatedAbsent) throw new Error(`${name}: 原工作区=${originalPresent}，重复层已撤回=${repeatedAbsent}`);
  return `| ${name} | 是 | 是 |`;
});
const stale = removed.filter((path) => existsSync(resolve(root, path)));
if (stale.length) throw new Error(`重复文件仍存在：${stale.join('、')}`);
writeFileSync(resolve(root, 'audit/runtime/repeated-post-layer-removal-audit.md'), `# 重复后置层删除审计\n\n| 区域 | 原工作区仍存在 | 统一追加层未挂载 |\n| --- | --- | --- |\n${findings.join('\n')}\n\n已确认删除的统一追加层文件：${removed.length} 个。\n`);
console.log(`通过：${wrappers.length} 个原工作区保留，${removed.length} 个重复追加文件已删除。`);
