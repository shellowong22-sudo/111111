import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

class StandaloneSessionService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  private sessionSecret() {
    if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession({
      openId,
      appId: ENV.appId,
      name: options.name || "",
    }, options);
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + expiresInMs) / 1000))
      .sign(this.sessionSecret());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.sessionSecret(), { algorithms: ["HS256"] });
      const { openId, appId, name } = payload as Record<string, unknown>;
      if (!isNonEmptyString(openId) || appId !== ENV.appId || !isNonEmptyString(name)) return null;
      return { openId, appId, name };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const suppliedSecret = req.headers["x-scheduler-secret"];
    const suppliedTaskUid = req.headers["x-scheduler-task-id"];
    if (ENV.schedulerSecret && typeof suppliedSecret === "string" && suppliedSecret === ENV.schedulerSecret) {
      const now = new Date();
      return {
        id: -1,
        openId: "cron_standalone",
        name: "Standalone Scheduler",
        email: null,
        loginMethod: "scheduler",
        role: "admin",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
        taskUid: typeof suppliedTaskUid === "string" ? suppliedTaskUid : undefined,
        isCron: true,
      } as AuthenticatedUser;
    }

    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authorization = req.headers.authorization;
      if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
        sessionToken = authorization.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("Invalid session cookie");
    let user: User | undefined;
    try {
      user = await db.getUserByOpenId(session.openId);
    } catch (error) {
      if (ENV.authMode === 'local' && session.openId === ENV.localAdminOpenId) {
        console.warn('[Auth] Database unavailable; using local administrator session:', error instanceof Error ? error.message : String(error));
        const now = new Date();
        return {
          id: 0,
          openId: ENV.localAdminOpenId,
          name: ENV.localAdminName,
          email: ENV.localAdminEmail || null,
          loginMethod: 'local',
          role: 'admin',
          createdAt: now,
          updatedAt: now,
          lastSignedIn: now,
        } as AuthenticatedUser;
      }
      throw error;
    }
    // A standalone preview can be used before MySQL is provisioned. Keep the
    // local administrator session usable in that mode; all database-backed
    // pages still report their normal unavailable state until a DB is added.
    if (!user && ENV.authMode === "local" && session.openId === ENV.localAdminOpenId) {
      const now = new Date();
      return {
        id: 0,
        openId: ENV.localAdminOpenId,
        name: ENV.localAdminName,
        email: ENV.localAdminEmail || null,
        loginMethod: "local",
        role: "admin",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      } as AuthenticatedUser;
    }
    if (!user) throw ForbiddenError("User not found");
    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    return user;
  }
}

export const sdk = new StandaloneSessionService();
