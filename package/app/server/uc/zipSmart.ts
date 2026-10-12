/**
 * zip 智能识别：一个压缩包里通常混着数据表、项目配置、文档、脚本。
 *  - 数据表：csv / json / xlsx 等，过滤掉依赖清单、配置、锁文件、翻译包等“看起来像表但不是数据”的文件
 *  - 文档：README / docs 下的 Markdown → 一张「项目文档」知识表
 *  - 功能脚本：能输出 JSON 的 Python 脚本 → 逐个试跑，能出数据的自动注册为定时数据源
 *  - 推送位置：按表名与字段关键词自动判断应放到终端哪个页面
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readZip, type ZipEntry } from "./zip";
import type { RawTable } from "./parse";

/* ------------------------------------------------------------------ 过滤规则 */
export const JUNK_DIR = /(^|\/)(node_modules|\.git|\.github|\.gitlab|\.vscode|\.idea|\.husky|dist|build|target|out|coverage|\.next|\.nuxt|venv|\.venv|env|__pycache__|site-packages|bower_components|locales?|i18n|translations?|lang|langs|messages|\.cache|\.pytest_cache|\.mypy_cache|cypress|e2e|__tests__|fixtures?|mocks?|__mocks__|snapshots?|assets\/fonts|static\/fonts|\.devcontainer|\.circleci|\.docker|docker|helm|k8s|charts?\/templates|swagger-ui|webjars|META-INF|WEB-INF)\//i;
export const JUNK_FILE = /(^|\/)(requirements[^/]*\.txt|constraints[^/]*\.txt|dev-requirements[^/]*|package(-lock)?\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|tsconfig[^/]*\.json|jsconfig[^/]*\.json|composer\.(json|lock)|[^/]*\.config\.json|\.?eslintrc[^/]*|\.?prettierrc[^/]*|\.?stylelintrc[^/]*|\.babelrc|babel\.config\.json|manifest\.json|vcpkg[^/]*\.json|CMake[^/]*\.json|launch\.json|settings\.json|tasks\.json|extensions\.json|app\.json|renovate\.json|lerna\.json|nx\.json|angular\.json|project\.json|turbo\.json|vercel\.json|netlify\.json|firebase\.json|now\.json|deno\.json|biome\.json|components\.json|openapi[^/]*\.json|swagger[^/]*\.json|schema[^/]*\.json|[^/]*\.schema\.json|license[^/]*|licence[^/]*|changelog[^/]*|notice[^/]*|authors[^/]*|contributors[^/]*|codeowners|robots\.txt|version\.txt|[^/]*\.min\.json|tokenizer[^/]*\.json|vocab[^/]*|merges\.txt|special_tokens_map\.json|added_tokens\.json|config\.json|generation_config\.json|adapter_config\.json|pyproject[^/]*|setup\.cfg|pipfile[^/]*|go\.(mod|sum)|cargo\.(toml|lock)|pom\.xml|[^/]*\.lock|[^/]*-lock\.json|\.env[^/]*|env\.(json|ya?ml)|cmakelists\.txt|dockerfile[^/]*|makefile|[^/]*\.map\.json|[^/]*\.d\.json|i18n[^/]*\.json|[a-z]{2}(-[a-z]{2})?\.json|[a-z]{2}_[A-Z]{2}\.json|messages[^/]*\.json|strings[^/]*\.json|theme[^/]*\.json|icons?[^/]*\.json|fonts?[^/]*\.json|color[^/]*\.json|routes?\.json|menu[^/]*\.json|layout[^/]*\.json|ui\.json|webpack[^/]*|rollup[^/]*|vite[^/]*\.json|jest[^/]*\.json|karma[^/]*|tslint\.json|cspell[^/]*\.json|\.markdownlint[^/]*|mkdocs[^/]*|readthedocs[^/]*|environment\.ya?ml|conda[^/]*)$/i;

