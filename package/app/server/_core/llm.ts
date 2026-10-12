import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  maxCompletionTokens?: number;
  max_completion_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const LOCAL_EQUITY_MODEL = "local-equity-editor-v1";

const clampScore = (value: number) =>
  Math.round(Math.min(100, Math.max(0, value)));

const messageText = (message: Message): string =>
  ensureArray(message.content)
    .map(part =>
      typeof part === "string" ? part : part.type === "text" ? part.text : ""
    )
    .filter(Boolean)
    .join("\n");

function localEquityComparison(prompt: string) {
  const rows = prompt
    .split("\n")
    .map(line => {
      const match = line.match(
        /^([A-Z0-9.]+)\(([^)]+)\): 买入([\d.]+)% \| 目标价均值\$([\d.]+) \| 当前价\$([\d.]+) \| 潜在涨幅(-?[\d.]+)% \| 分析师([\d.]+)人$/
      );
      if (!match) return null;
      const [
        ,
        ticker,
        name,
        buyText,
        targetText,
        currentText,
        upsideText,
        analystText,
      ] = match;
      const buy = Number(buyText);
      const target = Number(targetText);
      const current = Number(currentText);
      const upside = Number(upsideText);
      const analysts = Number(analystText);
      const upsideScore = clampScore(((upside + 20) / 60) * 100);
      const coverageScore = clampScore((analysts / 40) * 100);
      const score = clampScore(
        buy * 0.45 + upsideScore * 0.35 + coverageScore * 0.2
      );
      return {
        ticker,
        name,
        buy,
        target,
        current,
        upside,
        analysts,
        upsideScore,
        coverageScore,
        score,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.upside - a.upside ||
        a.ticker.localeCompare(b.ticker)
    );

  if (rows.length < 2) throw new Error("LOCAL_EQUITY_INPUT_INCOMPLETE");

  const comparisons = rows.map((row, index) => ({
    ticker: row.ticker,
    name: row.name,
    score: row.score,
    rank: index + 1,
    strengths: [
      `买入意见占比 ${row.buy.toFixed(0)}%`,
      `一致目标价相对当前价空间 ${row.upside.toFixed(1)}%`,
      `${row.analysts.toFixed(0)} 位分析师覆盖`,
    ],
    weaknesses: [
      row.upside < 0
        ? "一致目标价低于当前价"
        : "缺少财务预测与估值倍数，不能独立验证目标价",
    ],
    verdict: `仅按已提供的一致预期数据计算，综合分 ${row.score}；不构成投资建议。`,
  }));
  const winner = rows[0];
  const metrics = [
    { metric: "买入比例", value: (row: typeof winner) => row.buy },
    { metric: "目标上行", value: (row: typeof winner) => row.upsideScore },
    { metric: "覆盖广度", value: (row: typeof winner) => row.coverageScore },
    {
      metric: "预期一致性",
      value: (row: typeof winner) => clampScore(row.buy * 0.9),
    },
    {
      metric: "风险缓冲",
      value: (row: typeof winner) => clampScore(50 + row.upside),
    },
  ];
  const radarData = metrics.map(metric =>
    Object.fromEntries([
      ["metric", metric.metric],
      ...rows.map(row => [row.ticker, metric.value(row)]),
    ])
  );

  return {
    comparisons,
    winner: winner.ticker,
    winnerReason: `${winner.ticker} 在买入比例、目标价空间和覆盖广度的可核验组合评分中居首。`,
    summary:
      "结果只比较输入的一致预期快照；缺少财务预测、估值倍数和风险情景时，不输出独立投资建议。",
    radarData,
  };
}

function localEquitySummary(prompt: string) {
  const capture = (label: string) =>
    prompt.match(new RegExp(`【${label}】([^\\n]+)`))?.[1]?.trim() ?? "";
  const tickerLine = capture("股票代码");
  const ticker = tickerLine.match(/^[A-Z0-9.]+/)?.[0] ?? tickerLine;
  const rating = capture("最新评级");
  const current = Number(capture("当前价").replace(/[^\d.-]/g, "")) || 0;
  const targetLine = capture("一致目标价均值") || capture("目标价");
  const target = Number(targetLine.match(/\$?([\d.]+)/)?.[1] ?? 0);
  const upside = Number(capture("潜在涨幅").replace(/[^\d.-]/g, "")) || 0;
  const consensus = capture("市场一致预期");
  const buyPct = Number(consensus.match(/买入\s*([\d.]+)%/)?.[1] ?? 0);
  const analysts = Number(consensus.match(/共\s*([\d.]+)\s*位/)?.[1] ?? 0);
  const numeric = (label: string) => {
    const value = Number(
      capture(label)
        .replace(/[^\d.,-]/g, "")
        .replace(/,/g, "")
    );
    return Number.isFinite(value) ? value : 0;
  };
  const marketChangePct = numeric("当期涨跌幅");
  const return5d = numeric("5日收益");
  const return20d = numeric("20日收益");
  const return60d = numeric("60日收益");
  const volatility20d = numeric("20日年化波动率");
  const maxDrawdown = numeric("六个月最大回撤");
  const marketTime = capture("市场时间");
  const source = capture("数据来源");
  const hasRating = Boolean(rating && !/未配置|未知|不可用/.test(rating));
  const hasConsensus = analysts > 0 && target > 0;

  if (!ticker) throw new Error("LOCAL_EQUITY_INPUT_INCOMPLETE");
  const recommendation =
    hasConsensus && buyPct >= 70 && upside >= 10
      ? "buy"
      : hasConsensus && upside < 0
        ? "sell"
        : "hold";
  const keyMetrics = [
    current > 0 ? { label: "当前价", value: `$${current}` } : null,
    target > 0 ? { label: "一致目标价", value: `$${target}` } : null,
    target > 0 ? { label: "目标价空间", value: `${upside.toFixed(1)}%` } : null,
    return20d !== 0
      ? { label: "20日收益", value: `${return20d.toFixed(2)}%` }
      : null,
    volatility20d > 0
      ? { label: "20日年化波动率", value: `${volatility20d.toFixed(2)}%` }
      : null,
    maxDrawdown < 0
      ? { label: "六个月最大回撤", value: `${maxDrawdown.toFixed(2)}%` }
      : null,
    analysts > 0 ? { label: "分析师覆盖", value: `${analysts} 位` } : null,
  ]
    .filter((item): item is { label: string; value: string } => item !== null)
    .slice(0, 4);

  const momentumEvidence = [
    return5d !== 0 ? `5日 ${return5d.toFixed(2)}%` : null,
    return20d !== 0 ? `20日 ${return20d.toFixed(2)}%` : null,
    return60d !== 0 ? `60日 ${return60d.toFixed(2)}%` : null,
  ]
    .filter(Boolean)
    .join("，");

  return {
    investmentThesis: [
      hasRating
        ? `已提供的最新评级为“${rating}”，该结论来自输入快照。`
        : "分析师评级源未接入；本摘要不生成或推断评级。",
      current > 0
        ? `公开行情最新观察为 $${current}，当期变动 ${marketChangePct.toFixed(2)}%。`
        : "输入未提供可核验的行情观察。",
      momentumEvidence
        ? `已观测区间收益：${momentumEvidence}；仅描述价格路径，不代表基本面判断。`
        : "输入未提供足够历史序列以计算多周期收益。",
      target > 0 && current > 0
        ? `一致目标价 $${target} 相对当前价 $${current} 的空间为 ${upside.toFixed(1)}%。`
        : "缺少可核验的当前价或一致目标价，无法计算目标价空间。",
    ],
    targetPriceRationale:
      target > 0
        ? "采用输入的一致目标价作为市场参考；缺少财务预测、P/E、DCF 与 EV/EBITDA 假设，不能作为独立估值。"
        : "缺少可核验目标价与估值输入，不生成替代估值。",
    targetPrice: target,
    catalysts: [
      "等待经授权的分析师评级与目标价来源接入后再更新研究判断",
      "监控下一次公开行情更新是否延续当前多周期价格方向",
    ],
    risks: [
      volatility20d > 0
        ? `20日年化历史波动率为 ${volatility20d.toFixed(2)}%，价格路径存在波动风险`
        : "缺少足够历史序列，无法量化短期波动风险",
      maxDrawdown < 0
        ? `六个月价格序列最大回撤为 ${maxDrawdown.toFixed(2)}%`
        : "未取得可核验的区间回撤数据",
      hasConsensus
        ? "评级与目标价可能滞后于市场和公司基本面变化"
        : "缺少授权评级、目标价、财务预测与估值明细，不能形成投资建议",
    ],
    recommendation,
    timeHorizon: marketTime
      ? `行情观察截至 ${marketTime}`
      : "行情观察时间未提供",
    keyMetrics,
    conclusion: `${ticker} 的摘要仅依据${source || "页面提供的"}行情与一致预期字段生成，不构成投资建议。`,
  };
}

function invokeLocalEquityEditor(params: InvokeParams): InvokeResult {
  const userPrompt = [...params.messages]
    .reverse()
    .find(message => message.role === "user");
  const prompt = userPrompt ? messageText(userPrompt) : "";
  const responseFormat = params.responseFormat ?? params.response_format;
  const schemaName =
    responseFormat?.type === "json_schema"
      ? responseFormat.json_schema.name
      : (params.outputSchema ?? params.output_schema)?.name;
  const result =
    schemaName === "stock_comparison"
      ? localEquityComparison(prompt)
      : schemaName === "report_summary"
        ? localEquitySummary(prompt)
        : (() => {
            throw new Error("LOCAL_EQUITY_SCHEMA_UNSUPPORTED");
          })();

  return {
    id: `local-equity-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: LOCAL_EQUITY_MODEL,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify(result) },
        finish_reason: "stop",
      },
    ],
  };
}

function activeFreeLlmApiUrl(): string {
  // An existing explicitly configured provider always takes precedence.
  if (ENV.llmBaseUrl.trim() || !ENV.freeLlmApiBaseUrl.trim()) return "";
  const url = new URL(ENV.freeLlmApiBaseUrl.trim());
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  if (!["https:", "http:"].includes(url.protocol) || (!loopback && url.protocol !== "https:")
    || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, "") !== "/v1") {
    throw new Error("FREELLMAPI_BASE_URL_INVALID");
  }
  return url.toString().replace(/\/$/, "");
}

function configuredOmniRouteUrl(): string {
  if (!ENV.omniRouteBaseUrl.trim()) return "";
  const url = new URL(ENV.omniRouteBaseUrl.trim());
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (!loopback && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, "") !== "/v1"
  ) {
    throw new Error("OMNIROUTE_BASE_URL_INVALID");
  }
  return url.toString().replace(/\/$/, "");
}

function activeOmniRouteUrl(): string {
  if (ENV.llmBaseUrl.trim()) return "";
  return configuredOmniRouteUrl();
}

/** Admin status never exposes gateway credentials or internal addresses. */
export function freeLlmApiGatewayStatus() {
  if (!ENV.freeLlmApiBaseUrl.trim()) return "not_configured" as const;
  if (ENV.llmBaseUrl.trim()) return "overridden" as const;
  try { activeFreeLlmApiUrl(); } catch { return "invalid_config" as const; }
  return ENV.freeLlmApiKey.trim() ? "configured" as const : "missing_key" as const;
}

export type OmniRouteGatewayInspection = {
  configured: boolean;
  reachable: boolean;
  modelCount: number;
  supportsReasoningPassthrough: boolean;
  quotaStatus: "available" | "unknown" | "unavailable";
  status: "connected" | "overridden" | "unavailable" | "not_configured" | "invalid_config" | "missing_key";
};

/**
 * Probe OmniRoute without exposing its URL, credentials, provider names or
 * quota internals to the browser. The model directory is the only positive
 * connectivity signal; quota remains unknown unless the gateway explicitly
 * reports it.
 */
export async function inspectOmniRouteGateway(): Promise<OmniRouteGatewayInspection> {
  if (!ENV.omniRouteBaseUrl.trim()) {
    return {
      configured: false,
      reachable: false,
      modelCount: 0,
      supportsReasoningPassthrough: false,
      quotaStatus: "unavailable",
      status: "not_configured",
    };
  }
  let baseUrl: string;
  try {
    baseUrl = activeOmniRouteUrl();
  } catch {
    return {
      configured: true,
      reachable: false,
      modelCount: 0,
      supportsReasoningPassthrough: true,
      quotaStatus: "unavailable",
      status: "invalid_config",
    };
  }
  const parsed = new URL(baseUrl);
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname);
  if (!loopback && !ENV.omniRouteApiKey.trim()) {
    return {
      configured: true,
      reachable: false,
      modelCount: 0,
      supportsReasoningPassthrough: true,
      quotaStatus: "unavailable",
      status: "missing_key",
    };
  }
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: ENV.omniRouteApiKey.trim()
        ? { authorization: `Bearer ${ENV.omniRouteApiKey.trim()}` }
        : undefined,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {
        configured: true,
        reachable: false,
        modelCount: 0,
        supportsReasoningPassthrough: true,
        quotaStatus: "unavailable",
        status: "unavailable",
      };
    }
    const catalog = (await response.json()) as { data?: unknown[] };
    return {
      configured: true,
      reachable: true,
      modelCount: Array.isArray(catalog.data) ? catalog.data.length : 0,
      supportsReasoningPassthrough: true,
      quotaStatus: "unknown",
      status: ENV.llmBaseUrl.trim() ? "overridden" : "connected",
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      modelCount: 0,
      supportsReasoningPassthrough: true,
      quotaStatus: "unavailable",
      status: "unavailable",
    };
  }
}

type ActiveGateway = {
  kind: "llm" | "omniroute" | "freellmapi" | "direct";
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ChatGatewayOverride = "freellmapi" | "omniroute" | "ollama";

const resolveGateway = (override?: ChatGatewayOverride): ActiveGateway => {
  if (override === "ollama") {
    // The Ollama adapter only talks to the machine running this backend.
    // No browser-supplied address is accepted.
    return { kind: "direct", baseUrl: "http://127.0.0.1:11434/v1", apiKey: "", model: "" };
  }
  if (override === "freellmapi") {
    const baseUrl = activeFreeLlmApiUrl();
    if (!baseUrl) throw new Error("FREELLMAPI_NOT_CONFIGURED");
    return { kind: "freellmapi", baseUrl, apiKey: ENV.freeLlmApiKey, model: ENV.freeLlmApiModel.trim() || "auto" };
  }
  if (override === "omniroute") {
    const baseUrl = configuredOmniRouteUrl();
    if (!baseUrl) throw new Error("OMNIROUTE_NOT_CONFIGURED");
    return { kind: "omniroute", baseUrl, apiKey: ENV.omniRouteApiKey, model: ENV.omniRouteModel.trim() || "auto" };
  }
  if (ENV.llmBaseUrl.trim()) {
    return {
      kind: "llm",
      baseUrl: ENV.llmBaseUrl.trim().replace(/\/$/, ""),
      apiKey: ENV.llmApiKey,
      model: ENV.llmModel,
    };
  }
  const omniRouteUrl = activeOmniRouteUrl();
  if (omniRouteUrl) {
    return {
      kind: "omniroute",
      baseUrl: omniRouteUrl,
      apiKey: ENV.omniRouteApiKey,
      model: ENV.omniRouteModel.trim() || "auto",
    };
  }
  const freeUrl = activeFreeLlmApiUrl();
  if (freeUrl) {
    return {
      kind: "freellmapi",
      baseUrl: freeUrl,
      apiKey: ENV.freeLlmApiKey,
      model: ENV.freeLlmApiModel.trim() || "auto",
    };
  }
  return { kind: "direct", baseUrl: "http://localhost:4000/v1", apiKey: ENV.llmApiKey, model: "" };
};

export function activeAiGatewayKind() {
  try {
    return resolveGateway().kind;
  } catch {
    return "direct" as const;
  }
}

const resolveApiUrl = (override?: ChatGatewayOverride) => {
  const baseUrl = resolveGateway(override).baseUrl;
  if (baseUrl && baseUrl.trim().length > 0) {
    return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  }
  return "http://localhost:4000/v1/chat/completions";
};

const resolveApiKey = (override?: ChatGatewayOverride) => resolveGateway(override).apiKey;

const isLocalLlmEndpoint = (override?: ChatGatewayOverride) => {
  const configured = resolveGateway(override).baseUrl;
  // Ollama and other OpenAI-compatible local gateways intentionally do not
  // require an API key.  Remote providers still require an explicit secret;
  // this keeps production from silently sending unauthenticated requests.
  if (!configured) return true;
  try {
    const url = new URL(configured);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
};

const assertApiKey = (override?: ChatGatewayOverride) => {
  const gateway = resolveGateway(override);
  if (gateway.kind === "freellmapi" && !gateway.apiKey.trim()) {
    throw new Error("FREELLMAPI_API_KEY_NOT_CONFIGURED");
  }
  if (gateway.kind === "omniroute" && !gateway.apiKey.trim() && !isLocalLlmEndpoint(override)) {
    throw new Error("OMNIROUTE_API_KEY_NOT_CONFIGURED");
  }
  if (!resolveApiKey(override) && !isLocalLlmEndpoint(override)) {
    throw new Error("LLM_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;
const configuredTimeoutMs = Number(
  process.env.LLM_REQUEST_TIMEOUT_MS ?? 30_000
);
const LLM_REQUEST_TIMEOUT_MS = Number.isFinite(configuredTimeoutMs)
  ? Math.min(Math.max(Math.floor(configuredTimeoutMs), 1), 120_000)
  : 30_000;
const configuredCatalogTimeoutMs = Number(
  process.env.LLM_MODEL_CATALOG_TIMEOUT_MS ?? 30_000
);
const LLM_MODEL_CATALOG_TIMEOUT_MS = Number.isFinite(configuredCatalogTimeoutMs)
  ? Math.min(Math.max(Math.floor(configuredCatalogTimeoutMs), 1), 120_000)
  : 30_000;

function timeoutSignal(timeoutMs = LLM_REQUEST_TIMEOUT_MS) {
  return AbortSignal.timeout(timeoutMs);
}

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// Retries non-2xx responses and network errors with exponential backoff, then
// returns the final Response so callers keep their existing error handling.
const fetchWithBackoff = async (
  url: string,
  init: FetchInit,
  timeoutMs = LLM_REQUEST_TIMEOUT_MS
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal ?? timeoutSignal(timeoutMs),
      });
      // Wrong credentials and unknown models cannot recover by retrying; a
      // long retry loop here also prevents Ucheer AI switching to a backup.
      if (response.ok || attempt === RETRY_MAX_RETRIES
        || (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429)) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error("LLM_REQUEST_TIMEOUT");
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("LLM_REQUEST_ABORTED");
      }
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

export async function invokeLLM(params: InvokeParams & { gatewayOverride?: ChatGatewayOverride }): Promise<InvokeResult> {
  if (params.model === LOCAL_EQUITY_MODEL) {
    return invokeLocalEquityEditor(params);
  }
  assertApiKey(params.gatewayOverride);

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
    maxCompletionTokens,
    max_completion_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (model) {
    payload.model = model;
  } else {
    const gateway = resolveGateway(params.gatewayOverride);
    if (gateway.model) payload.model = gateway.model;
  }

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  const resolvedMaxCompletionTokens =
    max_completion_tokens ?? maxCompletionTokens;
  if (typeof resolvedMaxCompletionTokens === "number") {
    payload.max_completion_tokens = resolvedMaxCompletionTokens;
  }

  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (resolveApiKey(params.gatewayOverride)) headers.authorization = `Bearer ${resolveApiKey(params.gatewayOverride)}`;
  const response = await fetchWithBackoff(resolveApiUrl(params.gatewayOverride), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

/**
 * A directory response is not evidence that a model can answer. Probe the
 * active chat route with a small, bounded real completion before advertising
 * it as usable. Never return upstream errors or credentials to the browser.
 */
export async function probeActiveChatModel(model?: string, gatewayOverride?: ChatGatewayOverride): Promise<{ model: string } | null> {
  try {
    assertApiKey(gatewayOverride);
    const requested = model?.trim() || resolveGateway(gatewayOverride).model || "auto";
    const response = await fetch(resolveApiUrl(gatewayOverride), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(resolveApiKey(gatewayOverride) ? { authorization: `Bearer ${resolveApiKey(gatewayOverride)}` } : {}),
      },
      body: JSON.stringify({
        model: requested,
        messages: [{ role: "user", content: "只回复：好" }],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const result = (await response.json()) as Partial<InvokeResult>;
    const content = result.choices?.[0]?.message?.content;
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.filter((part): part is TextContent => part.type === "text").map((part) => part.text).join("")
        : "";
    return text.trim() ? { model: requested } : null;
  } catch {
    return null;
  }
}

/** Discover only a few chat candidates; the returned names are never
 * advertised until probeActiveChatModel has generated a real answer. */
export async function listActiveChatProbeCandidates(limit = 4, gatewayOverride?: ChatGatewayOverride): Promise<string[]> {
  try {
    assertApiKey(gatewayOverride);
    const response = await fetch(`${resolveGateway(gatewayOverride).baseUrl.replace(/\/$/, "")}/models`, {
      headers: resolveApiKey(gatewayOverride) ? { authorization: `Bearer ${resolveApiKey(gatewayOverride)}` } : {},
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return [];
    }
    const result = (await response.json()) as { data?: ModelInfo[] };
    if (!Array.isArray(result.data)) return [];
    return result.data
      .filter((item) => typeof item.id === "string" && item.id.length <= 150 && !item.id.startsWith("auto/"))
      .filter((item) => {
        const type = (item.type ?? "").toLowerCase();
        return !type || type === "chat" || type === "text" || type === "language";
      })
      .map((item) => item.id)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  type?: string;
  supported_endpoints?: string[];
  modalities?: string[];
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey();

  const gateway = resolveGateway();
  const catalogBaseUrl = gateway.baseUrl;
  const url =
    catalogBaseUrl && catalogBaseUrl.trim().length > 0
      ? `${catalogBaseUrl.replace(/\/$/, "")}/models`
      : "http://localhost:4000/v1/models";

  const headers: Record<string, string> = {};
  if (resolveApiKey()) headers.authorization = `Bearer ${resolveApiKey()}`;
  const response = await fetchWithBackoff(
    url,
    {
      headers,
    },
    LLM_MODEL_CATALOG_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as ModelsResponse;
}

/**
 * Read OmniRoute's model catalog independently from the active chat gateway.
 *
 * This is intentionally separate from listLLMModels(): a configured OmniRoute
 * may be kept as a media/fallback gateway while another OpenAI-compatible
 * endpoint remains the active chat route. The result is only a directory
 * observation; callers must still verify a real generation request before
 * marking a model as online.
 */
export async function listOmniRouteModels(): Promise<ModelsResponse> {
  const baseUrl = configuredOmniRouteUrl();
  if (!baseUrl) throw new Error("OMNIROUTE_NOT_CONFIGURED");
  const headers: Record<string, string> = {};
  if (ENV.omniRouteApiKey.trim()) {
    headers.authorization = `Bearer ${ENV.omniRouteApiKey.trim()}`;
  }
  const response = await fetchWithBackoff(
    `${baseUrl}/models`,
    { headers },
    LLM_MODEL_CATALOG_TIMEOUT_MS,
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List OmniRoute models failed: ${response.status} ${response.statusText} – ${errorText.slice(0, 240)}`,
    );
  }
  return (await response.json()) as ModelsResponse;
}
