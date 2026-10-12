import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { lookup } from "node:dns/promises";
import { readFileSync } from "node:fs";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getAgentReachKnowledgeOverview, ingestAgentReachRead, type AgentReachReadResult } from "./agentReachKnowledge";
import { extractFederalReservePressRelease, isFederalReservePressReleaseUrl } from "./agentReachOfficialNews";

const execFile = promisify(execFileCallback);

export type AgentReachStatus = "available" | "needs_configuration" | "unavailable" | "error" | "not_checked";
export type AgentReachTier = 0 | 1 | 2;

export type AgentReachChannel = {
  id: string;
  name: string;
  description: string;
  tier: AgentReachTier;
  backends: string[];
  capabilities: string[];
  sourceFile: string;
  credentialKeys: string[];
  probe: "web" | "rss" | "command" | "config" | "publicHttp";
  commands?: Array<{ command: string; args: string[] }>;
  public: boolean;
};

type ChannelState = {
  status: AgentReachStatus;
  message: string;
  activeBackend: string | null;
  checkedAt: string;
  latencyMs: number | null;
};

type AgentReachState = {
  schemaVersion: 2;
  channels: Record<string, ChannelState>;
  backendOverrides: Record<string, string>;
  lastRefreshAt: string | null;
  cli: AgentReachCliState;
  recentReads: Array<{
    id: string;
    mode: "web" | "rss";
    url: string;
    status: "success" | "failed";
    source: string;
    observedAt: string;
    title: string | null;
    error: string | null;
  }>;
};

type AgentReachCliState = {
  installed: boolean;
  executable: string | null;
  version: string | null;
  lastOperation: "doctor" | "watch" | "version" | "check-update" | "install-check" | null;
  lastRunAt: string | null;
  lastExitCode: number | null;
  lastDurationMs: number | null;
  lastStdout: string;
  lastStderr: string;
  doctor: Record<string, AgentReachDoctorResult> | null;
};

type AgentReachDoctorResult = {
  status?: string;
  name?: string;
  message?: string;
  tier?: number;
  backends?: string[];
  active_backend?: string | null;
  [key: string]: unknown;
};

const APP_ROOT = process.cwd();
const AGENT_REACH_ROOT = path.join(APP_ROOT, "vendor", "Agent-Reach");
const ARCHIVE_PATH = path.join(AGENT_REACH_ROOT, "Agent-Reach-main.zip");
const SOURCE_ROOT = path.join(AGENT_REACH_ROOT, "Agent-Reach-main");
const STATE_ROOT = path.join(APP_ROOT, ".runtime", "agent-reach");
const STATE_PATH = path.join(STATE_ROOT, "state.json");
const AGENT_REACH_VENV = path.join(APP_ROOT, ".venv-agent-reach");
const AGENT_REACH_CLI = process.platform === "win32"
  ? path.join(AGENT_REACH_VENV, "Scripts", "agent-reach.exe")
  : path.join(AGENT_REACH_VENV, "bin", "agent-reach");
const AGENT_REACH_PYTHON = process.platform === "win32"
  ? path.join(AGENT_REACH_VENV, "Scripts", "python.exe")
  : path.join(AGENT_REACH_VENV, "bin", "python");
const AGENT_REACH_ZIP_BRIDGE = path.join(APP_ROOT, "server", "agentReachZipBridge.py");
const XHS_LOCAL_MCP = "http://127.0.0.1:18060";
const MAX_READ_BYTES = 2_000_000;
let stateWriteChain: Promise<void> = Promise.resolve();
let archiveCache: { expiresAt: number; value: AgentReachArchive } | null = null;

export type AgentReachArchive = {
  present: boolean;
  path: string | null;
  sourcePath: string | null;
  sizeBytes: number;
  sha256: string | null;
  sourceFileCount: number;
  readmeExcerpt: string;
  skillExcerpt: string;
};

