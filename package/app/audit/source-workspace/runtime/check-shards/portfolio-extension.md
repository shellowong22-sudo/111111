# 恢复检查分片：portfolio-extension

| 项目 | 内容 |
|---|---|
| 目的 | 投资组合/风险原工作区隔离、24 个专属分派与关键组件交互。 |
| 开始时间 | 2026-08-26T10:01:43.888Z |
| 结束时间 | 2026-08-26T10:01:45.464Z |
| 结果 | 通过 |
| 命令 | `pnpm vitest run server/portfolioRiskDistinctExtension.test.ts server/portfolioRiskDistinctExtension.interaction.test.tsx --reporter=dot && node audit/scripts/audit_portfolio_extension_uniqueness.mjs` |

## 原始输出

```text
RUN  v2.1.9 /home/ubuntu/finance-hub-recovery

 ✓ server/portfolioRiskDistinctExtension.test.ts (5 tests) 3ms
 ✓ server/portfolioRiskDistinctExtension.interaction.test.tsx (5 tests) 175ms

 Test Files  2 passed (2)
      Tests  10 passed (10)
   Start at  10:01:44
   Duration  861ms (transform 76ms, setup 0ms, collect 173ms, tests 178ms, environment 363ms, prepare 72ms)

{"generatedAt":"2026-08-26T10:01:45.458Z","source":{"extensionPath":"/home/ubuntu/finance-hub-recovery/client/src/components/portfolio/PortfolioRiskDistinctExtension.tsx","wrapperPath":"/home/ubuntu/finance-hub-recovery/client/src/components/portfolio/PortfolioRiskPreservedModule.tsx","mappingPath":"/home/ubuntu/finance-hub-recovery/audit/runtime/portfolio-risk-24-tab-mapping.tsv"},"tabCount":24,"uniqueTaskCount":24,"missingTabs":[],"emptyStateGuidanceCount":24,"missingEmptyState":[],"duplicateComponentAssignments":[],"missingBoundary":[],"oldUnifiedResearchLayerMounted":false,"originalWorkspacePreserved":true,"explicitHonestyBoundaries":["不创建订单","不抓取或生成新闻","不构成合规意见"],"pass":true}
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides". See https://pnpm.io/settings for the new home of each setting.
```
