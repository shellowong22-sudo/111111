# 基准静态审计索引

该索引由 `audit/scripts/generate_static_inventory.sh` 针对 `_baseline_archive/project/` 生成。它不读取恢复层作为业务事实来源，因而可用于在实施和测试后复核页面、路由、菜单、接口域、测试与数据相关文件是否仍完整保留。

| 文件 | 目的 |
| --- | --- |
| `audit/inventory/routes.tsv` | 从原 `App.tsx` 提取的路径与组件或守卫映射。 |
| `audit/inventory/pages.tsv` | 原始页面源文件清单。 |
| `audit/inventory/menu-components.tsv` | 原始菜单及导航组件清单。 |
| `audit/inventory/api-router-domains.tsv` | 服务端顶层业务路由域及其源模块。 |
| `audit/inventory/tests.tsv` | 原始自动化测试文件清单。 |
| `audit/inventory/data-boundary-files.tsv` | 行情、宏观、新闻、曲线与公开数据相关源码候选清单。 |
| `audit/inventory/summary.tsv` | 以上清单的规模统计。 |

这些文件只陈述从基准中可直接观察的结构事实。页面级视觉、路由级 HTTP、接口级契约和交互级结果将被分别记录，不能以静态清单替代运行时验收。