export const AGENT_REACH_CHANNELS: AgentReachChannel[] = [
  {
    id: "web",
    name: "网页",
    description: "通过 Jina Reader 把公开网页转换为可读文本。",
    tier: 0,
    backends: ["Jina Reader"],
    capabilities: ["公开网页正文", "网页摘要", "结构化可读文本"],
    sourceFile: "agent_reach/channels/web.py",
    credentialKeys: [],
    probe: "web",
    public: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "提取公开视频字幕、元数据与搜索结果。",
    tier: 0,
    backends: ["yt-dlp"],
    capabilities: ["字幕提取", "视频搜索", "视频元数据"],
    sourceFile: "agent_reach/channels/youtube.py",
    credentialKeys: [],
    probe: "command",
    commands: [{ command: "yt-dlp", args: ["--version"] }],
    public: true,
  },
  {
    id: "rss",
    name: "RSS / Atom",
    description: "读取公开 RSS/Atom 源，不需要平台账号。",
    tier: 0,
    backends: ["feedparser"],
    capabilities: ["RSS", "Atom", "增量条目读取"],
    sourceFile: "agent_reach/channels/rss.py",
    credentialKeys: [],
    probe: "rss",
    public: true,
  },
  {
    id: "github",
    name: "GitHub",
    description: "公开仓库、Issue、PR 和搜索；登录后可访问授权范围内内容。",
    tier: 1,
    backends: ["gh CLI"],
    capabilities: ["公开仓库", "Issue/PR", "代码搜索"],
    sourceFile: "agent_reach/channels/github.py",
    credentialKeys: ["GITHUB_TOKEN", "GH_TOKEN"],
    probe: "command",
    commands: [{ command: "gh", args: ["--version"] }],
    public: true,
  },
  {
    id: "bilibili",
    name: "Bilibili",
    description: "通过 bili-cli / OpenCLI 读取公开视频信息。",
    tier: 0,
    backends: ["bili-cli", "OpenCLI", "公开搜索"],
    capabilities: ["视频搜索", "视频详情", "字幕（配置后）"],
    sourceFile: "agent_reach/channels/bilibili.py",
    credentialKeys: [],
    probe: "command",
    commands: [{ command: "bili", args: ["--version"] }, { command: "bili-cli", args: ["--version"] }, { command: "opencli", args: ["--version"] }],
    public: true,
  },
  {
    id: "v2ex",
    name: "V2EX",
    description: "公开主题、节点、回复和用户信息。",
    tier: 0,
    backends: ["V2EX 公开页面"],
    capabilities: ["热门主题", "节点主题", "主题回复", "用户信息"],
    sourceFile: "agent_reach/channels/v2ex.py",
    credentialKeys: [],
    probe: "publicHttp",
    public: true,
  },
  {
    id: "xueqiu",
    name: "雪球",
    description: "股票行情、搜索、热门帖子与热门股票排行。",
    tier: 0,
    backends: ["雪球公开页面"],
    capabilities: ["股票搜索", "行情", "热门帖子", "热门排行"],
    sourceFile: "agent_reach/channels/xueqiu.py",
    credentialKeys: [],
    probe: "publicHttp",
    public: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "公开页面通过 Jina Reader；详情能力需要明确的登录态或 MCP。",
    tier: 2,
    backends: ["LinkedIn MCP", "Jina Reader"],
    capabilities: ["公开页面", "Profile", "公司页", "职位搜索（配置后）"],
    sourceFile: "agent_reach/channels/linkedin.py",
    credentialKeys: [],
    probe: "config",
    public: true,
  },
  {
    id: "boss",
    name: "Boss直聘",
    description: "专用 CDP 浏览器链路；需要用户在受控浏览器中自行登录。",
    tier: 2,
    backends: ["受控 Chrome CDP"],
    capabilities: ["岗位搜索", "职位详情", "JD 全文"],
    sourceFile: "agent_reach/channels/boss.py",
    credentialKeys: [],
    probe: "config",
    public: false,
  },
  {
    id: "twitter",
    name: "Twitter / X",
    description: "twitter-cli、OpenCLI、bird 按优先级路由；登录态由用户自行配置。",
    tier: 2,
    backends: ["twitter-cli", "OpenCLI", "bird"],
    capabilities: ["推文阅读", "推文搜索", "时间线", "长文"],
    sourceFile: "agent_reach/channels/twitter.py",
    credentialKeys: ["TWITTER_AUTH_TOKEN", "TWITTER_CT0"],
    probe: "command",
    commands: [{ command: "twitter", args: ["--version"] }, { command: "opencli", args: ["--version"] }, { command: "bird", args: ["--version"] }],
    public: false,
  },
  {
    id: "reddit",
    name: "Reddit",
    description: "OpenCLI 或 rdt-cli；匿名接口不被标记为可用，需登录态时才解锁。",
    tier: 2,
    backends: ["OpenCLI", "rdt-cli"],
    capabilities: ["帖子搜索", "帖子正文", "评论"],
    sourceFile: "agent_reach/channels/reddit.py",
    credentialKeys: [],
    probe: "command",
    commands: [{ command: "opencli", args: ["--version"] }, { command: "rdt", args: ["--version"] }, { command: "rdt-cli", args: ["--version"] }],
    public: false,
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "OpenCLI 复用用户已登录的 Chrome 会话。",
    tier: 2,
    backends: ["OpenCLI"],
    capabilities: ["搜索", "主页", "Feed", "群组列表"],
    sourceFile: "agent_reach/channels/facebook.py",
    credentialKeys: [],
    probe: "command",
    commands: [{ command: "opencli", args: ["--version"] }],
    public: false,
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "OpenCLI 复用用户已登录的 Chrome 会话。",
    tier: 2,
    backends: ["OpenCLI"],
    capabilities: ["用户搜索", "Profile", "最近帖子", "Explore"],
    sourceFile: "agent_reach/channels/instagram.py",
    credentialKeys: [],
    probe: "command",
    commands: [{ command: "opencli", args: ["--version"] }],
    public: false,
  },
  {
    id: "xiaohongshu",
    name: "小红书",
    description: "OpenCLI / MCP / xhs-cli；不会替用户登录或注入 Cookie。",
    tier: 2,
    backends: ["OpenCLI", "xiaohongshu-mcp", "xhs-cli"],
    capabilities: ["搜索", "阅读", "评论"],
    sourceFile: "agent_reach/channels/xiaohongshu.py",
    credentialKeys: [],
    probe: "command",
    commands: [{ command: "opencli", args: ["--version"] }, { command: "xhs", args: ["--version"] }, { command: "xiaohongshu-mcp", args: ["--version"] }],
    public: false,
  },
  {
    id: "xiaoyuzhou",
    name: "小宇宙播客",
    description: "获取播客音频并通过 Whisper 转录。",
    tier: 2,
    backends: ["Groq Whisper", "OpenAI Whisper"],
    capabilities: ["播客读取", "音频转录"],
    sourceFile: "agent_reach/channels/xiaoyuzhou.py",
    credentialKeys: ["GROQ_API_KEY", "OPENAI_API_KEY"],
    probe: "config",
    public: false,
  },
  {
    id: "exa-search",
    name: "全网语义搜索",
    description: "Exa 经 mcporter/MCP 路由；需要本地 MCP 配置或 Exa Key。",
    tier: 1,
    backends: ["Exa via mcporter", "MCP"],
    capabilities: ["语义搜索", "结果摘要", "研究检索"],
    sourceFile: "agent_reach/channels/exa_search.py",
    credentialKeys: ["EXA_API_KEY"],
    probe: "command",
    commands: [{ command: "mcporter", args: ["--version"] }],
    public: false,
  },
];

const OPERATIONS = [
  { id: "doctor", name: "doctor 环境诊断", detail: "逐渠道真实检查后端、配置和当前路由。" },
  { id: "install", name: "install 安装/检查", detail: "默认只检查；只有显式授权才允许安装系统依赖。" },
  { id: "configure", name: "configure 配置", detail: "配置代理、Token、Cookie、Whisper Key；后台只显示脱敏状态。" },
  { id: "transcribe", name: "transcribe 音视频转写", detail: "Groq/OpenAI Whisper 配置完成后才能执行。" },
  { id: "watch", name: "watch 健康检查", detail: "用于持续观察渠道变化和后端切换。" },
  { id: "skill", name: "skill 管理", detail: "管理 Agent Reach skill 文档，不执行任意上传脚本。" },
  { id: "mcp", name: "MCP 集成", detail: "读取 mcporter.json 的服务名和状态，不返回密钥。" },
  { id: "update", name: "check-update", detail: "检查上游版本；不会静默覆盖本地配置。" },
  { id: "uninstall", name: "uninstall", detail: "仅作为受控运维能力登记，后台不会自动删除用户文件。" },
] as const;

function now() {
  return new Date().toISOString();
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath: string) {
  const digest = createHash("sha256");
  const data = await readFile(filePath);
  digest.update(data);
  return digest.digest("hex");
}

async function countSourceFiles() {
  const result = await execFile(process.platform === "win32" ? "powershell.exe" : "find", process.platform === "win32"
    ? ["-NoProfile", "-Command", `(Get-ChildItem -LiteralPath '${SOURCE_ROOT.replaceAll("'", "''")}' -Recurse -File | Measure-Object).Count`]
    : [SOURCE_ROOT, "-type", "f"]);
  if (process.platform === "win32") {
    const count = Number.parseInt(result.stdout.trim(), 10);
    return Number.isFinite(count) ? count : 0;
  }
  return result.stdout.split(/\r?\n/).filter(Boolean).length;
}

async function readExcerpt(filePath: string, max = 5_000) {
  try {
    return (await readFile(filePath, "utf8")).slice(0, max);
  } catch {
    return "";
  }
}

