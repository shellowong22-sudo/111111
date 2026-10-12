import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
};

type LoginUser = { openId: string; name: string; email: string | null; loginMethod: string };
let oidcDiscoveryPromise: Promise<OidcDiscovery> | null = null;

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function safeReturnPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function validateState(req: Request, state: string): string {
  const { nonce, returnPath } = decodeOAuthState(state);
  const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
  if (!nonce || nonce !== expectedNonce) throw new Error("invalid oauth state");
  return safeReturnPath(returnPath);
}

function localLoginHtml(state: string): string {
  const encodedState = encodeURIComponent(state);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finance Hub 登录</title></head><body><main><h1>Finance Hub 管理员登录</h1><form method="post" action="/api/oauth/local-login"><input type="hidden" name="state" value="${encodedState}"><label>密码 <input type="password" name="password" autocomplete="current-password" required></label><button type="submit">登录</button></form></main></body></html>`;
}

async function getOidcDiscovery(): Promise<OidcDiscovery> {
  if (!ENV.oidcIssuerUrl || !ENV.oidcClientId || !ENV.oidcClientSecret) {
    throw new Error("Standalone OIDC config missing: set OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET");
  }
  oidcDiscoveryPromise ??= fetch(`${ENV.oidcIssuerUrl.replace(/\/$/, "")}/.well-known/openid-configuration`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`OIDC discovery failed (${response.status})`);
      return response.json() as Promise<OidcDiscovery>;
    });
  return oidcDiscoveryPromise;
}

async function getStandaloneOidcUser(code: string, state: string): Promise<LoginUser> {
  const { redirectUri } = decodeOAuthState(state);
  const discovery = await getOidcDiscovery();
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code", code, redirect_uri: redirectUri,
    client_id: ENV.oidcClientId, client_secret: ENV.oidcClientSecret,
  });
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: tokenBody,
  });
  if (!tokenResponse.ok) throw new Error(`OIDC token exchange failed (${tokenResponse.status})`);
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token || !discovery.userinfo_endpoint) throw new Error("OIDC response missing access token or userinfo endpoint");
  const userResponse = await fetch(discovery.userinfo_endpoint, { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!userResponse.ok) throw new Error(`OIDC userinfo failed (${userResponse.status})`);
  const user = (await userResponse.json()) as { sub?: string; name?: string; email?: string };
  if (!user.sub) throw new Error("OIDC userinfo missing sub");
  return { openId: user.sub, name: user.name ?? "Standalone User", email: user.email ?? null, loginMethod: "oidc" };
}

async function issueSession(req: Request, res: Response, user: LoginUser, returnPath: string) {
  try {
    await db.upsertUser({ openId: user.openId, name: user.name || null, email: user.email, loginMethod: user.loginMethod, lastSignedIn: new Date() });
  } catch (error) {
    // A local preview must remain reachable while its optional MySQL service is restarting.
    // Database-backed panels report their own unavailable/empty state and recover on refresh.
    console.warn('[Auth] User persistence unavailable; issuing local session:', error instanceof Error ? error.message : String(error));
  }
  const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
  res.redirect(302, returnPath);
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/app-auth", async (req: Request, res: Response) => {
    const state = getQueryParam(req, "state");
    if (!state) return res.status(400).json({ error: "state is required" });
    if (ENV.authMode === "local") {
      // The browser normally writes this cookie before navigating to app-auth.
      // Direct links, restored tabs, and the 4173 -> 3000 local preview proxy
      // can skip that client-side step. Re-issue the short-lived nonce cookie
      // when rendering the password form so a valid state cannot be rejected
      // before the password is checked.
      const decoded = decodeOAuthState(state);
      if (!decoded.nonce) return res.status(400).json({ error: "invalid oauth state" });
      res.cookie(OAUTH_STATE_COOKIE, decoded.nonce, {
        ...getSessionCookieOptions(req),
        maxAge: 10 * 60 * 1000,
      });
      return res.type("html").send(localLoginHtml(state));
    }
    try {
      const discovery = await getOidcDiscovery();
      const { redirectUri } = decodeOAuthState(state);
      const url = new URL(discovery.authorization_endpoint);
      url.searchParams.set("client_id", ENV.oidcClientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid profile email");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      return res.redirect(302, url.toString());
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/oauth/local-login", async (req: Request, res: Response) => {
    if (ENV.authMode !== "local") return res.status(404).json({ error: "not found" });
    const encodedState = typeof req.body?.state === "string" ? req.body.state : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    try {
      const returnPath = validateState(req, decodeURIComponent(encodedState));
      if (!ENV.localAdminPassword) throw new Error("LOCAL_ADMIN_PASSWORD is not configured");
      const expected = Buffer.from(ENV.localAdminPassword);
      const supplied = Buffer.from(password);
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        return res.status(401).json({ error: "invalid credentials" });
      }
      res.clearCookie(OAUTH_STATE_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
      return issueSession(req, res, {
        openId: ENV.localAdminOpenId, name: ENV.localAdminName,
        email: ENV.localAdminEmail || null, loginMethod: "local",
      }, returnPath);
    } catch (error) {
      return res.status(403).json({ error: error instanceof Error ? error.message : "local login failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) return res.status(400).json({ error: "code and state are required" });
    let returnPath: string;
    try { returnPath = validateState(req, state); }
    catch { return res.status(403).json({ error: "invalid oauth state" }); }
    res.clearCookie(OAUTH_STATE_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
    try {
      const user = await getStandaloneOidcUser(code, state);
      return issueSession(req, res, user, returnPath);
    } catch (error) {
      console.error("[OIDC] Callback failed", error);
      return res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
