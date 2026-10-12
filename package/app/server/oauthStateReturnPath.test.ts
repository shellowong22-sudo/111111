import { describe, expect, it } from "vitest";
import { decodeOAuthState } from "../shared/const";

describe("OAuth state 管理员回跳", () => {
  it("解码新增的本地回跳路径", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.test/api/oauth/callback", nonce: "nonce-1", returnPath: "/admin?tab=users" }));
    expect(decodeOAuthState(state)).toEqual({ redirectUri: "https://example.test/api/oauth/callback", nonce: "nonce-1", returnPath: "/admin?tab=users" });
  });

  it("兼容不含回跳路径的既有 state", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.test/api/oauth/callback", nonce: "nonce-2" }));
    expect(decodeOAuthState(state)).toEqual({ redirectUri: "https://example.test/api/oauth/callback", nonce: "nonce-2" });
  });
});