const CODE_KEYS = /^(name|version|description|main|module|types|scripts|dependencies|devdependencies|peerdependencies|compileroptions|include|exclude|extends|plugins|rules|env|files|repository|author|license|keywords|bugs|homepage|engines|private|workspaces|type|exports|bin|overrides|resolutions|\$schema|properties|required|definitions|title|id|key|value|label|en|zh|icon|path|component|children|redirect|meta)$/i;

/** 开发工具产物（类型检查基线、代码规范白名单、额度样例、提示词、基准测试夹具等），不是金融数据 */
export const JUNK_TOOLING = /(^|\/)(benchmarks?|bench|perf|evals?|\.claude|\.cursor|prompts?|ci|tools\/ci|golden|testdata|test-data|tests?)\/|(^|\/)[^/]*(baseline|suppressions?|knip|allowlist|provenance|license-inventory|lifecycle|quota\.sample|ratelimits?|docker-build|git-branch|kubectl|_schema|agent_definitions|component_catalog|notebooks?_manifest|eval_cases|example_import|demo_portfolio|resource_docs|tierdefaults|abac|discord-[a-z]+|wreq|native-manifest|eslint|gemini|model-lifecycle)[^/]*\.(json|ya?ml|csv|tsv|txt|toml)$|(^|\/)(context|dedup|filler|structural|ultra|plugin|llm|updates|prompts)\.(json|ya?ml)$/i;

export function isJunkPath(p: string) {
  return JUNK_DIR.test(p) || JUNK_FILE.test(p) || JUNK_TOOLING.test(p);
}

/** 表的第一列大多是源代码文件路径 → 代码统计表，不是数据 */
function looksLikeCodeIndex(t: RawTable) {
  const first = t.columns[0];
  if (!first) return false;
  const vals = t.rows.slice(0, 50).map((r) => String(r[first] ?? ""));
  const hit = vals.filter((v) => /(^|\/)(src|lib|app|packages?|open-sse|scripts?)\/|\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|rb|php|vue|svelte)$/i.test(v)).length;
  return vals.length >= 3 && hit / vals.length > 0.5;
}

/** 解析出来的表是否是真正的数据（至少 2 列 2 行，不是配置键值对） */
export function isUsefulTable(t: RawTable): boolean {
  if (t.rows.length < 2 || t.columns.length < 2) return false;
  if (looksLikeCodeIndex(t)) return false;
  // 列名几乎全是编译器错误码（TS2345 之类）
  if (t.columns.filter((c) => /^(TS|E|W)\d{3,5}$/.test(c)).length / t.columns.length > 0.5) return false;
  const codeLike = t.columns.filter((c) => CODE_KEYS.test(c.trim())).length / t.columns.length;
  if (t.columns.length <= 3 && codeLike >= 0.66) return false;
  // key/value 两列且值几乎全是长文本（翻译包、说明文字）
  if (t.columns.length === 2 && t.columns.includes("key") && t.rows.length > 0) {
    const longText = t.rows.filter((r) => typeof r.value === "string" && /[a-zA-Z一-龥]{3,}\s/.test(String(r.value)) && Number.isNaN(Number(r.value))).length;
    if (longText / t.rows.length > 0.7) return false;
  }
  // 至少一半的列有实际内容
  const filled = t.columns.filter((c) => t.rows.slice(0, 200).some((r) => r[c] !== null && String(r[c]).trim() !== "")).length;
  return filled >= Math.max(2, t.columns.length * 0.5);
}