async function commandVersion(command: string, args: string[] = ["--version"]) {
  try {
    // npm's Windows shim is a .cmd/.ps1, which Node execFile intentionally
    // cannot start directly. Execute the installed JS entry with Node instead
    // of spawning a shell or misreporting the installed CLI as unavailable.
    const appData = process.env.APPDATA;
    const opencliJs = command === "opencli" && process.platform === "win32" && appData
      ? path.join(appData, "npm", "node_modules", "@jackwener", "opencli", "dist", "src", "main.js")
      : null;
    const useJs = Boolean(opencliJs && await exists(opencliJs));
    const result = await execFile(useJs ? process.execPath : command,
      useJs ? [opencliJs!, ...args] : args, { timeout: 4_000, windowsHide: true, maxBuffer: 32 * 1024 });
    return { available: true, version: `${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/)[0].slice(0, 180) };
  } catch {
    return { available: false, version: null };
  }
}

let opencliBridgeCache: { checkedAt: number; available: boolean } | null = null;
async function probeOpencliBridge() {
  if (opencliBridgeCache && Date.now() - opencliBridgeCache.checkedAt < 30_000)
    return { available: opencliBridgeCache.available };
  const appData = process.env.APPDATA;
  const entry = appData && path.join(appData, "npm", "node_modules", "@jackwener", "opencli", "dist", "src", "main.js");
  if (!entry || !await exists(entry)) return { available: false };
  try {
    const result = await execFile(process.execPath, [entry, "doctor"], {
      timeout: 8_000, windowsHide: true, maxBuffer: 32 * 1024,
    });
    const available = /\[OK\]\s+Extension:\s*connected/i.test(`${result.stdout}\n${result.stderr}`);
    opencliBridgeCache = { checkedAt: Date.now(), available };
    return { available };
  } catch {
    opencliBridgeCache = { checkedAt: Date.now(), available: false };
    return { available: false };
  }
}

async function privateCommandVersion(command: string, args: string[] = ["--version"]) {
  const commandPath = path.join(path.dirname(AGENT_REACH_CLI), command + (process.platform === "win32" ? ".exe" : ""));
  if (!(await exists(commandPath))) return { available: false, version: null };
  try {
    const result = await execFile(commandPath, args, {
      timeout: 4_000,
      windowsHide: true,
      maxBuffer: 32 * 1024,
      env: { ...process.env, PATH: `${path.dirname(AGENT_REACH_CLI)}${path.delimiter}${process.env.PATH ?? ""}` },
    });
    return { available: true, version: `${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/)[0].slice(0, 180) };
  } catch {
    return { available: false, version: null };
  }
}

export type AgentReachCliOperation = "doctor" | "watch" | "version" | "check-update" | "install-check";

function agentReachCommandArgs(operation: AgentReachCliOperation) {
  switch (operation) {
    case "doctor":
      return ["doctor", "--json"];
    case "watch":
      return ["watch"];
    case "version":
      return ["version"];
    case "check-update":
      return ["check-update"];
    case "install-check":
      // `install` is intentionally restricted to check-only mode. It must
      // never receive --system from a browser request.
      return ["install", "--safe", "--dry-run"];
  }
}

