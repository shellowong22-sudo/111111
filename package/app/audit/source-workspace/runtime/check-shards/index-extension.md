# 恢复检查分片：index-extension

| 项目 | 内容 |
|---|---|
| 目的 | 指数原工作区保留、24 个专属分派与关键组件交互。 |
| 开始时间 | 2026-08-26T09:49:29.993Z |
| 结束时间 | 2026-08-26T09:49:31.503Z |
| 结果 | 通过 |
| 命令 | `pnpm vitest run server/indexDistinctExtension.test.ts server/indexDistinctExtension.interaction.test.tsx --reporter=dot && node audit/scripts/audit_index_extension_uniqueness.mjs` |

## 原始输出

```text
RUN  v2.1.9 /home/ubuntu/finance-hub-recovery

 ✓ server/indexDistinctExtension.test.ts (3 tests) 2ms
 ✓ server/indexDistinctExtension.interaction.test.tsx (6 tests) 141ms

 Test Files  2 passed (2)
      Tests  9 passed (9)
   Start at  09:49:30
   Duration  771ms (transform 71ms, setup 0ms, collect 129ms, tests 143ms, environment 361ms, prepare 70ms)

{"generatedAt":"2026-08-26T09:49:31.498Z","tabCount":24,"missingTabs":[],"dedicatedDispatchCount":24,"missingDedicatedDispatch":[],"duplicateDedicatedComponents":[],"undefinedDedicatedComponents":[],"mappingRowCount":24,"missingMappingTabs":[],"malformedMappingRows":0,"externalDataCallMarkers":[],"missingDistinctTitles":[],"legacySharedTemplates":[],"oldUnifiedResearchLayerMounted":false,"originalWorkspacePreserved":true,"eventArchivePreserved":true,"officialWeightToolsPreserved":true,"distinctLayerMounted":true,"pass":true}
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides". See https://pnpm.io/settings for the new home of each setting.
```
