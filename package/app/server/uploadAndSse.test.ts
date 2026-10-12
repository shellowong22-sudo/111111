import { describe, expect, it, vi } from "vitest";
import { closeSseOnError } from "./uploadAndSse";

function createResponse(overrides: Partial<Record<"headersSent" | "writableEnded" | "destroyed", boolean>> = {}) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const end = vi.fn();
  return {
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    status,
    end,
    json,
    ...overrides,
  };
}

describe("closeSseOnError", () => {
  it("returns a single 500 JSON response before SSE headers are sent", () => {
    const res = createResponse();

    closeSseOnError(res as never, new Error("database unavailable"));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Notification stream unavailable" });
    expect(res.end).not.toHaveBeenCalled();
  });

  it("closes an already-started stream without attempting a second HTTP response", () => {
    const res = createResponse({ headersSent: true });

    closeSseOnError(res as never, new Error("notifications table missing"));

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
