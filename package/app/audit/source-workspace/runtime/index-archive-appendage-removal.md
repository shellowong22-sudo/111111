# 指数公告时间轴追加区删除记录

用户截图显示的重复区域由 `IndexEventWorkspace` 提供 `INDEX ARCHIVE · 公开成分变更时间轴`、公告详情弹窗与详情入口；`IndexCollaborationPanels` 提供账户协作与官方权重导入追加区。它们已从 `IndexPreservedModule` 的运行树移除并删除源文件。

保留范围仅为 `IndexPreservedModule` 的 `children`，即 ZIP 原指数页面和原菜单。包装器不再导入或渲染 `IndexEventWorkspace`、`IndexOfficialWeightImportPanel`、`IndexBasketCollaborationPanel`、`IndexDistinctExtension` 或“查看本入口独立工具”横幅。

验证结果：`server/exposedExtensionRemoval.test.ts` 为 **6/6 通过**；`/index-hub?panel=SECF` 全页抽样中不再出现 `INDEX ARCHIVE`、公告详情弹窗入口或后续账户/权重追加区。
