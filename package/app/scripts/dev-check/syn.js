// 语法检查：node scripts/dev-check/syn.js <文件...>（使用项目 node_modules 里的 typescript）
const path = require('path');
const ts = require(require.resolve('typescript', { paths: [path.resolve(__dirname, '../..')] }));
const fs = require('fs'); let bad = 0;
for (const f of process.argv.slice(2)) {
  const src = fs.readFileSync(f, 'utf8');
  const r = ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: 4, target: 99, module: 99 }, fileName: f });
  if (r.diagnostics.length) { bad++; console.log(f, r.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n') + ' @' + d.start).join('; ')); }
}
console.log('checked', process.argv.length - 2, 'bad', bad);
