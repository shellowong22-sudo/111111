export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
export const OAUTH_STATE_COOKIE = "oauth_state";

export type OAuthState = {
  redirectUri: string;
  nonce: string;
  returnPath?: string;
};

export function decodeOAuthState(state: string): OAuthState {
  try {
    const normalized = state.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const payload = JSON.parse(decoded) as Partial<OAuthState>;
    if (typeof payload.redirectUri === "string" && typeof payload.nonce === "string") {
      if (typeof payload.returnPath === "string") {
        return { redirectUri: payload.redirectUri, nonce: payload.nonce, returnPath: payload.returnPath };
      }
      return { redirectUri: payload.redirectUri, nonce: payload.nonce };
    }
  } catch {
    // Invalid state falls through to the safe empty payload below.
  }
  return { redirectUri: "", nonce: "" };
}
