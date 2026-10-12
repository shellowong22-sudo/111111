import { describe, expect, it } from "vitest";
import { buildOmniRouteDirectory, summarizeOmniRouteDirectory } from "./omniRouteCatalog";

describe("OmniRoute model capability directory", () => {
  it("keeps reviewed no-key entries as candidates until a live catalog is observed", () => {
    const directory = buildOmniRouteDirectory();
    const duck = directory.find((model) => model.id === "duckduckgo-web/gpt-5.6-luna");
    expect(duck).toMatchObject({
      credential: "no_key",
      state: "candidate",
      tier: "免密钥候选",
      modality: "chat",
    });
  });

  it("marks live models online and preserves modality metadata", () => {
    const directory = buildOmniRouteDirectory([
      {
        id: "aihorde/flux",
        object: "model",
        created: 0,
        owned_by: "aihorde",
        type: "image",
        supported_endpoints: ["images"],
      },
    ]);
    expect(directory[0]).toMatchObject({
      id: "aihorde/flux",
      state: "online",
      modality: "image",
      credential: "optional_key",
    });
  });

  it("reports separate online, candidate and media counts", () => {
    const summary = summarizeOmniRouteDirectory(buildOmniRouteDirectory());
    expect(summary.online).toBe(0);
    expect(summary.candidates).toBeGreaterThan(0);
    expect(summary.noKeyCandidates).toBeGreaterThan(0);
    expect(summary.mediaCandidates).toBeGreaterThan(0);
  });

  it("keeps image, video and audio candidates distinct", () => {
    const directory = buildOmniRouteDirectory();
    expect(directory.find((model) => model.id === "comfyui/flux-dev")?.modality).toBe("image");
    expect(directory.find((model) => model.id === "veoaifree-web/veo")?.modality).toBe("video");
    expect(directory.find((model) => model.id === "gtts/default")).toMatchObject({
      modality: "audio",
      credential: "no_key",
      state: "candidate",
    });
  });
});
