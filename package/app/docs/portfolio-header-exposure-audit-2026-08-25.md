# 投资组合顶部暴露入口栏核对

用户提供的原始截图尺寸为 2678×76，已按从左至右顺序切分并阅读。前两段确认该行是独立的绿色功能入口栏，而非投资组合原工作区正文。

| 截图区段 | 已核对的入口标签 |
|---|---|
| 左侧 | `SYS`、`PRTU`、`BBU`、`PORT`、`PORT IP` |
| 左中 | `PDSP`、`PORT TE`、`PORT VR`、`PORT S…` |
| 中部 | `PORT SA`、`PORT HD`、`PORT CH`、`PORT HP`、`PORT PA`、`PORT TS`、`PORT OP`、`NL` |
| 右侧 | `EVTS`、`PREP`、`MIFI`、`ALRT`、右侧还有未完整显示的后续入口 |

其中 `PORT VR` 为当前高亮入口。该截图对应 `PortfolioManagementPanel.tsx` 的顶部 `nav`（原标识为“投资组合工作台功能”）；现已删除该可见入口栏的渲染，不改动原投资组合页面正文、字段、当前面板标题或由主终端传入的功能码映射。