/* ------------------------------------------------------------------ 文档 */
function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>|]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function docsTable(entries: ZipEntry[], archiveName: string): RawTable | null {
  const docs = entries.filter((e) => !e.isDirectory && /\.(md|markdown|rst)$/i.test(e.name) && !isJunkPath(e.name) && e.size < 400 * 1024 && !/(^|\/)(changelog|license|code_of_conduct|contributing|security|pull_request_template|issue_template)/i.test(e.name));
  docs.sort((a, b) => Number(!/readme/i.test(a.name)) - Number(!/readme/i.test(b.name)) || a.name.split("/").length - b.name.split("/").length);
  const rows = docs.slice(0, 80).map((e) => {
    let text = "";
    try {
      text = e.read().toString("utf8");
    } catch {
      return null;
    }
    const heading = /^#\s+(.+)$/m.exec(text)?.[1]?.replace(/[*_`]/g, "").trim();
    const plain = stripMarkdown(text);
    const summary = plain.split("\n").map((l) => l.trim()).find((l) => l.length > 30) ?? plain.slice(0, 200);
    return {
      标题: (heading || e.name.split("/").pop()!.replace(/\.[^.]+$/, "")).slice(0, 200),
      路径: e.name,
      摘要: summary.slice(0, 400),
      正文: plain.slice(0, 6000),
      字数: plain.length,
    };
  }).filter((r): r is NonNullable<typeof r> => !!r && r.字数 > 40);
  if (!rows.length) return null;
  return { name: `${archiveName} · 项目文档`, columns: ["标题", "路径", "摘要", "正文", "字数"], rows };
}

/* ------------------------------------------------------------------ 自动判断推送位置 */
const SLOT_RULES: Array<[string, RegExp]> = [
  ["fi.rates", /yield|treasury|interest.?rate|\brates?\b|libor|sofr|shibor|curve|bond|利率|收益率|国债|债券|曲线/i],
  ["fi.credit", /credit|spread|rating|\bcds\b|default|信用|评级|违约|利差/i],
  ["eq.fx", /\bfx\b|forex|currenc|exchange.?rate|usd|eur|cny|jpy|gbp|汇率|外汇|货币对/i],
  ["eq.commodity", /commodit|\bgold\b|\bsilver\b|\boil\b|crude|brent|copper|metal|wheat|corn|soy|natural.?gas|商品|黄金|白银|原油|铜|农产品/i],
  ["eq.derivatives", /option|implied.?vol|volatility|\bvix\b|futures?|derivative|greeks|delta|gamma|期权|波动率|期货|衍生/i],
  ["eq.index", /\bindex\b|indices|\betf\b|\bfund\b|指数|基金|etf/i],
  ["eq.stocks", /stock|equit|ticker|symbol|share|ohlc|\bopen\b|\bclose\b|\bhigh\b|\blow\b|volume|market.?cap|\bpe\b|eps|dividend|sector|industry|股票|个股|行情|市值|股价|成交|涨跌|行业|板块/i],
  ["macro.data", /gdp|\bcpi\b|\bppi\b|inflation|unemploy|payroll|macro|economic|\bpmi\b|population|trade.?balance|宏观|经济|就业|通胀|失业|人口|进出口/i],
  ["macro.calendar", /calendar|event|earnings.?date|\bipo\b|schedule|release.?date|日历|事件|发布日/i],
  ["macro.news", /news|article|headline|\btitle\b|content|summary|tweet|sentiment|report|research|新闻|资讯|标题|摘要|舆情|研报|研究/i],
  ["pr.portfolio", /portfolio|weight|allocation|holding|position|backtest|rebalanc|组合|持仓|权重|回测|配置/i],
  ["pr.risk", /\brisk\b|\bvar\b|beta|sharpe|drawdown|stress|pricing|风险|回撤|定价|夏普/i],
  ["tr.orders", /\border\b|orders|execution|\bfill\b|blotter|\bbid\b|\bask\b|订单|委托|成交回报|执行/i],
  ["tr.settlement", /settlement|clearing|ledger|account|transaction|\bbank\b|payment|transfer|counterpart|kyc|结算|清算|账户|流水|银行|支付|转账/i],
  ["tool.ai", /prompt|instruction|question|answer|\bqa\b|label|query|response|completion|training|eval|指令|问答|问题|答案|标注|训练/i],
];