async function runAgentReachCli(operation: AgentReachCliOperation) {
  const started = Date.now();
  const installed = await exists(AGENT_REACH_CLI);
  if (!installed) {
    return {
      installed: false,
      executable: null as string | null,
      operation,
      exitCode: null as number | null,
      stdout: "",
      stderr: "项目私有 Agent-Reach CLI 未安装；请先在项目环境中安装 vendor/Agent-Reach。",
      durationMs: Date.now() - started,
      doctor: null as Record<string, AgentReachDoctorResult> | null,
    };
  }

  const scriptsPath = path.dirname(AGENT_REACH_CLI);
  try {
    const result = await execFile(
      AGENT_REACH_CLI,
      agentReachCommandArgs(operation),
      {
        timeout: operation === "check-update" || operation === "watch" ? 45_000 : 30_000,
        windowsHide: true,
        maxBuffer: 512 * 1024,
        env: {
          ...process.env,
          // The upstream doctor invokes optional commands by name. Adding the
          // private venv to PATH makes those probes use exactly the ZIP's
          // installed dependencies rather than a global Python installation.
          PATH: `${scriptsPath}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      },
    );
    const stdout = result.stdout.trim();
    const stderr = result.stderr.trim();
    let doctor: Record<string, AgentReachDoctorResult> | null = null;
    if (operation === "doctor") {
      try {
        const parsed = JSON.parse(stdout) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          doctor = parsed as Record<string, AgentReachDoctorResult>;
        }
      } catch {
        // Preserve the actual CLI output; callers can see that JSON parsing
        // failed instead of receiving synthesized channel data.
      }
    }
    return {
      installed: true,
      executable: AGENT_REACH_CLI,
      operation,
      exitCode: 0,
      stdout,
      stderr,
      durationMs: Date.now() - started,
      doctor,
    };
  } catch (error) {
    const commandError = error as { stdout?: string; stderr?: string; code?: number | string };
    return {
      installed: true,
      executable: AGENT_REACH_CLI,
      operation,
      exitCode: typeof commandError.code === "number" ? commandError.code : 1,
      stdout: String(commandError.stdout ?? "").trim(),
      stderr: String(commandError.stderr ?? (error instanceof Error ? error.message : error)).trim(),
      durationMs: Date.now() - started,
      doctor: null as Record<string, AgentReachDoctorResult> | null,
    };
  }
}

function upstreamChannelId(channelId: string) {
  return channelId === "exa-search" ? "exa_search" : channelId;
}

function mapUpstreamStatus(result: AgentReachDoctorResult | undefined): AgentReachStatus | null {
  if (!result?.status) return null;
  if (result.status === "ok") return "available";
  if (result.status === "warn") {
    const message = String(result.message ?? "");
    // Upstream uses "warn" for both missing binaries and installed-but-
    // unconfigured channels. Keep those states distinct in the admin UI.
    if (/未安装|安装.*失败|连接失败|不可达|HTTP Error|timeout/i.test(message)) return "unavailable";
    return "needs_configuration";
  }
  if (result.status === "off") return "unavailable";
  if (result.status === "error") return "error";
  return "not_checked";
}

async function updateChannelStates(
  state: AgentReachState,
  channels: AgentReachChannel[],
  doctor: Record<string, AgentReachDoctorResult> | null,
) {
  const results = await Promise.all(channels.map(async (channel) => {
    const result = await runChannelProbe(channel);
    const credentials = configuredKeys(channel.credentialKeys);
    const missingCredentials = credentials.some((item) => !item.configured);
    const upstream = doctor?.[upstreamChannelId(channel.id)];
    const upstreamStatus = mapUpstreamStatus(upstream);
    // Keep the independent public HTTP/Jina checks as a second proof. The
    // upstream doctor is authoritative for its own command implementation,
    // but a network probe that fails must not be presented as usable.
    const effectiveStatus = channel.id === "youtube" && result.status === "available" ? result.status
      : channel.probe === "command" && upstreamStatus
      ? upstreamStatus
      : result.status === "unavailable" || result.status === "error"
        ? result.status
        : upstreamStatus ?? result.status;
    const needsConfiguration = channel.tier > 0 && channel.credentialKeys.length > 0 && missingCredentials && effectiveStatus === "available";
    const upstreamMessage = upstream?.message ? String(upstream.message).slice(0, 1_000) : null;
    return [channel.id, {
      ...result,
      activeBackend: upstream?.active_backend ? String(upstream.active_backend) : result.activeBackend,
      status: needsConfiguration ? "needs_configuration" : effectiveStatus,
      message: upstreamMessage
        ? `${upstreamMessage}${result.status === "unavailable" && channel.probe !== "command" ? `；本地复核失败：${result.message}` : ""}`
        : needsConfiguration ? `${result.message}；仍缺少可选凭据配置。` : result.message,
      checkedAt: now(),
    }] as const;
  }));
  for (const [channelId, channelState] of results) {
    state.channels[channelId] = channelState;
  }
}

async function getRuntimeSummary() {
  const [python, node, gh, ytDlpGlobal, ytDlpPrivate, mcporter, opencli, xhsMcp, opencliBridge] = await Promise.all([
    commandVersion(process.platform === "win32" ? "python" : "python3"),
    commandVersion("node"),
    commandVersion("gh"),
    commandVersion("yt-dlp"),
    privateCommandVersion("yt-dlp"),
    commandVersion("mcporter"),
    commandVersion("opencli"),
    probeXhsLocalMcp(),
    probeOpencliBridge(),
  ]);
  return { python, node, gh, ytDlp: ytDlpPrivate.available ? ytDlpPrivate : ytDlpGlobal, mcporter, opencli, xhsMcp, opencliBridge };
}

function xhsMcpHeaders(): Record<string, string> {
  const token = process.env.XHS_MCP_AUTH_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function probeXhsLocalMcp() {
  try {
    const response = await fetch(`${XHS_LOCAL_MCP}/health`, {
      redirect: "error", signal: AbortSignal.timeout(2_000),
      headers: xhsMcpHeaders(),
    });
    return { available: response.ok, version: null };
  } catch {
    return { available: false, version: null };
  }
}

async function getMcpSummary() {
  const filePath = path.join(SOURCE_ROOT, "config", "mcporter.json");
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    const servers = payload.mcpServers && typeof payload.mcpServers === "object"
      ? Object.keys(payload.mcpServers as Record<string, unknown>)
      : Object.keys(payload);
    return { present: true, path: filePath, servers, error: null };
  } catch (error) {
    return { present: false, path: filePath, servers: [], error: error instanceof Error ? error.message.slice(0, 180) : String(error) };
  }
}

async function getArchive(): Promise<AgentReachArchive> {
  if (archiveCache && archiveCache.expiresAt > Date.now()) return archiveCache.value;
  const present = await exists(ARCHIVE_PATH);
  const sourcePresent = await exists(SOURCE_ROOT);
  const result: AgentReachArchive = {
    present,
    path: present ? ARCHIVE_PATH : null,
    sourcePath: sourcePresent ? SOURCE_ROOT : null,
    sizeBytes: 0,
    sha256: null,
    sourceFileCount: sourcePresent ? await countSourceFiles() : 0,
    readmeExcerpt: sourcePresent ? await readExcerpt(path.join(SOURCE_ROOT, "README.md")) : "",
    skillExcerpt: sourcePresent ? await readExcerpt(path.join(SOURCE_ROOT, "agent_reach", "skill", "SKILL.md")) : "",
  };
  if (present) {
    const archiveStat = await stat(ARCHIVE_PATH);
    result.sizeBytes = archiveStat.size;
    result.sha256 = await sha256File(ARCHIVE_PATH);
  }
  archiveCache = { expiresAt: Date.now() + 5 * 60_000, value: result };
  return result;
}

function defaultState(): AgentReachState {
  return {
    schemaVersion: 2,
    channels: {},
    backendOverrides: {},
    lastRefreshAt: null,
    cli: {
      installed: false,
      executable: null,
      version: null,
      lastOperation: null,
      lastRunAt: null,
      lastExitCode: null,
      lastDurationMs: null,
      lastStdout: "",
      lastStderr: "",
      doctor: null,
    },
    recentReads: [],
  };
}

async function readState() {
  await mkdir(STATE_ROOT, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(STATE_PATH, "utf8")) as Partial<AgentReachState>;
    return {
      ...defaultState(),
      ...parsed,
      channels: parsed.channels ?? {},
      backendOverrides: parsed.backendOverrides ?? {},
      cli: {
        ...defaultState().cli,
        ...(parsed.cli ?? {}),
      },
      recentReads: Array.isArray(parsed.recentReads) ? parsed.recentReads.slice(0, 50) : [],
    };
  } catch {
    return defaultState();
  }
}

async function writeState(state: AgentReachState) {
  const tempPath = `${STATE_PATH}.${Date.now()}.tmp`;
  stateWriteChain = stateWriteChain.then(async () => {
    await mkdir(STATE_ROOT, { recursive: true });
    await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tempPath, STATE_PATH);
  });
  await stateWriteChain;
}

function configuredKeys(keys: string[]) {
  const configCandidates = [
    process.env.AGENT_REACH_CONFIG,
    path.join(os.homedir(), ".agent-reach", "config.yaml"),
  ].filter((item): item is string => Boolean(item));
  const envConfigured = new Set(Object.keys(process.env).filter((key) => Boolean(process.env[key])));
  let fileText = "";
  for (const candidate of configCandidates) {
    try {
      fileText = readFileSync(candidate, "utf8");
      break;
    } catch {
      // Configuration is optional. Never fail a health report because it is absent.
    }
  }
  return keys.map((key) => ({ key, configured: envConfigured.has(key) || new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "im").test(fileText) }));
}

async function runProbeCommand(definition: AgentReachChannel) {
  const started = Date.now();
  for (const candidate of definition.commands ?? []) {
    try {
      const output = await execFile(candidate.command, candidate.args, { timeout: 4_000, windowsHide: true, maxBuffer: 64 * 1024 });
      const text = `${output.stdout}\n${output.stderr}`.trim().split(/\r?\n/)[0].slice(0, 180);
      return {
        status: "available" as const,
        message: text || `${candidate.command} 可执行`,
        activeBackend: candidate.command,
        latencyMs: Date.now() - started,
      };
    } catch {
      // Try the next candidate. A command existing but failing is not usable.
    }
  }
  return {
    status: "unavailable" as const,
    message: "没有检测到可执行且成功返回的后端；后台不会将其标记为可用。",
    activeBackend: null,
    latencyMs: Date.now() - started,
  };
}

async function runWebProbe() {
  const started = Date.now();
  try {
    const response = await fetch("https://r.jina.ai/http://example.com", { signal: AbortSignal.timeout(8_000), headers: { Accept: "text/plain" } });
    if (!response.ok) return { status: "unavailable" as const, message: `Jina Reader 返回 HTTP ${response.status}`, activeBackend: null, latencyMs: Date.now() - started };
    const body = await response.text();
    return { status: body.trim() ? "available" as const : "error" as const, message: body.trim() ? "Jina Reader 返回了公开网页正文。" : "Jina Reader 返回空正文。", activeBackend: "Jina Reader", latencyMs: Date.now() - started };
  } catch (error) {
    return { status: "unavailable" as const, message: `Jina Reader 不可访问：${error instanceof Error ? error.message.slice(0, 160) : String(error)}`, activeBackend: null, latencyMs: Date.now() - started };
  }
}

async function runPublicHttpProbe(channel: AgentReachChannel) {
  const started = Date.now();
  const target = channel.id === "v2ex" ? "https://www.v2ex.com/api/topics/hot.json" : "https://xueqiu.com/";
  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json, text/html", "User-Agent": "FinanceHub-AgentReach/1.0" },
    });
    if (!response.ok) return { status: "unavailable" as const, message: `${channel.name} 公开端点返回 HTTP ${response.status}`, activeBackend: null, latencyMs: Date.now() - started };
    const body = await response.text();
    if (!body.trim()) return { status: "error" as const, message: `${channel.name} 公开端点返回空响应。`, activeBackend: null, latencyMs: Date.now() - started };
    return { status: "available" as const, message: `${channel.name} 公开端点返回真实响应；具体内容读取仍按 URL 单独验证。`, activeBackend: channel.backends[0] ?? null, latencyMs: Date.now() - started };
  } catch (error) {
    return { status: "unavailable" as const, message: `${channel.name} 公开端点不可访问：${error instanceof Error ? error.message.slice(0, 160) : String(error)}`, activeBackend: null, latencyMs: Date.now() - started };
  }
}

async function runXueqiuProbe() {
  const started = Date.now();
  if (!await exists(AGENT_REACH_PYTHON) || !await exists(AGENT_REACH_ZIP_BRIDGE)) {
    return { status: "unavailable" as const, message: "项目私有 Agent Reach Python 尚未安装。", activeBackend: null, latencyMs: Date.now() - started };
  }
  try {
    const { stdout } = await execFile(AGENT_REACH_PYTHON, [AGENT_REACH_ZIP_BRIDGE, "xueqiu-probe", ""], {
      timeout: 15_000, windowsHide: true, maxBuffer: 20_000,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPATH: SOURCE_ROOT },
    });
    const result = JSON.parse(stdout.trim()) as { ok: boolean };
    return result.ok
      ? { status: "available" as const, message: "ZIP 雪球渠道实际返回了股票行情，已通过读取验证。", activeBackend: "雪球 ZIP 渠道", latencyMs: Date.now() - started }
      : { status: "needs_configuration" as const, message: "ZIP 雪球行情读取失败；需合法会话配置或等待平台恢复。", activeBackend: null, latencyMs: Date.now() - started };
  } catch {
    return { status: "unavailable" as const, message: "雪球实际行情探测失败；未把首页可打开误标为可用。", activeBackend: null, latencyMs: Date.now() - started };
  }
}

async function runChannelProbe(channel: AgentReachChannel) {
  if (channel.probe === "web") return runWebProbe();
  if (channel.id === "xueqiu") return runXueqiuProbe();
  if (channel.probe === "publicHttp") return runPublicHttpProbe(channel);
  if (channel.id === "youtube") {
    const started = Date.now();
    const privateYtDlp = await privateCommandVersion("yt-dlp");
    return {
      status: privateYtDlp.available ? "available" as const : "unavailable" as const,
      message: privateYtDlp.available ? "项目私有 yt-dlp 可执行；搜索时再确认 YouTube 实际返回。" : "项目私有 yt-dlp 未安装或无法执行。",
      activeBackend: privateYtDlp.available ? "yt-dlp" : null,
      latencyMs: Date.now() - started,
    };
  }
  if (channel.probe === "command") return runProbeCommand(channel);
  if (channel.probe === "rss" || channel.probe === "config") {
    if (channel.id === "boss" || channel.id === "linkedin") {
      return {
        status: "needs_configuration" as const,
        message: "该渠道需要用户明确配置受控浏览器会话或 MCP；没有探测到公开免登录能力。",
        activeBackend: null,
        latencyMs: 0,
      };
    }
    return {
      status: "available" as const,
      message: channel.probe === "rss" ? "内置 RSS/Atom 读取链路可用；执行读取时才验证具体来源。" : "公开读取链路已登记；具体站点可用性在读取时验证。",
      activeBackend: channel.backends[0] ?? null,
      latencyMs: 0,
    };
  }
  return { status: "not_checked" as const, message: "尚未执行检查。", activeBackend: null, latencyMs: null };
}

export async function refreshAgentReachChannels(channelId?: string) {
  const state = await readState();
  const channels = channelId ? AGENT_REACH_CHANNELS.filter((channel) => channel.id === channelId) : AGENT_REACH_CHANNELS;
  if (!channels.length) throw new Error("AGENT_REACH_CHANNEL_NOT_FOUND");
  const cli = await runAgentReachCli("doctor");
  state.cli = {
    ...state.cli,
    installed: cli.installed,
    executable: cli.executable,
    version: cli.doctor?.version?.message ?? state.cli.version,
    lastOperation: "doctor",
    lastRunAt: now(),
    lastExitCode: cli.exitCode,
    lastDurationMs: cli.durationMs,
    lastStdout: cli.stdout.slice(0, 200_000),
    lastStderr: cli.stderr.slice(0, 20_000),
    doctor: cli.doctor,
  };
  await updateChannelStates(state, channels, cli.doctor);
  state.lastRefreshAt = now();
  await writeState(state);
  return state;
}

export async function runAgentReachOperation(operation: AgentReachCliOperation) {
  const state = await readState();
  const result = await runAgentReachCli(operation);
  let version = state.cli.version;
  if (operation === "version" && result.stdout) {
    version = result.stdout.split(/\r?\n/)[0].slice(0, 180);
  }
  state.cli = {
    ...state.cli,
    installed: result.installed,
    executable: result.executable,
    version,
    lastOperation: operation,
    lastRunAt: now(),
    lastExitCode: result.exitCode,
    lastDurationMs: result.durationMs,
    lastStdout: result.stdout.slice(0, 200_000),
    lastStderr: result.stderr.slice(0, 20_000),
    doctor: result.doctor ?? state.cli.doctor,
  };
  if (operation === "doctor" && result.doctor) {
    await updateChannelStates(state, AGENT_REACH_CHANNELS, result.doctor);
    state.lastRefreshAt = now();
  }
  await writeState(state);
  return {
    operation,
    installed: result.installed,
    executable: result.executable,
    version,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    doctor: result.doctor,
    ok: result.installed && result.exitCode === 0,
  };
}

function assertSafePublicUrl(input: string) {
  const parsed = new URL(input);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("只允许 http/https 公共网址");
  if (parsed.username || parsed.password) throw new Error("网址不得包含账号或密码");
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !isIP(host)) {
    throw new Error("禁止访问本机或内网地址");
  }
  if (isPrivateAddress(host)) throw new Error("禁止访问本机或内网地址");
  return parsed.toString();
}

function isPrivateAddress(address: string) {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host) === 4) {
    const [a, b, c] = host.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) || (a === 198 && b >= 18 && b <= 19);
  }
  if (isIP(host) === 6) {
    // Reject the whole mapped IPv4 range: ::ffff:7f00:1 and
    // ::ffff:127.0.0.1 are two spellings of the same loopback target.
    if (host.startsWith("::ffff:")) return true;
    return host === "::" || host === "::1" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) ||
      /^ff/.test(host) || /^2001:db8(?::|$)/.test(host);
  }
  return false;
}

export async function assertResolvablePublicUrl(input: string) {
  const safe = assertSafePublicUrl(input);
  const host = new URL(safe).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return safe;
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error("网址 DNS 指向本机或内网，已拒绝访问");
  }
  return safe;
}

async function fetchPublicFeed(input: string) {
  let current = await assertResolvablePublicUrl(input);
  for (let count = 0; count < 5; count += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const target = response.headers.get("location");
    if (!target) throw new Error("RSS 跳转缺少目标地址");
    current = await assertResolvablePublicUrl(new URL(target, current).toString());
  }
  throw new Error("RSS 跳转次数过多");
}

// Node's native fetch is unavailable for this verified official host in some
// Windows installations even when Windows curl can access it. The fallback is
// restricted to one fixed feed and canonical press-release paths; it never
// accepts an arbitrary administrator URL or follows redirects.
async function fetchOfficialBoardContent(url: string) {
  const officialFeed = "https://www.federalreserve.gov/feeds/press_all.xml";
  if (url !== officialFeed && !isFederalReservePressReleaseUrl(url))
    throw new Error("OFFICIAL_SOURCE_URL_NOT_ALLOWLISTED");
  try { return await fetchPublicFeed(url); } catch (error) {
    await assertResolvablePublicUrl(url);
    const { stdout } = await execFile("curl.exe", [
      "--noproxy", "*", "--proto", "=https", "--max-time", "15",
      "--max-filesize", String(MAX_READ_BYTES), "--silent", "--show-error", "--fail", url,
    ], { timeout: 17_000, maxBuffer: MAX_READ_BYTES + 4_096, windowsHide: true });
    if (!stdout.trim()) throw error;
    return new Response(stdout, { status: 200, headers: {
      "content-type": url === officialFeed ? "application/rss+xml" : "text/html",
    } });
  }
}

function extractXmlText(value: string, tag: string, max = 500) {
  const match = value.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, max) ?? "";
}

async function persistAgentReachRead(result: AgentReachReadResult) {
  try {
    return await ingestAgentReachRead(result);
  } catch (error) {
    return {
      status: "unavailable" as const,
      attempted: result.items?.length ?? 1,
      stored: 0,
      deduplicated: 0,
      rejected: 0,
      qualityAverage: null,
      dataBloodIds: [],
      error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    };
  }
}

export async function readAgentReachPublic(input: { mode: "web" | "rss"; url: string }) {
  const url = assertSafePublicUrl(input.url);
  const started = Date.now();
  const state = await readState();
  const readId = `reach_${Date.now().toString(36)}`;
  try {
    if (input.mode === "web") {
      const readerUrl = `https://r.jina.ai/${url}`;
      const response = await fetch(readerUrl, { signal: AbortSignal.timeout(15_000), headers: { Accept: "text/plain" } });
      if (!response.ok) throw new Error(`Jina Reader HTTP ${response.status}`);
      const body = (await response.text()).slice(0, MAX_READ_BYTES);
      const title = body.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 200) ?? null;
      state.recentReads.unshift({ id: readId, mode: "web", url, status: "success", source: "Jina Reader", observedAt: now(), title, error: null });
      state.recentReads = state.recentReads.slice(0, 50);
      await writeState(state);
      const storage = await persistAgentReachRead({
        mode: "web",
        source: "Jina Reader",
        url,
        title,
        content: body,
        observedAt: now(),
      });
      return { id: readId, mode: "web" as const, source: "Jina Reader", url, title, content: body, observedAt: now(), latencyMs: Date.now() - started, storage };
    }
    const response = url === "https://www.federalreserve.gov/feeds/press_all.xml"
      ? await fetchOfficialBoardContent(url) : await fetchPublicFeed(url);
    if (!response.ok) throw new Error(`RSS 源 HTTP ${response.status}`);
    const body = (await response.text()).slice(0, MAX_READ_BYTES);
    if (!/<(?:rss|rdf:RDF|feed)[\s>]/i.test(body.slice(0, 4_096)))
      throw new Error("SOURCE_RESPONSE_NOT_RSS");
    const itemMatches = [...body.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].slice(0, 30);
    const items: Array<{
      title: string; link: string; published: string; summary: string; content: string;
      fields?: Record<string, unknown>;
    }> = itemMatches.map((match) => {
      const chunk = match[2];
      const link = extractXmlText(chunk, "link") || chunk.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || "";
      return {
        title: extractXmlText(chunk, "title"), link,
        published: extractXmlText(chunk, "pubDate") || extractXmlText(chunk, "published") || extractXmlText(chunk, "updated"),
        summary: extractXmlText(chunk, "description") || extractXmlText(chunk, "summary"),
        content: extractXmlText(chunk, "content:encoded", 20_000) || extractXmlText(chunk, "content", 20_000)
          || extractXmlText(chunk, "description", 20_000) || extractXmlText(chunk, "summary", 20_000),
      };
    }).filter((item) => item.title || item.link);
    if (!items.length) throw new Error("响应不是可解析的 RSS/Atom，未生成假数据");
    // The Board's own press releases can be read as full articles: verify
    // canonical article HTML and extract only its actual body paragraphs.
    // Every other RSS publisher remains excerpt-only.
    if (url === "https://www.federalreserve.gov/feeds/press_all.xml") {
      const official = await Promise.all(items.slice(0, 10).map(async item => {
        if (!isFederalReservePressReleaseUrl(item.link)) return item;
        try {
          const articleResponse = await fetchOfficialBoardContent(item.link);
          if (!articleResponse.ok || !/text\/html/i.test(articleResponse.headers.get("content-type") ?? ""))
            return item;
          const extracted = extractFederalReservePressRelease(
            (await articleResponse.text()).slice(0, MAX_READ_BYTES), item.link,
          );
          return extracted && extracted.title === item.title
            ? { ...item, content: extracted.content, fields: {
              verifiedOfficialFullText: true, paragraphCount: extracted.paragraphCount,
              contentRights: "federal-board-original-press-release",
            } } : item;
        } catch { return item; }
      }));
      items.splice(0, official.length, ...official);
    }
    const title = extractXmlText(body, "channel") || extractXmlText(body, "title") || null;
    state.recentReads.unshift({ id: readId, mode: "rss", url, status: "success", source: "RSS/Atom", observedAt: now(), title, error: null });
    state.recentReads = state.recentReads.slice(0, 50);
    await writeState(state);
    const storage = await persistAgentReachRead({
      mode: "rss",
      source: "RSS/Atom",
      url,
      title,
      items: items.map((item) => ({
        title: item.title,
        url: item.link || url,
        published: item.published,
        summary: item.summary,
        content: item.content,
        fields: item.fields,
      })),
      observedAt: now(),
    });
    return { id: readId, mode: "rss" as const, source: "RSS/Atom", url, title, items, observedAt: now(), latencyMs: Date.now() - started, storage };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.recentReads.unshift({ id: readId, mode: input.mode, url, status: "failed", source: input.mode === "web" ? "Jina Reader" : "RSS/Atom", observedAt: now(), title: null, error: message.slice(0, 500) });
    state.recentReads = state.recentReads.slice(0, 50);
    await writeState(state);
    throw new Error(message);
  }
}

export type AgentReachSkillInput =
  | { channelId: "web" | "rss"; input: string }
  | { channelId: "github" | "bilibili" | "youtube"; input: string }
  | { channelId: "xueqiu"; action: "search" | "quote" | "hot-posts" | "hot-stocks"; input: string }
  | { channelId: "xiaohongshu"; input: string }
  | { channelId: "v2ex"; input: string };

type AgentReachExtractedItem = {
  title: string; url: string; summary: string; content?: string;
  published?: string; fields?: Record<string, unknown>;
};

async function runAgentReachZipAdapter(input: Extract<AgentReachSkillInput, { channelId: "xueqiu" | "xiaohongshu" }>) {
  if (!await exists(AGENT_REACH_PYTHON) || !await exists(AGENT_REACH_ZIP_BRIDGE)) {
    throw new Error("AGENT_REACH_PRIVATE_RUNTIME_NOT_INSTALLED");
  }
  if (input.channelId === "xiaohongshu" && !(await commandVersion("opencli")).available) {
    throw new Error("XHS_OPENCLI_NOT_INSTALLED_OR_NOT_CONFIGURED");
  }
  const action = input.channelId === "xueqiu" ? `xueqiu-${input.action}` : "xiaohongshu-search";
  const argument = input.input.trim().slice(0, 180);
  if (["xueqiu-search", "xueqiu-quote", "xiaohongshu-search"].includes(action) && !argument) {
    throw new Error("SEARCH_QUERY_REQUIRED");
  }
  const { stdout } = await execFile(AGENT_REACH_PYTHON, [AGENT_REACH_ZIP_BRIDGE, action, argument], {
    timeout: 35_000, windowsHide: true, maxBuffer: 1_000_000,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPATH: SOURCE_ROOT },
  });
  const payload = JSON.parse(stdout.trim()) as { ok: boolean; error?: string; source?: string; items?: AgentReachExtractedItem[] };
  if (!payload.ok) throw new Error(payload.error ?? "ZIP_CHANNEL_UPSTREAM_UNAVAILABLE");
  const items = (payload.items ?? []).slice(0, 12).filter((item) =>
    Boolean(item.title?.trim() && item.content?.trim()) &&
    /^https:\/\/(?:www\.)?(?:xueqiu\.com|xiaohongshu\.com)\//.test(item.url ?? "")
  );
  if (!items.length) throw new Error(`${input.channelId.toUpperCase()}_EMPTY_RESULT`);
  const observedAt = now();
  const source = payload.source ?? input.channelId;
  const storage = await persistAgentReachRead({
    mode: "rss", url: items[0].url, source, observedAt,
    items: items.map((item) => ({
      title: item.title,
      url: input.channelId === "xiaohongshu" ? item.url.split("?")[0] : item.url,
      summary: item.summary,
      content: item.content, published: item.published, fields: item.fields,
    })),
  });
  return {
    channelId: input.channelId, source,
    items: items.map((item) => ({ ...item, published: item.published ?? "" })),
    storage, observedAt,
  };
}

