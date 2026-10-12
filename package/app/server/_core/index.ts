import "dotenv/config";
import "../uc/netFallback";
import { registerUcRoutes } from "../uc/http";
import express from "express";
import { createServer } from "http";
import net from "net";
import { eq } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerObjectStorageProxy } from "./objectStorageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { processChecklistDeadlineNotifications, processMortgageLedgerReviewNotifications } from "../db";
import { processCreditOasThresholdNotifications } from "../db";
import { getCreditOasSnapshot } from "../routers/creditResearch";
import { pushNotificationToUser, registerUploadAndSse } from "../uploadAndSse";
import { processPolicyEvidenceMentionReminders } from "../policyWorkflowDb";
import { fetchOfficialFinancingCalendar } from "../realDataService";
import { renderSovereignFinancingCalendarIcs } from "../sovereignFinancingCalendarIcs";
import { syncDailySovereignFacts } from "../sovereignDailyFactSync";
import { processNewsSourceFreshnessNotifications } from "../newsResearchDb";
import { processMmflowDeliveryDeadlineNotifications } from "../mmflowDeliveryDb";
import { recordMoneyMarketSourceAvailability } from "../moneyMarketObservabilityDb";
import { availabilityProbesFromMoneyMarketSnapshot, getMoneyMarketSnapshot } from "../routers/moneyMarketResearch";
import { flushSourceFreshnessDailyDigests, processSourceFreshnessNotifications } from "../sourceFreshnessNotificationDb";
import { processActiveAdminNewsSources, syncAdminNewsSource } from "../adminNewsIngestion";
import { syncAdminMarketTarget } from "../adminMarketIngestion";
import { syncAllManagedPublicDatasets } from "../adminPublicDatasetIngestion";
import { startFinceptPublicAutoSync } from "../finceptAutoSync";
import { startFundDisclosureAutoRefresh } from "../fundHoldingsData";
import { syncAllFinMindDatasets } from "../finmindSync";
import { syncOpenBBAutomation } from "../openbbPriorityAService";
import { processAdminDataModuleAutomationSchedule } from "../adminDataModuleAutomation";
import { getDb } from "../db";
import { adminMarketIngestionTargets, adminNewsIngestionSources } from "../../drizzle/schema";
import { bootstrapStandaloneScheduler, createStandaloneSchedule } from "./standaloneScheduler";
import { ENV } from "./env";
import { runUcheerMemoryMaintenance } from "../ucheerAiMemory";
import { runAgentReachDailyDelivery } from "../agentReachDelivery";
import { standaloneSchedules } from "../../drizzle/schema";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, ENV.bindHost, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const adminRequestWindows = new Map<string, { startedAt: number; count: number }>();
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Referrer-Policy", "no-referrer");
    const isAdminSurface = req.path === "/secure-admin" || req.path.startsWith("/admin") || req.path.startsWith("/api/trpc/admin");
    if (isAdminSurface) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    }
    if (req.path.startsWith("/api/trpc/admin")) {
      const now = Date.now();
      const key = req.socket.remoteAddress ?? "local";
      const current = adminRequestWindows.get(key);
      const windowState = !current || now - current.startedAt >= 60_000 ? { startedAt: now, count: 1 } : { ...current, count: current.count + 1 };
      adminRequestWindows.set(key, windowState);
      if (windowState.count > 300) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({ error: "ADMIN_REQUEST_RATE_LIMITED" });
        return;
      }
      if (adminRequestWindows.size > 500) for (const [address, value] of adminRequestWindows) if (now - value.startedAt >= 120_000) adminRequestWindows.delete(address);
    }
    next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerUploadAndSse(app);
  registerUcRoutes(app);
  registerObjectStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.get("/api/money-market-boom.ics", async (req, res) => {
    try {
      const terms = String(req.query.terms ?? '').split(',').map((term) => term.trim()).filter(Boolean);
      const cusip = String(req.query.cusip ?? '').trim().toUpperCase();
      const minAmount = Number(req.query.minAmount ?? 0);
      const maxAmount = Number(req.query.maxAmount ?? Number.POSITIVE_INFINITY);
      const calendar = await fetchOfficialFinancingCalendar(150);
      const boomRecords = calendar.records
        .filter((record) => record.countryCode === 'US' && record.eventType === 'auction')
        .filter((record) => record.securityType.toLowerCase() === 'bill')
        .filter((record) => !terms.length || terms.includes(record.securityTerm ?? ''))
        .filter((record) => !cusip || record.cusip?.toUpperCase().includes(cusip))
        .filter((record) => record.offeringAmount !== null && record.offeringAmount >= minAmount && record.offeringAmount <= maxAmount);
      const body = renderSovereignFinancingCalendarIcs(boomRecords)
        .replace('PRODID:-//Finance Hub//Official Sovereign Financing Calendar//ZH', 'PRODID:-//Finance Hub//boom-us-auction-v1//US-Treasury-Fiscal-Data');
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", "inline; filename=money-market-boom.ics");
      res.setHeader("X-Money-Market-Calendar-Filters", JSON.stringify({ terms, cusip: cusip || null, minAmount, maxAmount: Number.isFinite(maxAmount) ? maxAmount : null }));
      res.send(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).type("text/plain").send(`BOOM calendar unavailable: ${message}`);
    }
  });
  app.post("/api/scheduled/checklistDeadlineNotify", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const notifications = await processChecklistDeadlineNotifications();
      res.json({ ok: true, processed: notifications.notified, expiringExports: notifications.expiringExports, dueArchiveReviews: notifications.dueArchiveReviews, taskUid: user.taskUid ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/creditOasThresholdNotify", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const creditOasSnapshot = await getCreditOasSnapshot();
      const notifications = await processCreditOasThresholdNotifications(creditOasSnapshot.series);
      for (const notification of notifications) {
        pushNotificationToUser(notification.userId, notification);
      }
      res.json({ ok: true, evaluatedAt: creditOasSnapshot.asOf, emitted: notifications.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/policyEvidenceMentionReminder", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const policyMentionNotifications = await processPolicyEvidenceMentionReminders();
      for (const notification of policyMentionNotifications) {
        pushNotificationToUser(notification.userId, notification);
      }
      res.json({ ok: true, emitted: policyMentionNotifications.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/sovereignFactSync", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const result = await syncDailySovereignFacts();
      res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/newsSourceFreshnessNotify", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const newsSourceFreshnessNotifications = await processNewsSourceFreshnessNotifications();
      for (const notification of newsSourceFreshnessNotifications) {
        pushNotificationToUser(notification.userId, notification);
      }
      res.json({ ok: true, emitted: newsSourceFreshnessNotifications.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/mortgageLedgerReviewNotify", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const mortgageLedgerNotifications = await processMortgageLedgerReviewNotifications();
      for (const notification of mortgageLedgerNotifications) {
        pushNotificationToUser(notification.userId, notification);
      }
      res.json({ ok: true, emitted: mortgageLedgerNotifications.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/moneyMarketGovernanceScan", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const moneyMarketSnapshot = await getMoneyMarketSnapshot();
      await recordMoneyMarketSourceAvailability(availabilityProbesFromMoneyMarketSnapshot(moneyMarketSnapshot));
      const sourceNotifications = await processSourceFreshnessNotifications(moneyMarketSnapshot.rates);
      const digestNotifications = await flushSourceFreshnessDailyDigests();
      const mmflowNotifications = await processMmflowDeliveryDeadlineNotifications();
      for (const notification of [...sourceNotifications, ...digestNotifications, ...mmflowNotifications]) {
        pushNotificationToUser(notification.userId, notification);
      }
      res.json({ ok: true, sourceEvents: sourceNotifications.length, digests: digestNotifications.length, mmflowEvents: mmflowNotifications.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/adminNewsIngestion", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const db = await getDb();
      if (!db) throw new Error('DATABASE_UNAVAILABLE');
      const source = (await db.select({ id: adminNewsIngestionSources.id }).from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.scheduleCronTaskUid, user.taskUid)).limit(1))[0];
      if (!source) { res.json({ ok: true, skipped: 'orphan', taskUid: user.taskUid }); return; }
      const result = await syncAdminNewsSource(source.id, null);
      res.json({ ok: true, taskUid: user.taskUid, sourceId: source.id, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/adminNewsIngestionSweep", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      if (process.env.STANDALONE_MODE !== "true") {
        res.status(404).json({ error: "standalone-only" });
        return;
      }
      const synced = await processActiveAdminNewsSources();
      // RSS records are now automatically cleaned, deduplicated and published
      // by processActiveAdminNewsSources. Do not enqueue a second AI/manual
      // review pass: it would create duplicate content and hide the durable
      // publication state behind a queued workflow.
      res.json({ ok: true, sourceCount: synced.length, synced, mode: "automatic_publication" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/adminMarketIngestion", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const db = await getDb();
      if (!db) throw new Error('DATABASE_UNAVAILABLE');
      const target = (await db.select({ id: adminMarketIngestionTargets.id }).from(adminMarketIngestionTargets).where(eq(adminMarketIngestionTargets.scheduleCronTaskUid, user.taskUid)).limit(1))[0];
      if (!target) { res.json({ ok: true, skipped: 'orphan', taskUid: user.taskUid }); return; }
      const result = await syncAdminMarketTarget(target.id, null);
      res.json({ ok: true, taskUid: user.taskUid, targetId: target.id, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/adminManagedPublicDatasets", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const configuredActorUserId = Number(process.env.STANDALONE_SCHEDULER_USER_ID);
      const actorUserId = Number.isInteger(configuredActorUserId) && configuredActorUserId > 0
        ? configuredActorUserId
        : null;
      const [results, finmindResults, openbbAutomation] = await Promise.all([
        syncAllManagedPublicDatasets(actorUserId),
        syncAllFinMindDatasets(),
        actorUserId
          // Run a bounded batch per scheduler beat. The OpenBB service still
          // filters to parameter-complete, stale, read-only contracts with an
          // existing unique module owner; failed/empty runs are never pushed.
          ? syncOpenBBAutomation({ actorUserId, maxRuns: 8 })
          : Promise.resolve({ status: "not_configured", selected: 0, succeeded: 0, delivered: 0, duplicateBlocked: 0, failed: 0, results: [] }),
      ]);
      res.json({ ok: true, taskUid: user.taskUid, results, finmindResults, openbbAutomation });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/adminFinMindSync", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) { res.status(403).json({ error: "cron-only" }); return; }
      const finmindResults = await syncAllFinMindDatasets();
      res.json({ ok: true, taskUid: user.taskUid, finmindResults });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/adminDataModuleAutomation", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const result = await processAdminDataModuleAutomationSchedule(user.taskUid);
      res.json({ ok: true, taskUid: user.taskUid, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/ucheerAiMemoryMaintenance", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const result = await runUcheerMemoryMaintenance();
      res.json({ ok: true, taskUid: user.taskUid ?? null, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  app.post("/api/scheduled/agentReachDailyDelivery", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) { res.status(403).json({ error: "cron-only" }); return; }
      const result = await runAgentReachDailyDelivery();
      res.json({ ok: true, taskUid: user.taskUid, result });
    } catch (error) {
      if (error && typeof error === "object" && (
        "statusCode" in error && (error.statusCode === 401 || error.statusCode === 403) ||
        "code" in error && (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN")
      )) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = process.env.STRICT_PORT === "true"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, ENV.bindHost, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startFundDisclosureAutoRefresh();
    void startFinceptPublicAutoSync().catch(error =>
      console.error("[FinceptAutoSync] bootstrap failed", error)
    );
    if (process.env.STANDALONE_MODE === "true") {
      bootstrapStandaloneScheduler().then(
        async () => {
          try {
            const db = await getDb();
            if (!db) throw new Error("DATABASE_UNAVAILABLE");
            const existing = await db.select({ id: standaloneSchedules.id })
              .from(standaloneSchedules)
              .where(eq(standaloneSchedules.name, "Ucheer AI 自动记忆整理"))
              .limit(1);
            if (!existing.length) {
              await createStandaloneSchedule({
                name: "Ucheer AI 自动记忆整理",
                cron: "*/10 * * * *",
                path: "/api/scheduled/ucheerAiMemoryMaintenance",
                description: "每十分钟从持久化对话队列中整理用户长期记忆；失败任务等待新消息后重试。",
              });
            }
            const [agentSchedule] = await db.select({ id: standaloneSchedules.id })
              .from(standaloneSchedules)
              .where(eq(standaloneSchedules.name, "Agent Reach 每日授权数据交付")).limit(1);
            if (!agentSchedule) await createStandaloneSchedule({
              name: "Agent Reach 每日授权数据交付",
              cron: "0 1 * * *",
              path: "/api/scheduled/agentReachDailyDelivery",
              description: "每日 09:00 中国时间重读管理员授权的公开 RSS，并把新清洗记录幂等交付到授权的既有功能。",
            });
            console.log("[StandaloneScheduler] restored persisted schedules and Ucheer memory maintenance");
          } catch (error) {
            console.error("[StandaloneScheduler] Ucheer memory schedule bootstrap failed", error);
          }
        },
        (error) => console.error("[StandaloneScheduler] bootstrap failed", error),
      );
    }
  });
}

startServer().catch(console.error);
