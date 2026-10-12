import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { freeLlmApiGatewayStatus, invokeLLM, listLLMModels } from "./llm";

const original = {
  llmBaseUrl: ENV.llmBaseUrl,
  llmApiKey: ENV.llmApiKey,
  freeLlmApiBaseUrl: ENV.freeLlmApiBaseUrl,
  freeLlmApiKey: ENV.freeLlmApiKey,
  freeLlmApiModel: ENV.freeLlmApiModel,
};

describe("optional FreeLLMAPI gateway for existing AI functions", () => {
  beforeEach(() => {
    ENV.llmBaseUrl = "";
    ENV.llmApiKey = "";
    ENV.freeLlmApiBaseUrl = "http://127.0.0.1:3001/v1";
    ENV.freeLlmApiKey = "local-unified-test-key";
    ENV.freeLlmApiModel = "auto";
  });
  afterEach(() => {
    Object.assign(ENV, original);
    vi.unstubAllGlobals();
  });

  it("routes an existing AI call through the documented completion path and preserves the key on the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "request-1", created: 0, model: "model-1",
      choices: [{ index: 0, message: { role: "assistant", content: "已核验摘要" }, finish_reason: "stop" }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(freeLlmApiGatewayStatus()).toBe("configured");
    const response = await invokeLLM({ messages: [{ role: "user", content: "仅基于已提供数据总结" }] });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3001/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer local-unified-test-key" }),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ model: "auto" });
    expect(response.choices[0].message.content).toBe("已核验摘要");
    expect(JSON.stringify(response)).not.toContain("local-unified-test-key");
  });

  it("uses the same authenticated gateway for model discovery while preserving explicit model selection", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ object: "list", data: [{ id: "model-1", object: "model", created: 0, owned_by: "test" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "response", created: 0, model: "model-1", choices: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await listLLMModels()).data[0].id).toBe("model-1");
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:3001/v1/models");
    await invokeLLM({ model: "model-1", messages: [{ role: "user", content: "hi" }] });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).model).toBe("model-1");
  });

  it("never treats an unconfigured key or unsafe URL as a connected capability", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    ENV.freeLlmApiKey = "";
    expect(freeLlmApiGatewayStatus()).toBe("missing_key");
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] }))
      .rejects.toThrow("FREELLMAPI_API_KEY_NOT_CONFIGURED");
    ENV.freeLlmApiBaseUrl = "http://public.example.invalid/v1";
    expect(freeLlmApiGatewayStatus()).toBe("invalid_config");
    await expect(listLLMModels()).rejects.toThrow("FREELLMAPI_BASE_URL_INVALID");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not override an existing explicit LLM provider", () => {
    ENV.llmBaseUrl = "https://existing.example.test/v1";
    expect(freeLlmApiGatewayStatus()).toBe("overridden");
  });
});
