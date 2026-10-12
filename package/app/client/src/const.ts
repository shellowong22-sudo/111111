import { OAUTH_STATE_COOKIE } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (returnPath = "/") => {
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${OAUTH_STATE_COOKIE}=${encodeURIComponent(nonce)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
  const state = btoa(JSON.stringify({ redirectUri, nonce, returnPath }));

  const url = new URL("/api/oauth/app-auth", window.location.origin);
  url.searchParams.set("state", state);

  return url.toString();
};

export const startLogin = (returnPath = "/") => {
  window.location.href = getLoginUrl(returnPath);
};
