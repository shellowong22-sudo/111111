# 优先股模块原内容保护基线

**审计日期：2026-08-20**  
**保护规则：原菜单、原面板、原字段与既有交互均不可改写；后续仅可在原面板之前或之后追加独立内容。**

## 不可变原始文件指纹

| 文件 | SHA-256 | 保护方式 |
| --- | --- | --- |
| `client/src/components/PreferredStockMenu.tsx` | `e2025786625a40d7001ee7101481594da55b7f61893fefd5a9307560937aa9ad` | 禁止修改 |
| `client/src/components/pf/PFPanels1.tsx` | `6e21ffa5a06191ce2840a8625641b232570fd9d8474287e0f070ccdcd7af65b4` | 禁止修改 |
| `client/src/components/pf/PFPanels2.tsx` | `f8ce2cc3a2611ea6e622aa98c25142b0c1b1ecc9066de784e46682a8601ef186` | 禁止修改 |
| `client/src/components/pf/PFPanels3.tsx` | `a0dd88a861440d7d269782cfed1d436b54f918ab9787510ca0e1718071011893` | 禁止修改 |
| `client/src/pages/Terminal.tsx` | `8d993d29a457a68c7641ec3edab1eca11818271eed28601b6b38a7dfe64cf664` | 仅允许在优先股现有映射的外层追加包装；不得改写原 `prefPanelMap` 条目、标题、键或窗口标识 |

## 23 项菜单—原面板—窗口标识基线

| 序号 | 功能码 | 菜单标识 | 原始组件 | 既有窗口标识 |
| ---: | --- | --- | --- | --- |
| 1 | SECF | `pf-secf` | `PFSECFPanel` | `pf-secf` |
| 2 | PSCH | `pf-psch` | `PFPSCHPanel` | `pf-psch` |
| 3 | WB | `pf-wb` | `PFWBPanel` | `pf-wb` |
| 4 | WEI | `pf-wei` | `PFWEIPanel` | `pf-wei` |
| 5 | FIT | `pf-fit` | `PFFITPanel` | `pf-fit` |
| 6 | QFM | `pf-qfm` | `PFQFMPanel` | `pf-qfm` |
| 7 | EDS | `pf-eds` | `PFEDSPanel` | `pf-eds` |
| 8 | CMA | `pf-cma` | `PFCMAPanel` | `pf-cma` |
| 9 | POR | `pf-por` | `PFPORPanel` | `pf-por` |
| 10 | AIDE | `pf-aide` | `PFAIDEPanel` | `pf-aide` |
| 11 | VIZ | `pf-viz` | `PFVIZPanel` | `pf-viz` |
| 12 | PORD | `pf-pord` | `PFPORDPanel` | `pf-pord` |
| 13 | RPA | `pf-rpa` | `PFRPAPanel` | `pf-rpa` |
| 14 | AID | `pf-aid` | `PFAIDPanel` | `pf-aid` |
| 15 | DAT | `pf-dat` | `PFDATPanel` | `pf-dat` |
| 16 | MDL | `pf-mdl` | `PFMDLPanel` | `pf-mdl` |
| 17 | APP | `pf-app` | `PFAPPPanel` | `pf-app` |
| 18 | INF | `pf-inf` | `PFINFPanel` | `pf-inf` |
| 19 | PRC | `pf-prc` | `PFPRCPanel` | `pf-prc` |
| 20 | CRD | `pf-crd` | `PFCRDPanel` | `pf-crd` |
| 21 | LIQ | `pf-liq` | `PFLIQPanel` | `pf-liq` |
| 22 | CASE | `pf-case` | `PFCASEPanel` | `pf-case` |
| 23 | SOP | `pf-sop` | `PFSOPPanel` | `pf-sop` |

## 追加边界

每个原面板外层将按固定顺序呈现：**原工作区保留展示与非实时边界提示 → 完全未经改写的原面板 → 模块级事实边界 → 终端内深化研究层**。原有菜单项、面板 JSX、原字段、原按钮回调、原名称、编号、顺序和窗口去重标识不得删除、重命名或替换。

## 视觉核验路由备注

主终端实际路由为根路径 `/`。`/terminal` 并未注册，因此对 `/terminal?module=preferred-stock&open=pf-secf` 的 404 仅反映不存在的页面路径，不构成优先股组件或深链调度错误。后续视觉核验统一使用 `/?module=preferred-stock&open=pf-secf`。
