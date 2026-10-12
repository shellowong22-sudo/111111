import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  global.fetch = originalFetch;
});

describe("standalone notification adapter", () => {
  it("posts validated owner notifications to the configured independent webhook", async () => {
    vi.stubEnv("STANDALONE_MODE", "true");
    vi.stubEnv("WEBHOOK_URL", "https://alerts.example.test/finance-hub");
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 202 }));
    global.fetch = fetchMock as typeof fetch;

    const { notifyOwner } = await import("./_core/notification");
    await expect(notifyOwner({ title: "Crawler completed", content: "5 items processed" })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://alerts.example.test/finance-hub",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("finance-hub");
  });

  it("does not fall back to another provider when webhook configuration is absent", async () => {
    vi.stubEnv("STANDALONE_MODE", "true");
    vi.stubEnv("WEBHOOK_URL", "");
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const { notifyOwner } = await import("./_core/notification");
    await expect(notifyOwner({ title: "Crawler failed", content: "source unavailable" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
