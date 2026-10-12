# 开发自检脚本
在 app 目录下运行：
- `node scripts/dev-check/syn.cjs client/src/xxx.tsx server/uc/yyy.ts`：语法检查，要求 bad 0
- `python scripts/dev-check/impcheck.py <同样的文件>`：导入/导出检查，要求 bad 0（`finceptCatalog.json` 的默认导入提示可忽略）
- 全量检查导入：`python scripts/dev-check/impcheck.py $(git ls-files "client/src/*.ts*" "server/*.ts")`