async function runXhsLocalMcpSearch(query: string) {
  const headers = { ...xhsMcpHeaders(), Accept: "application/json" };
  const login = await fetch(`${XHS_LOCAL_MCP}/api/v1/login/status`, {
    redirect: "error", signal: AbortSignal.timeout(15_000), headers,
  });
  if (!login.ok) throw new Error(`XHS_LOGIN_CHECK_HTTP_${login.status}`);
  const status = await login.json() as { success?: boolean; data?: { is_logged_in?: boolean } };
  if (!status.success || status.data?.is_logged_in !== true) throw new Error("XHS_LOGIN_REQUIRED");
  const response = await fetch(`${XHS_LOCAL_MCP}/api/v1/feeds/search`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(35_000),
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ keyword: query }),
  });
  if (!response.ok) throw new Error(`XHS_SEARCH_HTTP_${response.status}`);
  const payload = JSON.parse((await response.text()).slice(0, 1_000_000)) as {
    success?: boolean; data?: { items?: Array<Record<string, any>>; data?: { items?: Array<Record<string, any>> } };
  };
  if (!payload.success) throw new Error("XHS_SEARCH_UPSTREAM_FAILED");
  const entries = payload.data?.items ?? payload.data?.data?.items ?? [];
  const items: AgentReachExtractedItem[] = entries.slice(0, 12).flatMap((entry) => {
    const note = entry.note_card ?? entry.note ?? entry;
    const id = String(entry.id ?? entry.note_id ?? note.id ?? "");
    const token = String(entry.xsec_token ?? note.xsec_token ?? "");
    const title = String(note.display_title ?? note.title ?? note.desc ?? "").replace(/<[^>]*>/g, " ").trim().slice(0, 180);
    const content = String(note.desc ?? note.content ?? title).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 20_000);
    if (!/^[a-f0-9]{12,32}$/i.test(id) || !token || token.length > 512 || !title || !content) return [];
    return [{
      title, content, summary: content.slice(0, 2_000),
      url: `https://www.xiaohongshu.com/explore/${id}?xsec_token=${encodeURIComponent(token)}&xsec_source=pc_search`,
      fields: {
        author: String(note.user?.nickname ?? "").slice(0, 80),
        likes: note.interact_info?.liked_count ?? null,
        comments: note.interact_info?.comment_count ?? null,
      },
    }];
  });
  if (!items.length) throw new Error("XHS_SEARCH_EMPTY_RESULT");
  const observedAt = now();
  const source = "小红书笔记 / Agent Reach MCP";
  const storage = await persistAgentReachRead({
    mode: "rss", source, observedAt, url: items[0].url.split("?")[0],
    items: items.map((item) => ({
      title: item.title, url: item.url.split("?")[0],
      summary: item.summary, content: item.content, fields: item.fields,
    })),
  });
  return { channelId: "xiaohongshu" as const, source, items: items.map((item) => ({ ...item, published: "" })), storage, observedAt };
}

