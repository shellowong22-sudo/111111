import { describe, expect, it } from "vitest";
import { decodeOAuthState } from "./const";

describe("decodeOAuthState", () => {
  it("decodes a redirect URI and nonce from a base64 JSON OAuth state", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.test/api/oauth/callback", nonce: "one-time-nonce" }));
    expect(decodeOAuthState(state)).toEqual({ redirectUri: "https://example.test/api/oauth/callback", nonce: "one-time-nonce" });
  });

  it("returns a safe empty payload for malformed OAuth state", () => {
    expect(decodeOAuthState("not-a-valid-oauth-state")).toEqual({ redirectUri: "", nonce: "" });
  });
});

