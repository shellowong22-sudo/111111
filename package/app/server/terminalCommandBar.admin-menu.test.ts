import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/components/TerminalCommandBar.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const authStartSource = readFileSync(new URL("../client/src/const.ts", import.meta.url), "utf8");
const oauthSource = readFileSync(new URL("./_core/oauth.ts", import.meta.url), "utf8");

describe("TerminalCommandBar 管理员入口", () => {
  it("无论认证角色为何均显示原始管理后台菜单项", () => {
    expect(source).toContain("onClick={() => navigate('/admin')}");
    expect(source).toContain("管理后台");
    expect(source).not.toContain("{user?.role === 'admin' && (");
  });

  it("入口目标继续使用原始受保护的管理员路由", () => {
    expect(appSource).toContain('path="/admin" component={() => <ProtectedRoute component={AdminDashboard} check={(a) => a.canAccessAdmin} label="管理后台" />}');
    expect(appSource).toContain("需要登录");
    expect(appSource).toContain("请先登录后再访问此页面。");
    expect(appSource).toContain("立即登录");
  });

  it("立即登录使用有效 OAuth 启动函数并安全回跳至管理员页", () => {
    expect(appSource).toContain("startLogin(`${window.location.pathname}${window.location.search}`)");
    expect(appSource).not.toContain("/api/oauth/login?redirect=");
    expect(authStartSource).toContain("JSON.stringify({ redirectUri, nonce, returnPath })");
    expect(oauthSource).toContain('returnPath.startsWith("/") && !returnPath.startsWith("//")');
    expect(oauthSource).toContain("res.redirect(302, safeReturnPath)");
  });
});