/**
 * Read-only workbench actions. Each connector is a bounded, server-owned
 * public endpoint. A configured/installed channel is not assumed usable:
 * the result must contain real records and a failed endpoint remains failed.
 */
export async function runAgentReachSkill(input: AgentReachSkillInput) {
  if (input.channelId === "web" || input.channelId === "rss") {
    const result = await readAgentReachPublic({ mode: input.channelId, url: input.input });
    const items = result.mode === "rss"
      ? result.items.map((item) => ({ title: item.title, url: item.link, summary: item.summary, published: item.published }))
      : [{ title: result.title ?? "公开网页", url: result.url, summary: result.content.slice(0, 2_000), published: "" }];
    return { channelId: input.channelId, source: result.source, items, storage: result.storage, observedAt: result.observedAt };
  }
  if (input.channelId === "xiaohongshu" && (await probeXhsLocalMcp()).available) {
    return runXhsLocalMcpSearch(input.input.trim().slice(0, 180));
  }
  if (input.channelId === "xueqiu" || input.channelId === "xiaohongshu") {
    return runAgentReachZipAdapter(input);
  }

  const query = input.input.trim().slice(0, 180);
  if (input.channelId !== "v2ex" && !query) throw new Error("SEARCH_QUERY_REQUIRED");
  if (input.channelId === "youtube") {
    const executable = process.platform === "win32"
      ? path.join(AGENT_REACH_VENV, "Scripts", "yt-dlp.exe")
      : path.join(AGENT_REACH_VENV, "bin", "yt-dlp");
    if (!await exists(executable)) throw new Error("YOUTUBE_YT_DLP_NOT_INSTALLED");
    const { stdout } = await execFile(executable, [
      "--flat-playlist", "--dump-single-json", "--no-warnings", "--skip-download",
      "--socket-timeout", "7", `ytsearch5:${query}`,
    ], { timeout: 20_000, maxBuffer: 2_000_000, windowsHide: true });
    const payload = JSON.parse(stdout) as { entries?: Array<{ id?: string; title?: string; channel?: string; duration?: number; description?: string }> };
    const items = (payload.entries ?? []).filter((entry) => /^[a-zA-Z0-9_-]{11}$/.test(entry.id ?? "")).slice(0, 5).map((entry) => ({
      title: String(entry.title ?? "").slice(0, 180),
      url: `https://www.youtube.com/watch?v=${entry.id}`,
      summary: String(entry.description || entry.channel || entry.title || "").slice(0, 2_000),
      published: "",
    })).filter((item) => item.title);
    if (!items.length) throw new Error("YOUTUBE_EMPTY_RESULT");
    const observedAt = now();
    const storage = await persistAgentReachRead({
      mode: "rss", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      source: "YouTube yt-dlp", observedAt, items,
    });
    return { channelId: "youtube", source: "YouTube yt-dlp", items, storage, observedAt };
  }
  const endpoint = input.channelId === "github"
    ? `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10`
    : input.channelId === "bilibili"
      ? `https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encodeURIComponent(query)}&page=1`
      : "https://www.v2ex.com/api/topics/hot.json";
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/json",
      "User-Agent": "Ucheer-Agent-Reach-Workbench/1.0",
    },
  });
  if (!response.ok) throw new Error(`${input.channelId.toUpperCase()}_UPSTREAM_HTTP_${response.status}`);
  const payload = JSON.parse((await response.text()).slice(0, 1_000_000)) as Record<string, any> | any[];
  let items: Array<{ title: string; url: string; summary: string; published: string }> = [];
  if (input.channelId === "github") {
    if (Array.isArray(payload)) throw new Error("GITHUB_RESPONSE_INVALID");
    items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 10).map((entry: any) => ({
      title: String(entry.full_name ?? "").slice(0, 180),
      url: String(entry.html_url ?? ""),
      summary: String(entry.description ?? entry.full_name ?? "").slice(0, 2_000),
      published: String(entry.updated_at ?? ""),
    }));
  } else if (input.channelId === "bilibili") {
    if (Array.isArray(payload) || payload.code !== 0) throw new Error(`BILIBILI_UPSTREAM_${Array.isArray(payload) ? "INVALID" : payload.code}`);
    const groups = Array.isArray(payload.data?.result) ? payload.data.result : [];
    const videos = groups.find((group: any) => group.result_type === "video")?.data ?? [];
    items = videos.slice(0, 10).map((entry: any) => ({
      title: String(entry.title ?? "").replace(/<[^>]*>/g, "").slice(0, 180),
      url: `https://www.bilibili.com/video/${encodeURIComponent(String(entry.bvid ?? ""))}`,
      summary: String(entry.description ?? entry.title ?? "").replace(/<[^>]*>/g, "").slice(0, 2_000),
      published: Number(entry.pubdate) ? new Date(Number(entry.pubdate) * 1000).toISOString() : "",
    }));
  } else {
    if (!Array.isArray(payload)) throw new Error("V2EX_RESPONSE_INVALID");
    items = payload.slice(0, 15).map((entry: any) => ({
      title: String(entry.title ?? "").slice(0, 180),
      url: String(entry.url ?? ""),
      summary: String(entry.content_rendered ?? entry.content ?? entry.title ?? "").replace(/<[^>]*>/g, "").slice(0, 2_000),
      published: Number(entry.created) ? new Date(Number(entry.created) * 1000).toISOString() : "",
    }));
  }
  items = items.filter((item) => item.title && /^https:\/\//.test(item.url));
  if (!items.length) throw new Error(`${input.channelId.toUpperCase()}_EMPTY_RESULT`);
  const observedAt = now();
  const storage = await persistAgentReachRead({
    mode: "rss",
    url: endpoint,
    source: input.channelId,
    observedAt,
    items: items.map((item) => ({ title: item.title, url: item.url, summary: item.summary, published: item.published })),
  });
  return { channelId: input.channelId, source: input.channelId, items, storage, observedAt };
}

