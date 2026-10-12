import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("object storage proxy", () => {
  it("redirects a storage key to a standard S3-compatible signed URL", async () => {
    vi.stubEnv("S3_ENDPOINT", "https://minio.example.test");
    vi.stubEnv("S3_REGION", "us-east-1");
    vi.stubEnv("S3_BUCKET", "finance-hub");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-access");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret");
    vi.stubEnv("S3_FORCE_PATH_STYLE", "true");

    let handler: ((req: any, res: any) => Promise<void>) | undefined;
    const { registerObjectStorageProxy } = await import("./_core/objectStorageProxy");
    registerObjectStorageProxy({
      get: (_path: string, routeHandler: typeof handler) => { handler = routeHandler; },
    } as any);
    const redirect = vi.fn();
    await handler!(
      { params: { 0: "reports/daily.pdf" } },
      { redirect, status: vi.fn().mockReturnThis(), json: vi.fn() },
    );

    expect(redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("minio.example.test/finance-hub/reports/daily.pdf"),
    );
  });
});
