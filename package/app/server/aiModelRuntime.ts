import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";
import { activeAiGatewayKind, invokeLLM, listActiveChatProbeCandidates, probeActiveChatModel, type ChatGatewayOverride, type InvokeParams, type InvokeResult } from "./_core/llm";

const settingsPath = join(process.cwd(), "data", "ucheer-ai-model-settings.json");
const SUCCESS_TTL_MS = 120_000;
const FAILED_TTL_MS = 30_000;
type Verified = { id: string; verifiedAt: string };
let cache: { checkedAt: number; models: Verified[] } | null = null;
let pending: Promise<Verified[]> | null = null;
const failed = new Map<string, number>();

function modelRoute(id: string): { model: string; gatewayOverride?: ChatGatewayOverride } {
  const match = /^(freellmapi|omniroute|ollama):(.+)$/.exec(id);
  return match
    ? { model: match[2], gatewayOverride: match[1] as ChatGatewayOverride }
    : { model: id };
}

export async function getPreferredUcheerModel(): Promise<string | null> {
  try {
    const raw = JSON.parse(await readFile(settingsPath, "utf8")) as { preferredModel?: unknown };
    return typeof raw.preferredModel === "string" && raw.preferredModel.length <= 160
      ? raw.preferredModel : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    // An invalid or inaccessible settings file must not silently select a
    // different model than the one the administrator configured.
    throw new Error("AI_MODEL_SETTINGS_UNAVAILABLE");
  }
}

export async function setPreferredUcheerModel(id: string): Promise<void> {
  const available = await getVerifiedChatModels();
  if (!available.some((model) => model.id === id)) throw new Error("AI_MODEL_NOT_VERIFIED");
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  const temporary = `${settingsPath}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ preferredModel: id }), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, settingsPath);
}

export async function getVerifiedChatModels(force = false): Promise<Verified[]> {
  const now = Date.now();
  if (!force && cache && now - cache.checkedAt < (cache.models.length ? SUCCESS_TTL_MS : FAILED_TTL_MS)) {
    return cache.models.filter(({ id }) => (failed.get(id) ?? 0) < now - FAILED_TTL_MS);
  }
  if (!pending) {
    pending = (async () => {
      const selected = await getPreferredUcheerModel();
      const configured = process.env.UCHEER_AI_MODEL?.trim() || process.env.FINGPT_MODEL?.trim()
        || (ENV.llmBaseUrl.trim() ? ENV.llmModel : ENV.omniRouteBaseUrl.trim() ? ENV.omniRouteModel : ENV.freeLlmApiModel);
      const activeKind = activeAiGatewayKind();
      const gateways = [...new Set([
        activeKind, ...(ENV.freeLlmApiBaseUrl.trim() ? ["freellmapi"] : []),
        ...(ENV.omniRouteBaseUrl.trim() ? ["omniroute"] : []),
        "ollama",
      ])];
      const candidates = await Promise.all(gateways.map(async (gateway) => {
        const override = gateway === "freellmapi" || gateway === "omniroute" || gateway === "ollama" ? gateway : undefined;
        const prefix = override ? `${override}:` : "";
        const catalog = await listActiveChatProbeCandidates(24, override);
        // Prefer a concrete model route that this gateway actually advertises.
        // It is still excluded unless its own completion probe succeeds.
        const directory = gateway === "freellmapi"
          ? catalog.filter((id) => id === "kilo-auto")
          : gateway === "omniroute" ? [] : catalog.slice(0, 2);
        const routes = gateway === "ollama" ? directory : [configured, "auto", ...directory];
        return routes
          .filter((id): id is string => Boolean(id))
          .filter((id) => !id.includes(":") && id.length <= 140)
          .map((id) => `${prefix}${id}`);
      }));
      const ids = [...new Set([selected, ...candidates.flat()].filter((id): id is string => Boolean(id)))].slice(0, 10);
      const groups = new Map<string, string[]>();
      for (const id of ids) {
        const route = modelRoute(id).gatewayOverride ?? "active";
        groups.set(route, [...(groups.get(route) ?? []), id]);
      }
      const checked = await Promise.all([...groups.values()].map(async (routeIds) => {
        const verified: Verified[] = [];
        // Serialise probes within one gateway so a concurrency limit does not
        // make two otherwise working models appear broken.
        for (const id of routeIds) {
          if ((failed.get(id) ?? 0) > Date.now() - FAILED_TTL_MS) continue;
          const { model, gatewayOverride } = modelRoute(id);
          if (await probeActiveChatModel(model, gatewayOverride)) {
            verified.push({ id, verifiedAt: new Date().toISOString() });
          }
        }
        return verified;
      }));
      cache = { checkedAt: Date.now(), models: checked.flat() };
      return cache.models;
    })().finally(() => { pending = null; });
  }
  return pending;
}

export async function invokeVerifiedChat(params: InvokeParams): Promise<InvokeResult> {
  const verified = await getVerifiedChatModels();
  const selected = await getPreferredUcheerModel();
  const ordered = [...verified].sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
  if (!ordered.length) throw new Error("AI_NO_VERIFIED_CHAT_MODEL");
  for (const candidate of ordered) {
    try {
      const route = modelRoute(candidate.id);
      let response: InvokeResult;
      try {
        response = await invokeLLM({ ...params, ...route });
      } catch (error) {
        // OpenAI-compatible providers do not all accept reasoning controls.
        // Retry once without that optional field before discarding a model.
        if (!params.reasoning || !/reasoning|unsupported parameter|unknown parameter/i.test(
          error instanceof Error ? error.message : "",
        )) throw error;
        const { reasoning: _optionalReasoning, ...compatible } = params;
        response = await invokeLLM({ ...compatible, ...route });
      }
      if (!response.choices?.[0]?.message?.content) throw new Error("AI_EMPTY_RESPONSE");
      return response;
    } catch {
      failed.set(candidate.id, Date.now());
      cache = cache && { ...cache, models: cache.models.filter((item) => item.id !== candidate.id) };
    }
  }
  throw new Error("AI_ALL_VERIFIED_MODELS_FAILED");
}