export async function setAgentReachBackend(input: { channelId: string; backend: string }) {
  const channel = AGENT_REACH_CHANNELS.find((item) => item.id === input.channelId);
  if (!channel || !channel.backends.includes(input.backend)) throw new Error("AGENT_REACH_BACKEND_INVALID");
  const state = await readState();
  state.backendOverrides[input.channelId] = input.backend;
  await writeState(state);
  return { channelId: input.channelId, backend: input.backend };
}

export async function getAgentReachDashboard() {
  const [archive, state, runtime, mcp, knowledge] = await Promise.all([getArchive(), readState(), getRuntimeSummary(), getMcpSummary(), getAgentReachKnowledgeOverview()]);
  const configByChannel = Object.fromEntries(AGENT_REACH_CHANNELS.map((channel) => [channel.id, configuredKeys(channel.credentialKeys)]));
  const channels = AGENT_REACH_CHANNELS.map((channel) => ({
    ...channel,
    state: state.channels[channel.id] ?? { status: "not_checked" as const, message: "尚未执行检查。", activeBackend: null, checkedAt: null, latencyMs: null },
    backendOverride: state.backendOverrides[channel.id] ?? null,
    credentials: configByChannel[channel.id],
  }));
  const availableCount = channels.filter((channel) => channel.state.status === "available").length;
  const configuredCount = channels.filter((channel) => channel.credentials.every((item) => item.configured)).length;
  return {
    archive,
    channels,
    operations: OPERATIONS,
    summary: {
      totalChannels: channels.length,
      availableCount,
      unavailableCount: channels.filter((channel) => channel.state.status === "unavailable").length,
      needsConfigurationCount: channels.filter((channel) => channel.state.status === "needs_configuration").length,
      notCheckedCount: channels.filter((channel) => channel.state.status === "not_checked").length,
      configuredCount,
      lastRefreshAt: state.lastRefreshAt,
    },
    recentReads: state.recentReads,
    knowledge,
    runtime,
    mcp,
    cli: state.cli,
    docs: {
      readmeExcerpt: archive.readmeExcerpt,
      skillExcerpt: archive.skillExcerpt,
    },
    security: {
      credentialsReturned: false,
      privateCookieAccess: false,
      arbitraryCommandExecution: false,
      publicUrlOnly: true,
    },
  };
}
