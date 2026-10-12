import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("standalone scheduler authentication", () => {
  it("accepts an independent scheduler secret and optional task identifier", async () => {
    vi.stubEnv("STANDALONE_MODE", "true");
    vi.stubEnv("SCHEDULER_SECRET", "test-scheduler-secret");
    const { sdk } = await import("./_core/sdk");

    const actor = await sdk.authenticateRequest({
      headers: {
        "x-scheduler-secret": "test-scheduler-secret",
        "x-scheduler-task-id": "standalone-source-17",
      },
    } as any);

    expect(actor.isCron).toBe(true);
    expect(actor.taskUid).toBe("standalone-source-17");
    expect(actor.openId).toBe("cron_standalone");
  });

  it("does not accept a missing scheduler secret as a cron request", async () => {
    vi.stubEnv("STANDALONE_MODE", "true");
    vi.stubEnv("SCHEDULER_SECRET", "test-scheduler-secret");
    const { sdk } = await import("./_core/sdk");

    await expect(
      sdk.authenticateRequest({ headers: {} } as any),
    ).rejects.toThrow("Invalid session cookie");
  });
});
