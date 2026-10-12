import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { fetchMultipleFred } from "./realDataService";
import { getPublicFeedsForPath, getPublicRefreshSignalsForPath, publicFeedSignature } from "./adminModulePublicFeed";

// Track active SSE connections per user
const sseClients = new Map<number, Set<Response>>();
const sseKeepAlives = new WeakMap<Response, ReturnType<typeof setInterval>>();
const MAX_SSE_CLIENTS_PER_USER = 3;

export function closeSseOnError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[SSE] Stream error:", message);

  if (!res.headersSent && !res.writableEnded) {
    res.status(500).json({ error: "Notification stream unavailable" });
    return;
  }

  if (!res.writableEnded && !res.destroyed) {
    try { res.end(); } catch { /* connection already closed */ }
  }
}

function removeSseClient(userId: number, res: Response, end = false) {
  const keepAlive = sseKeepAlives.get(res);
  if (keepAlive) clearInterval(keepAlive);
  sseKeepAlives.delete(res);
  const clients = sseClients.get(userId);
  clients?.delete(res);
  if (clients?.size === 0) sseClients.delete(userId);
  if (end && !res.writableEnded && !res.destroyed) {
    try { res.end(); } catch { /* connection already closed */ }
  }
}

/**
 * Register image upload endpoint and SSE notifications endpoint
 */
