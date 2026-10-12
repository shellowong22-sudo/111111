import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const source = (name: string) => readFileSync(resolve(root, `client/src/pages/admin/${name}.tsx`), "utf8");

describe("后台页面复原契约", () => {
  it("安全控制台读取真实系统健康状态并提供受保护用户入口", () => {
    const page = source("SecureAdminConsole");
    expect(page).toContain("trpc.admin.systemHealth.useQuery");
    expect(page).toContain('href="/admin/users"');
  });

  it("用户、行情与监控页面绑定真实管理员程序", () => {
    const users = source("AdminUsers");
    const market = source("AdminMarketData");
    const monitor = source("AdminMonitor");
    expect(users).toContain("trpc.admin.listUsers.useQuery");
    expect(users).toContain("trpc.admin.updateUserRole.useMutation");
    expect(users).toContain("trpc.admin.deleteUser.useMutation");
    expect(market).toContain("trpc.admin.listMarketData.useQuery");
    expect(market).toContain("trpc.admin.createMarketData.useMutation");
    expect(market).toContain("trpc.admin.deleteMarketData.useMutation");
    expect(monitor).toContain("trpc.admin.systemHealth.useQuery");
    expect(monitor).toContain("trpc.admin.getActivityLog.useQuery");
  });

  it("设置、公告与下载登记页面绑定其可用的真实接口", () => {
    const settings = source("AdminSettings");
    const announcements = source("AdminAnnouncements");
    const registry = source("AdminExportRegistry");
    expect(settings).toContain("trpc.admin.systemHealth.useQuery");
    expect(settings).toContain('href="/settings"');
    expect(settings).toContain('href="/admin/monitor"');
    expect(settings).not.toMatch(/保存设置|保存更改|保存配置/);
    expect(announcements).toContain("trpc.announcement.create.useMutation");
    expect(announcements).toContain("trpc.announcement.publish.useMutation");
    expect(registry).toContain("trpc.admin.listChecklistExportRecords.useQuery");
    expect(registry).toContain("trpc.admin.exportChecklistExportRecords.useMutation");
    expect(registry).toContain("trpc.checklistCollaboration.verifyExportSignature.useMutation");
    expect(registry).toContain("downloadRegistryCsv");
  });

  it("监控页可格式化系统健康和活动接口返回的数值时间戳", () => {
    const monitor = source("AdminMonitor");
    expect(monitor).toContain("function formatDate(value: Date | string | number)");
    expect(monitor).toContain("formatDate(detail.timestamp)");
    expect(monitor).toContain("formatDate(item.timestamp)");
  });

  it("复原后台页面不保留待开发提示或空点击处理", () => {
    const pages = ["SecureAdminConsole", "AdminUsers", "AdminMarketData", "AdminMonitor", "AdminSettings", "AdminAnnouncements", "AdminExportRegistry"].map(source).join("\n");
    expect(pages).not.toMatch(/功能开发中|coming soon|onClick=\{\(\) => \{\}\}/i);
  });
});
