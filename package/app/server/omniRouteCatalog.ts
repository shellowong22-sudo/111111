import type { ModelInfo } from "./_core/llm";

export type OmniRouteModality = "chat" | "image" | "video" | "audio" | "mixed";
export type OmniRouteCredential =
  | "no_key"
  | "optional_key"
  | "api_key"
  | "oauth"
  | "local_auth"
  | "unknown";
export type OmniRouteModelState =
  | "online"
  | "candidate"
  | "needs_key"
  | "needs_oauth"
  | "unavailable";

export type OmniRouteDirectoryModel = {
  id: string;
  provider: string;
  label: string;
  modality: OmniRouteModality;
  credential: OmniRouteCredential;
  state: OmniRouteModelState;
  tier: "实时已连接" | "免密钥候选" | "可选密钥" | "需要 API Key" | "需要 OAuth" | "本地执行器";
  note: string;
};

/**
 * A small, reviewed subset of OmniRoute's registry. The complete registry is
 * intentionally not copied into the Finance Hub bundle; live `/models` is the
 * authority when OmniRoute is running. These entries let the admin panel show
 * useful candidates while keeping "candidate" distinct from "online".
 */
const RELEASE_DIRECTORY: ReadonlyArray<
  Omit<OmniRouteDirectoryModel, "state" | "tier">
> = [
  {
    id: "cloudflare-playground/zai-org/glm-5.2",
    provider: "Cloudflare Playground",
    label: "GLM 5.2",
    modality: "chat",
    credential: "no_key",
    note: "注册表标记为免密钥；需要本机浏览器执行器，未验证前不会自动启用。",
  },
  {
    id: "cloudflare-playground/moonshotai/kimi-k2.6",
    provider: "Cloudflare Playground",
    label: "Kimi K2.6",
    modality: "chat",
    credential: "no_key",
    note: "注册表标记为免密钥；需要本机浏览器执行器，未验证前不会自动启用。",
  },
  {
    id: "cloudflare-playground/deepseek-ai/deepseek-v4-flash-0731",
    provider: "Cloudflare Playground",
    label: "DeepSeek V4 Flash",
    modality: "chat",
    credential: "no_key",
    note: "注册表标记为免密钥；需要本机浏览器执行器，未验证前不会自动启用。",
  },
  {
    id: "duckduckgo-web/gpt-5.6-luna",
    provider: "DuckDuckGo Web",
    label: "GPT-5.6 Luna",
    modality: "chat",
    credential: "no_key",
    note: "注册表标记为免密钥；运行依赖网关的会话执行器和上游可用性。",
  },
  {
    id: "duckduckgo-web/claude-haiku-4-5",
    provider: "DuckDuckGo Web",
    label: "Claude Haiku 4.5",
    modality: "chat",
    credential: "no_key",
    note: "注册表标记为免密钥；运行依赖网关的会话执行器和上游可用性。",
  },
  {
    id: "aihorde/aphrodite/TheDrummer/Cydonia-24B-v4.3",
    provider: "AI Horde",
    label: "Cydonia 24B",
    modality: "chat",
    credential: "optional_key",
    note: "匿名凭据可排队调用；可选账号密钥用于提高队列优先级，延迟由实时队列决定。",
  },
  {
    id: "pollinations/openai",
    provider: "Pollinations",
    label: "OpenAI（Pollinations）",
    modality: "chat",
    credential: "optional_key",
    note: "注册表标记为可选密钥；匿名额度和模型可用性会变化。",
  },
  {
    id: "pollinations/deepseek",
    provider: "Pollinations",
    label: "DeepSeek（Pollinations）",
    modality: "chat",
    credential: "optional_key",
    note: "注册表标记为可选密钥；匿名额度和模型可用性会变化。",
  },
  {
    id: "veoaifree-web/veo",
    provider: "VEO AI Free",
    label: "VEO 3.1",
    modality: "video",
    credential: "no_key",
    note: "注册表标记为免密钥视频能力；实际生成依赖网关执行器，未验证前不会标记在线。",
  },
  {
    id: "veoaifree-web/seedance",
    provider: "VEO AI Free",
    label: "Seedance",
    modality: "video",
    credential: "no_key",
    note: "注册表标记为免密钥视频能力；实际生成依赖网关执行器，未验证前不会标记在线。",
  },
  {
    id: "gtts/default",
    provider: "Google Translate TTS",
    label: "Google Translate TTS",
    modality: "audio",
    credential: "no_key",
    note: "压缩包注册表标记为免密钥语音合成；实际可用性仍以网关实时请求返回为准。",
  },
  {
    id: "pollinations/default",
    provider: "Pollinations",
    label: "Pollinations TTS",
    modality: "audio",
    credential: "optional_key",
    note: "压缩包提供 OpenAI 兼容语音合成路由；匿名额度和模型可用性以网关实时返回为准。",
  },
  {
    id: "comfyui/flux-dev",
    provider: "ComfyUI",
    label: "FLUX Dev",
    modality: "image",
    credential: "local_auth",
    note: "本机执行器免外部密钥；需要本机 ComfyUI 服务处于可用状态。",
  },
  {
    id: "comfyui/animatediff",
    provider: "ComfyUI",
    label: "AnimateDiff",
    modality: "video",
    credential: "local_auth",
    note: "本机执行器免外部密钥；需要本机 ComfyUI 服务处于可用状态。",
  },
  {
    id: "sdwebui/stable-diffusion-v1-5",
    provider: "Stable Diffusion WebUI",
    label: "Stable Diffusion 1.5",
    modality: "image",
    credential: "local_auth",
    note: "本机执行器免外部密钥；需要本机 Stable Diffusion WebUI 服务处于可用状态。",
  },
  {
    id: "sdwebui/animatediff-webui",
    provider: "Stable Diffusion WebUI",
    label: "AnimateDiff WebUI",
    modality: "video",
    credential: "local_auth",
    note: "本机执行器免外部密钥；需要本机 Stable Diffusion WebUI 服务处于可用状态。",
  },
];

