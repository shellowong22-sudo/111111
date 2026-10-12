import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  global.fetch = originalFetch;
});

describe("standalone data API adapter", () => {
  it("calls only the configured endpoint mapping and forwards query fields", async () => {
    vi.stubEnv("STANDALONE_MODE", "true");
    vi.stubEnv("DATA_API_ENDPOINTS_JSON", JSON.stringify({ OfficialFeed: { url: "https://data.example.test/feed", method: "GET" } }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const { callDataApi } = await import("./_core/dataApi");

    await expect(callDataApi("OfficialFeed", { query: { region: "US" } })).resolves.toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://data.example.test/feed?region=US");
  });

  it("rejects an unmapped API id without attempting another provider", async () => {
    vi.stubEnv("STANDALONE_MODE", "true");
    vi.stubEnv("DATA_API_ENDPOINTS_JSON", "{}");
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    const { callDataApi } = await import("./_core/dataApi");

    await expect(callDataApi("UnknownProvider")).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
