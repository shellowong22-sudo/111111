import { ENV } from "./_core/env";
import { listOmniRouteModels } from "./_core/llm";
import { buildOmniRouteDirectory, type OmniRouteDirectoryModel } from "./omniRouteCatalog";

export type OmniRouteMediaKind = "image" | "video" | "audio";

export type OmniRouteMediaRequest = {
  kind: OmniRouteMediaKind;
  model: string;
  prompt?: string;
  text?: string;
  options?: Record<string, unknown>;
};

export type OmniRouteMediaResponse = {
  kind: OmniRouteMediaKind;
  model: string;
  contentType: string;
  response: unknown;
  receivedAt: string;
};

export type OmniRouteMediaModel = Pick<
  OmniRouteDirectoryModel,
  "id" | "label" | "modality" | "state" | "credential" | "tier" | "note"
>;

const MAX_MEDIA_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_MEDIA_REQUEST_BYTES = 24 * 1024;
const MEDIA_OPTIONS: Record<OmniRouteMediaKind, ReadonlySet<string>> = {
  image: new Set(["size", "quality", "style", "n", "response_format", "seed"]),
  video: new Set(["duration", "size", "aspect_ratio", "resolution", "seed"]),
  audio: new Set(["voice", "response_format", "speed"]),
};

export function getOmniRouteMediaStatus() {
  if (!ENV.omniRouteBaseUrl.trim()) {
    return {
      configured: false,
      state: "not_configured" as const,
      supported: [] as OmniRouteMediaKind[],
    };
  }
  try {
    getConfiguredBaseUrl();
    return {
      configured: true,
      state: "configured" as const,
      supported: ["image", "video", "audio"] as OmniRouteMediaKind[],
    };
  } catch {
    return {
      configured: true,
      state: "invalid_config" as const,
      supported: [] as OmniRouteMediaKind[],
    };
  }
}

/**
 * Returns the safe, user-facing portion of the live media model directory.
 * Provider URLs, credentials and raw upstream errors stay server-side.
 *
 * The live catalog is preferred. If the gateway is temporarily unavailable,
 * reviewed local candidates are returned with their candidate state intact;
 * this prevents the UI from presenting an unverified model as available.
 */
export async function listOmniRouteMediaModels(): Promise<OmniRouteMediaModel[]> {
  let directory: OmniRouteDirectoryModel[];
  try {
    const live = await listOmniRouteModels();
    directory = buildOmniRouteDirectory(live.data);
  } catch {
    directory = buildOmniRouteDirectory();
  }
  return directory
    .filter((model) => ["image", "video", "audio", "mixed"].includes(model.modality))
    .map(({ id, label, modality, state, credential, tier, note }) => ({
      id,
      label,
      modality,
      state,
      credential,
      tier,
      note,
    }));
}

function getConfiguredBaseUrl() {
  if (!ENV.omniRouteBaseUrl.trim()) {
    throw new Error("OMNIROUTE_MEDIA_NOT_CONFIGURED");
  }
  let url: URL;
  try {
    url = new URL(ENV.omniRouteBaseUrl.trim());
  } catch {
    throw new Error("OMNIROUTE_BASE_URL_INVALID");
  }
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  if (
    !["http:", "https:"].includes(url.protocol) ||
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

function endpointFor(kind: OmniRouteMediaKind) {
  switch (kind) {
    case "image":
      return "images/generations";
    case "video":
      return "videos/generations";
    case "audio":
      return "audio/speech";
  }
}

function buildPayload(input: OmniRouteMediaRequest) {
  const options = input.options ?? {};
  if (Object.keys(options).some((key) => !MEDIA_OPTIONS[input.kind].has(key))) {
    throw new Error("MEDIA_OPTION_UNSUPPORTED");
  }
  const payload: Record<string, unknown> = {
    ...options,
    model: input.model,
  };
  if (input.kind === "audio") {
    payload.input = input.text ?? "";
  } else if (input.prompt) {
    payload.prompt = input.prompt;
  }
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > MAX_MEDIA_REQUEST_BYTES) {
    throw new Error("MEDIA_REQUEST_TOO_LARGE");
  }
  return body;
}

function safeUpstreamError(status: number) {
  if (status === 401 || status === 403) return "MEDIA_GATEWAY_AUTH_REQUIRED";
  if (status === 429) return "MEDIA_GATEWAY_RATE_LIMITED";
  return `MEDIA_GENERATION_FAILED_${status}`;
}

async function readBoundedResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_MEDIA_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("MEDIA_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, bytes);
}

/**
 * Server-side media bridge for the existing Ucheer AI surface.
 *
 * The browser never receives the OmniRoute URL or credentials. JSON responses
 * are returned as structured data; binary audio/video/image responses are
 * encoded as base64 so the existing frontend can decide how to render them
 * without a new page or a new provider-specific UI.
 */
export async function invokeOmniRouteMedia(
  input: OmniRouteMediaRequest,
): Promise<OmniRouteMediaResponse> {
  const baseUrl = getConfiguredBaseUrl();
  if (!input.model.trim()) throw new Error("MEDIA_MODEL_REQUIRED");
  if (input.kind === "audio" && !(input.text ?? "").trim()) {
    throw new Error("MEDIA_AUDIO_TEXT_REQUIRED");
  }
  if (input.kind !== "audio" && !(input.prompt ?? "").trim()) {
    throw new Error("MEDIA_PROMPT_REQUIRED");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (ENV.omniRouteApiKey.trim()) {
    headers.authorization = `Bearer ${ENV.omniRouteApiKey.trim()}`;
  }

  const body = buildPayload(input);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${endpointFor(input.kind)}`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(
        Math.min(Math.max(Number(process.env.MEDIA_REQUEST_TIMEOUT_MS ?? 120_000), 5_000), 300_000),
      ),
    });
  } catch {
    throw new Error("MEDIA_GATEWAY_UNAVAILABLE");
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MEDIA_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("MEDIA_RESPONSE_TOO_LARGE");
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(safeUpstreamError(response.status));
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await readBoundedResponse(response);
  if (contentType.toLowerCase().includes("json")) {
    let result: unknown;
    try {
      result = JSON.parse(buffer.toString("utf8"));
    } catch {
      throw new Error("MEDIA_RESPONSE_INVALID");
    }
    return {
      kind: input.kind,
      model: input.model,
      contentType,
      response: result,
      receivedAt: new Date().toISOString(),
    };
  }

  return {
    kind: input.kind,
    model: input.model,
    contentType,
    response: {
      encoding: "base64",
      data: buffer.toString("base64"),
    },
    receivedAt: new Date().toISOString(),
  };
}
