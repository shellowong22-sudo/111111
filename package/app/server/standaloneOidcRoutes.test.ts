import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("standalone OIDC routes", () => {
  it("registers the independent login start route while preserving the existing callback path", async () => {
    vi.stubEnv("STANDALONE_MODE", "true");
    const registered: string[] = [];
    const fakeApp = {
      get: (path: string) => {
        registered.push(path);
      },
      post: (path: string) => {
        registered.push(path);
      },
    };
    const { registerOAuthRoutes } = await import("./_core/oauth");
    registerOAuthRoutes(fakeApp as any);

    expect(registered).toContain("/api/oauth/app-auth");
    expect(registered).toContain("/api/oauth/local-login");
    expect(registered).toContain("/api/oauth/callback");
  });
});