export function registerUploadAndSse(app: Express) {
  // ============ Image Upload ============
  app.post("/api/upload/image", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Expect base64 encoded image in body
      const { data, filename, contentType } = req.body;
      if (!data || !filename) {
        res.status(400).json({ error: "Missing data or filename" });
        return;
      }

      // Decode base64
      const buffer = Buffer.from(data, "base64");
      const mimeType = contentType || "image/png";
      const fileKey = `announcements/${Date.now()}-${filename}`;

      const { key, url } = await storagePut(fileKey, buffer, mimeType);
      res.json({ success: true, key, url });
    } catch (error: any) {
      console.error("[Upload] Error:", error.message);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // ============ SSE Notifications ============
  app.get("/api/notifications/stream", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Register this client
      const userId = user.id;
      if (!sseClients.has(userId)) {
        sseClients.set(userId, new Set());
      }
      const clients = sseClients.get(userId)!;
      while (clients.size >= MAX_SSE_CLIENTS_PER_USER) {
        const oldest = clients.values().next().value as Response | undefined;
        if (!oldest) break;
        removeSseClient(userId, oldest, true);
      }
      clients.add(res);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        removeSseClient(userId, res);
      };

      // Send initial unread count
      const db2 = await getDb();
      if (db2) {
        try {
          const [result] = await db2.execute(sql`
            SELECT COUNT(*) as cnt FROM notifications
            WHERE userId = ${userId} AND isRead = 0
          `) as any;
          const count = Number(result?.[0]?.cnt || 0);
          try { res.write(`data: ${JSON.stringify({ type: "unread_count", count })}\n\n`); } catch { cleanup(); return; }
        } catch (error) {
          console.warn("[SSE] Unable to read notifications; continuing with an empty unread count:", error);
          try { res.write(`data: ${JSON.stringify({ type: "unread_count", count: 0 })}\n\n`); } catch { cleanup(); return; }
        }
      }

      // Keep-alive ping every 30s
      const keepAlive = setInterval(() => {
        if (res.writableEnded || res.destroyed) { cleanup(); return; }
        try { res.write(`:ping\n\n`); } catch { cleanup(); }
      }, 30000);
      sseKeepAlives.set(res, keepAlive);

      // Cleanup on normal, aborted and proxy-layer disconnects.
      res.on("close", cleanup);
      res.on("error", cleanup);
      req.on("close", cleanup);
      req.on("aborted", cleanup);
    } catch (error) {
      closeSseOnError(res, error);
    }
  });

  // Terminal-safe public stream: only normalized market observations are emitted.
  // No administrative, crawler, database or internal identifiers are included.
  app.get("/api/terminal/stream", async (req: Request, res: Response) => {
    const moduleId = String(req.query.module ?? "sovereign").slice(0, 24);
    const requestedFrequency = Number(req.query.freq ?? 5);
    const frequencyMs = Math.min(60_000, Math.max(1_000, Number.isFinite(requestedFrequency) ? requestedFrequency * 1_000 : 5_000));
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    // Tell compliant clients how quickly they may reconnect and flush an
    // initial frame immediately, even before a database-backed batch is ready.
    res.write('retry: 3000\n:connected\n\n');
    let closed = false;
    let sequence = 0;
    const send = async () => {
      if (closed || res.writableEnded || res.destroyed) return;
      const requestedAt = Date.now();
      const utcHour = new Date().getUTCHours();
      const marketSession = utcHour >= 13 && utcHour < 21 ? "交易时段" : "非交易时段";
      try {
        const series = await fetchMultipleFred(["DGS2", "DGS5", "DGS10", "DGS30", "T10Y2Y", "FEDFUNDS", "SOFR", "DFII10"]);
        sequence += 1;
        const rates = Object.fromEntries(Object.entries(series).map(([key, points]) => {
          const basis = points.at(-1)?.value;
          if (typeof basis !== 'number' || !Number.isFinite(basis)) return [key, null];
          return [key, Number(basis.toFixed(4))];
        }));
        const observedAt = Object.values(series)
          .flatMap((points) => points.map((point) => point.date))
          .sort()
          .at(-1) ?? null;
        const receivedAt = new Date().toISOString();
        const stale = !Object.values(rates).some((value) => typeof value === 'number' && Number.isFinite(value));
        res.write(`data: ${JSON.stringify({ moduleId, mode: "stream", source: "FRED", sequence, observedAt, receivedAt, latencyMs: Math.max(0, Date.now() - requestedAt), connection: stale ? "degraded" : "connected", marketSession, stale, rates })}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ moduleId, mode: "stream", source: "FRED", observedAt: null, receivedAt: new Date().toISOString(), latencyMs: null, connection: "degraded", marketSession, stale: true, rates: {} })}\n\n`);
      }
    };
    await send();
    const timer = setInterval(() => void send(), frequencyMs);
    const cleanup = () => { if (closed) return; closed = true; clearInterval(timer); };
    req.on("close", cleanup);
    req.on("aborted", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  });

  // Each existing frontend route owns an isolated content channel. The stream
  // emits only presentation-safe fields; collection names, database keys,
  // crawler metadata and administrative routing identifiers stay server-side.
  app.get("/api/terminal/content-stream", async (req: Request, res: Response) => {
    const path = String(req.query.path ?? '').trim().slice(0, 300);
    if (!path.startsWith('/')) {
      res.status(400).json({ error: 'INVALID_TERMINAL_PATH' });
      return;
    }
    let viewer;
    try {
      viewer = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: 'TERMINAL_STREAM_AUTHENTICATION_REQUIRED' });
      return;
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write('retry: 3000\n:connected\n\n');
    let closed = false;
    let lastSignature = '';
    let lastRefreshSignature = '';
    let sending = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let keepAlive: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      clearInterval(keepAlive);
    };
    // Register before the first asynchronous database read: a tab can close
    // while that read is pending and must not leave polling timers behind.
    req.on("close", cleanup);
    req.on("aborted", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
    const send = async () => {
      if (closed || sending || res.writableEnded || res.destroyed) return;
      sending = true;
      try {
        const [feeds, refreshes] = await Promise.all([getPublicFeedsForPath(path, { id: viewer.id, role: viewer.role }), getPublicRefreshSignalsForPath(path)]);
        if (closed || res.writableEnded || res.destroyed) return;
        const items = feeds.flatMap((feed) => feed.items).filter((item, index, all) => all.findIndex((candidate) => candidate.itemKey === item.itemKey) === index).slice(0, 50);
        const signature = publicFeedSignature(items);
        const refreshSignature = refreshes.map((item) => `${item.status}|${item.refreshedAt}`).join('\n');
        if (signature === lastSignature && refreshSignature === lastRefreshSignature) return;
        lastSignature = signature;
        lastRefreshSignature = refreshSignature;
        res.write(`data: ${JSON.stringify({ items, refreshes, receivedAt: new Date().toISOString() })}\n\n`);
      } catch {
        if (!closed && !res.writableEnded && !res.destroyed) res.write(`event: unavailable\ndata: ${JSON.stringify({ receivedAt: new Date().toISOString() })}\n\n`);
      } finally { sending = false; }
    };
    await send();
    if (closed || res.writableEnded || res.destroyed) return;
    timer = setInterval(() => void send(), 2_000);
    keepAlive = setInterval(() => {
      if (!closed && !res.writableEnded && !res.destroyed) res.write(':pulse\n\n');
    }, 20_000);
  });
}

/**
 * Push a notification event to a specific user's SSE connections
 */
export function pushNotificationToUser(userId: number, notification: {
  id: number;
  title: string;
  content: string;
  type: string;
}) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;

  const data = JSON.stringify({ type: "new_notification", notification });
  Array.from(clients).forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      removeSseClient(userId, client, true);
    }
  });
}

/**
 * Push unread count update to a specific user
 */
export function pushUnreadCountToUser(userId: number, count: number) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;

  const data = JSON.stringify({ type: "unread_count", count });
  Array.from(clients).forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      removeSseClient(userId, client, true);
    }
  });
}

/**
 * Push notification to all connected users
 */
export async function pushNotificationToAllUsers(notification: {
  title: string;
  content: string;
  type: string;
}) {
  const data = JSON.stringify({ type: "new_notification", notification });
  Array.from(sseClients.entries()).forEach(([userId, clients]) => {
    Array.from(clients).forEach(client => {
      try {
        client.write(`data: ${data}\n\n`);
      } catch {
        removeSseClient(userId, client, true);
      }
    });
  });
}
