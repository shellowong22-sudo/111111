import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cleanScraplingPreviewBody, createScraplingPushId, getScraplingHealth, normalizeDuplicateScraplingReceipt, prepareScraplingItemsForDelivery, sanitizeRunForDisplay, scraplingPushIdempotencyKey, type ScraplingRun } from "./scraplingAdminService";

const root = process.cwd();
const bridgePath = path.join(root, "scripts", "scrapling_bridge.py");
const pythonPath = path.join(root, ".runtime", "scrapling-venv", "Scripts", "python.exe");

describe("Scrapling 独立管理后台契约", () => {
  it("保留上游源码、版本与 BSD-3-Clause 许可证", () => {
    const project = readFileSync("vendor/Scrapling-main/pyproject.toml", "utf8");
    const license = readFileSync("vendor/Scrapling-main/LICENSE", "utf8");
    const notices = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
    expect(project).toContain('version = "0.4.15"');
    expect(license).toContain("BSD 3-Clause License");
    expect(notices).toContain("85F1C9C0F356E1252F77B0BDCF46287ABCE1D6E936A1DA575D46A9C84F47CAC9");
  });

  it("具有唯一后台导航、受保护路由和服务端 router", () => {
    const layout = readFileSync("client/src/components/AdminLayout.tsx", "utf8");
    const app = readFileSync("client/src/App.tsx", "utf8");
    const routers = readFileSync("server/routers.ts", "utf8");
    expect(layout.match(/\/admin\/scrapling/g)).toHaveLength(1);
    expect(app).toContain('path="/admin/scrapling"');
    expect(app).toContain('label="Scrapling 采集引擎"');
    expect(routers).toContain("adminScrapling: adminScraplingRouter");
  });

  it("所有可见动作连接服务端过程并保留失败状态", () => {
    const page = readFileSync("client/src/pages/admin/AdminScrapling.tsx", "utf8");
    const router = readFileSync("server/routers/adminScrapling.ts", "utf8");
    for (const action of ["inspectSource", "start", "pause", "resume", "cancel", "parse", "export", "push"]) {
      expect(page).toContain(`adminScrapling.${action}`);
      expect(router).toContain(`${action}: adminProcedure`);
    }
    expect(page).toContain("前端推送给谁");
    expect(page).toContain("实际推送内容");
    expect(page).toContain("终端实例回执");
    expect(page).toContain("recipientUserIds");
    expect(page).toContain("系统未生成替代数据");
  });

  it("桥接层强制阻断内网并不暴露挑战绕过", () => {
    const bridge = readFileSync(bridgePath, "utf8");
    expect(bridge).toContain('if not ip.is_global');
    expect(bridge).toContain("robots_txt_obey = True");
    expect(bridge).toContain('"solve_cloudflare": False');
    expect(bridge).not.toContain('"solve_cloudflare": True');
    if (!existsSync(pythonPath)) return;
    const run = spawnSync(pythonPath, [bridgePath], {
      cwd: root,
      input: JSON.stringify({ action: "inspect_source", url: "http://127.0.0.1/" }),
      encoding: "utf8",
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    });
    expect(run.status).not.toBe(0);
    expect(JSON.parse(run.stdout).ok).toBe(false);
  });

  it("私有运行环境真实加载 Scrapling、动态 Fetcher、MCP 与解析依赖", async () => {
    if (!existsSync(pythonPath)) return;
    const health = await getScraplingHealth(true) as any;
    expect(health.ok).toBe(true);
    expect(health.version).toBe("0.4.15");
    expect(health.imports).toMatchObject({ scrapling: true, playwright: true, patchright: true, mcp: true, lxml: true });
    expect(health.stealthBypassExposed).toBe(false);
    expect(health.capabilities.length).toBeGreaterThanOrEqual(17);
  }, 30_000);

  it("旧快照在后台预览和再次推送前移除站点外壳并拦截规范化重复来源", () => {
    const noisy = [
      "* 官方网站 证券市场信息披露媒体",
      "* 首页", "* 金融管理", "当前位置", "首页", ">", "金融管理", ">", "**金融管理**",
      "#### 市场流动性观察", "隔夜融资利率回落，成交量同步上升。", "###### 2026-09-11 来源：金融时报",
      "专题", "友情链接", "https://example.com/footer", "Copyright © 1998 - 2023",
    ].join("\n");
    const cleaned = cleanScraplingPreviewBody(noisy, "https://example.com/node_3001.html", "金融管理 -中国金融新闻网");
    expect(cleaned).toContain("市场流动性观察");
    expect(cleaned).toContain("隔夜融资利率回落");
    expect(cleaned).not.toMatch(/官方网站|当前位置|友情链接|https?:\/\/|Copyright/);

    const base = {
      status: 200, reason: "OK", selected: [], selector: "body", selectorType: "css", links: [], linkCount: 0,
      bytes: 200, contentType: "text/html", encoding: "utf-8", artifactPath: "snapshot.html", text: "", rawContentHash: "raw",
    };
    const prepared = prepareScraplingItemsForDelivery([
      { ...base, url: "https://example.com/", title: "首页", markdown: "市场流动性观察\n隔夜融资利率回落，成交量同步上升。", contentHash: "a".repeat(64) },
      { ...base, url: "https://example.com/index.html", title: "首页", markdown: "市场流动性观察\n隔夜融资利率回落，成交量同步上升。", contentHash: "b".repeat(64) },
    ] as any);
    expect(prepared[0].duplicateOfContentHash).toBeNull();
    expect(prepared[1].duplicateOfContentHash).toBe("a".repeat(64));

    const quality = prepareScraplingItemsForDelivery([{ ...base, url: "https://www.financialnews.com.cn/2024-11/21/content_412902.html", title: "通知 -中国金融新闻网", markdown: "新版电子报系统已经上线，订阅未到期的读者请进入小程序注册，或微信扫描二维码。如需帮助，请联系我们。", contentHash: "c".repeat(64) }] as any);
    expect(quality[0].qualityRejectionReason).toContain("不属于金融研究内容");

    const portal = prepareScraplingItemsForDelivery([{ ...base, url: "https://www.financialnews.com.cn/", title: "中国金融新闻网", markdown: `${"宏观政策与市场资讯聚合。".repeat(50)}金融管理\n要闻\n评论\n深度\n银行\n证券`, contentHash: "d".repeat(64) }] as any);
    expect(portal[0].qualityRejectionReason).toContain("门户聚合页");
  });

  it("重复发送账簿不继承旧内容的 ACK 数量和终端指纹", () => {
    expect(normalizeDuplicateScraplingReceipt({
      duplicateBlocked: true,
      currentStatus: "front_acknowledged",
      sentCount: 1,
      successCount: 1,
      frontAckAt: "2026-09-11T00:00:00.000Z",
      acknowledgedClients: ["old-client"],
      acknowledgedTerminals: [{ terminalId: "old-client", userId: 7 }],
    })).toMatchObject({
      currentStatus: "duplicate_blocked",
      sentCount: 0,
      successCount: 0,
      pendingCount: 0,
      frontAckAt: null,
      acknowledgedClients: [],
      acknowledgedTerminals: [],
    });
  });

  it("每次推送使用唯一 pushId，并为相同目标保留稳定幂等键", () => {
    const target = { runId: "run-1", moduleIds: ["b", "a"], recipientUserIds: [9, 3], dataUuids: ["z", "x"] };
    const reordered = { runId: "run-1", moduleIds: ["a", "b"], recipientUserIds: [3, 9], dataUuids: ["x", "z"] };
    expect(createScraplingPushId()).not.toBe(createScraplingPushId());
    expect(scraplingPushIdempotencyKey(target)).toBe(scraplingPushIdempotencyKey(reordered));
    expect(scraplingPushIdempotencyKey({ ...target, recipientUserIds: [3] })).not.toBe(scraplingPushIdempotencyKey(target));
  });

  it("后台展示不会把无错误的 ACK 和重复拦截记录误标为失败", () => {
    const stamp = "2026-09-11T00:00:00.000Z";
    const run: ScraplingRun = {
      runId: "run-status-regression",
      actorUserId: 1,
      input: {
        taskKind: "crawl", mode: "static", urls: ["https://example.com"], selectorType: "css",
        selector: "body", adaptive: true, networkIdle: false, disableResources: true,
        timeoutMs: 30_000, maxPages: 1, concurrency: 1, delayMs: 0,
      },
      status: "completed",
      createdAt: stamp,
      startedAt: stamp,
      completedAt: stamp,
      updatedAt: stamp,
      result: null,
      error: null,
      errorType: null,
      stderr: "",
      duplicateOf: null,
      pushRecords: [
        { pushId: "ack", runId: "run-status-regression", createdAt: stamp, moduleIds: ["mm-22-news"], status: "front_acknowledged", receipts: [] },
        { pushId: "duplicate", runId: "run-status-regression", createdAt: stamp, moduleIds: ["mm-22-news"], status: "duplicate_blocked", receipts: [] },
        { pushId: "waiting", runId: "run-status-regression", createdAt: stamp, moduleIds: ["mm-22-news"], status: "waiting_front_ack", receipts: [] },
        { pushId: "failed", runId: "run-status-regression", createdAt: stamp, moduleIds: ["mm-22-news"], status: "failed", receipts: [], error: "真实失败原因" },
      ],
    };

    const displayed = sanitizeRunForDisplay(run);
    expect(displayed.pushRecords.map((record) => record.status)).toEqual([
      "front_acknowledged", "duplicate_blocked", "waiting_front_ack", "failed",
    ]);
    expect(displayed.pushRecords.map((record) => record.error)).toEqual([
      undefined, undefined, undefined, "真实失败原因",
    ]);
  });
});
