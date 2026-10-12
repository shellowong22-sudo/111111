# 原始 ZIP 只读基线

本项目以用户上传的 `finance-hub-recovery-complete-recovery-2026-08-26.zip` 为唯一业务基准。原始归档保留在 `/home/ubuntu/upload/`，恢复工作区不会写入、替换或重新压缩该文件。为进行源码审计而生成的提取副本位于 `_baseline_archive/`；该目录及其内容已撤销写权限，工作实现仅会出现在项目根目录的恢复层和审计目录中。

| 项目 | 已验证状态 |
| --- | --- |
| 原始归档 SHA-256 | `77fff7cd8522a006e708d92f5f67cde15e87708771c3d2aac44e7203cb1f86a4` |
| 原始归档大小 | `33,132,901` bytes |
| ZIP 完整性检查 | 已通过 |
| 不安全路径条目 | `0` |
| ZIP 内符号链接条目 | `0` |
| 顶层内容 | `project/`、`source/` |
| 归档条目数 | `1,851` |
| 只读提取副本 | 已创建，含 `1,789` 个文件和 `63` 个目录 |
| 嵌套原始交付归档 | `source/finance-hub-complete-delivery.zip`，待纳入逐项审计 |

完整的归档条目清单、提取副本逐文件 SHA-256、文件体积清单、嵌套归档哈希及生成时间均由 `audit/scripts/create_baseline_manifest.sh` 生成并写入 `audit/baseline/`。后续阶段会在每一项恢复和验收记录中引用该基线，不会以修改哈希、重写原始副本或删除测试掩盖差异。