function requirementPresentation(
  credential: OmniRouteCredential,
): Pick<OmniRouteDirectoryModel, "state" | "tier"> {
  switch (credential) {
    case "no_key":
      return { state: "candidate", tier: "免密钥候选" };
    case "optional_key":
      return { state: "candidate", tier: "可选密钥" };
    case "oauth":
      return { state: "needs_oauth", tier: "需要 OAuth" };
    case "api_key":
      return { state: "needs_key", tier: "需要 API Key" };
    case "local_auth":
      return { state: "candidate", tier: "本地执行器" };
    default:
      return { state: "candidate", tier: "可选密钥" };
  }
}

function modalityFromModel(model: ModelInfo): OmniRouteModality {
  const values = [
    model.type,
    ...(model.modalities ?? []),
    ...(model.supported_endpoints ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasImage = values.includes("image");
  const hasVideo = values.includes("video");
  const hasAudio = values.includes("audio") || values.includes("speech");
  const count = Number(hasImage) + Number(hasVideo) + Number(hasAudio);
  if (count > 1) return "mixed";
  if (hasImage) return "image";
  if (hasVideo) return "video";
  if (hasAudio) return "audio";
  return "chat";
}

function credentialForLiveModel(model: ModelInfo): OmniRouteCredential {
  const provider = String(model.owned_by ?? "").toLowerCase();
  if (["cloudflare-playground", "duckduckgo-web", "veoaifree-web"].includes(provider)) {
    return "no_key";
  }
  if (["pollinations", "aihorde"].includes(provider)) {
    return "optional_key";
  }
  if (["codex", "codex-app-server", "googleflow", "antigravity"].includes(provider)) {
    return "oauth";
  }
  return "unknown";
}

export function buildOmniRouteDirectory(
  liveModels: readonly ModelInfo[] = [],
): OmniRouteDirectoryModel[] {
  const live = liveModels.map((model) => {
    const credential = credentialForLiveModel(model);
    return {
      id: model.id,
      provider: model.owned_by || "OmniRoute",
      label: model.id,
      modality: modalityFromModel(model),
      credential,
      state: "online" as const,
      tier: "实时已连接" as const,
      note: "已从 OmniRoute 实时模型目录读取；生成能力仍以实际请求返回为准。",
    };
  });

  const liveIds = new Set(live.map((model) => model.id));
  const candidates = RELEASE_DIRECTORY
    .filter((model) => !liveIds.has(model.id))
    .map((model) => ({
      ...model,
      ...requirementPresentation(model.credential),
    }));

  return [...live, ...candidates];
}

export function summarizeOmniRouteDirectory(models: readonly OmniRouteDirectoryModel[]) {
  return {
    total: models.length,
    online: models.filter((model) => model.state === "online").length,
    candidates: models.filter((model) => model.state === "candidate").length,
    noKeyCandidates: models.filter((model) => model.credential === "no_key" && model.state !== "online").length,
    apiKeyRequired: models.filter((model) => model.credential === "api_key").length,
    oauthRequired: models.filter((model) => model.credential === "oauth").length,
    mediaCandidates: models.filter((model) => ["image", "video", "audio", "mixed"].includes(model.modality)).length,
  };
}