export function guessSlot(name: string, columns: string[]): { slot: string; score: number } {
  const lname = name.toLowerCase();
  const cols = columns.join(" | ").toLowerCase();
  let best = { slot: "tool.board", score: 1 };
  for (const [slot, re] of SLOT_RULES) {
    const g = new RegExp(re.source, "gi");
    const score = (lname.match(g)?.length ?? 0) * 3 + Math.min(6, cols.match(g)?.length ?? 0);
    if (score > best.score) best = { slot, score };
  }
  if (/项目文档/.test(name)) return { slot: "tool.ai", score: 10 };
  return best;
}

/* ------------------------------------------------------------------ 功能脚本 */
export type ZipScript = { file: string; commands: string[]; needsArgs: boolean };

const SCRIPT_SKIP = /(^|\/)(setup|conftest|manage|wsgi|asgi|__init__|__main__|test_[^/]*|[^/]*_test|tests?|migrations?|docs?|examples?|samples?|scripts\/build[^/]*)\.py$|(^|\/)(tests?|migrations?)\//i;

export function findZipScripts(entries: ZipEntry[], known: Set<string>): ZipScript[] {
  const out: ZipScript[] = [];
  for (const e of entries) {
    if (e.isDirectory || !/\.py$/i.test(e.name) || isJunkPath(e.name) || SCRIPT_SKIP.test(e.name) || e.size > 600 * 1024) continue;
    const stem = e.name.split("/").pop()!.replace(/\.py$/i, "");
    if (known.has(stem)) continue; // 系统已有同名数据脚本
    let code = "";
    try {
      code = e.read().toString("utf8");
    } catch {
      continue;
    }
    if (!/__name__\s*==\s*["']__main__["']/.test(code)) continue;
    if (!/json\.dumps?\(|print\(\s*json|to_json\(|orjson/.test(code)) continue;
    if (/input\(|tkinter|PyQt|streamlit|flask|fastapi|uvicorn|while\s+True/.test(code)) continue;
    const commands = new Set<string>();
    for (const m of code.matchAll(/(?:command|cmd|action|mode|func|endpoint)\s*==\s*["']([A-Za-z0-9_\-]{2,40})["']/g)) commands.add(m[1]);
    for (const m of code.matchAll(/add_parser\(\s*["']([A-Za-z0-9_\-]{2,40})["']/g)) commands.add(m[1]);
    for (const m of code.matchAll(/["']([a-z][a-z0-9_\-]{2,40})["']\s*:\s*(?:get_|fetch_|lambda)/g)) commands.add(m[1]);
    const needsArgs = /sys\.argv\[\s*[2-9]\s*\]|required\s*=\s*True/.test(code);
    out.push({ file: e.name, commands: [...commands].slice(0, 3), needsArgs });
  }
  // 优先：带“data/api/fetch/market”等字样的数据脚本
  out.sort((a, b) => Number(!/data|api|fetch|market|price|quote|econ|macro|fund|stock|bond|fx|crypto/i.test(a.file)) - Number(!/data|api|fetch|market|price|quote|econ|macro|fund|stock|bond|fx|crypto/i.test(b.file)));
  return out;
}

/** 把 zip 解压到目录（只解一次；路径做穿越检查） */
export async function extractZipTo(buf: Buffer, dir: string, filter: (name: string) => boolean = () => true) {
  const marker = path.join(dir, ".extracted");
  if (existsSync(marker)) return;
  await mkdir(dir, { recursive: true });
  for (const e of readZip(buf)) {
    if (e.isDirectory || !filter(e.name) || e.size > 50 * 1024 * 1024) continue;
    const target = path.resolve(dir, e.name);
    if (!target.startsWith(path.resolve(dir) + path.sep)) continue;
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await writeFile(target, e.read());
    } catch {
      /* 单个文件失败不影响 */
    }
  }
  await writeFile(marker, new Date().toISOString());
}

export async function listFilesRecursive(dir: string, depth = 0): Promise<string[]> {
  if (depth > 8 || !existsSync(dir)) return [];
  const out: string[] = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...(await listFilesRecursive(p, depth + 1)));
    else out.push(p);
  }
  return out;
}

export async function readText(p: string) {
  return readFile(p, "utf8");
}
