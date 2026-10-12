import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  probe: vi.fn(),
  invoke: vi.fn(),
  candidates: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  activeAiGatewayKind: () => "direct",
  probeActiveChatModel: mocks.probe,
  listActiveChatProbeCandidates: mocks.candidates,
  invokeLLM: mocks.invoke,
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  rename: mocks.rename,
}));

describe("verified Ucheer AI chat routing", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.probe.mockReset();
    mocks.invoke.mockReset();
    mocks.candidates.mockReset().mockImplementation(async (_limit?: number, gateway?: string) => gateway ? [] : ["model-a", "model-b"]);
    mocks.readFile.mockReset().mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    mocks.writeFile.mockReset().mockResolvedValue(undefined);
    mocks.rename.mockReset().mockResolvedValue(undefined);
  });

  it("does not advertise directory models until a real generation returns text", async () => {
    mocks.probe.mockImplementation(async (id: string) => id === "model-b" ? { model: id } : null);
    const { getVerifiedChatModels } = await import("./aiModelRuntime");
    expect((await getVerifiedChatModels()).map((model) => model.id)).toEqual(["model-b"]);
  });

  it("removes a failing verified model from this run and switches to another", async () => {
    mocks.probe.mockImplementation(async (id: string) => ["model-a", "model-b"].includes(id) ? { model: id } : null);
    mocks.invoke.mockImplementation(async ({ model }: { model: string }) => {
      if (model === "model-a") throw new Error("upstream failed");
      return { choices: [{ message: { content: "答复" } }] };
    });
    const { invokeVerifiedChat, getVerifiedChatModels } = await import("./aiModelRuntime");
    expect((await invokeVerifiedChat({ messages: [{ role: "user", content: "测试" }] })).choices[0].message.content).toBe("答复");
    expect((await getVerifiedChatModels()).map((model) => model.id)).toEqual(["model-b"]);
  });

  it("only persists an administrator's verified selection", async () => {
    mocks.probe.mockImplementation(async (id: string) => id === "model-b" ? { model: id } : null);
    const { setPreferredUcheerModel } = await import("./aiModelRuntime");
    await expect(setPreferredUcheerModel("not-verified")).rejects.toThrow("AI_MODEL_NOT_VERIFIED");
    expect(mocks.writeFile).not.toHaveBeenCalled();
    await setPreferredUcheerModel("model-b");
    expect(mocks.writeFile).toHaveBeenCalledOnce();
    expect(mocks.rename).toHaveBeenCalledOnce();
  });
});
