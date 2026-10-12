# 管理员入口恢复记录

用户提供的原始行为截图显示，账户菜单在未登录状态下仍应显示带 Shield 图标的“管理后台”项；点击该项后，`/admin` 页面显示“需要登录”提示，而不是在菜单阶段隐藏入口。

当前恢复工作区的 `client/src/components/TerminalCommandBar.tsx` 曾使用 `user?.role === 'admin'` 作为该菜单项的渲染条件，导致未登录会话不显示入口。已移除该**菜单可见性**条件，保留原有菜单文案、图标、颜色、顺序、分隔线与 `navigate('/admin')` 行为。

`client/src/App.tsx` 的 `/admin` 路由未改动，仍通过 `ProtectedRoute` 和 `canAccessAdmin` 保护管理员内容。`ProtectedRoute` 对未登录状态渲染的原始文案为“需要登录”“请先登录后再访问此页面。”和“立即登录”按钮。因此恢复后的边界为：入口公开可见；未登录点击后显示现有登录提示；登录且拥有管理员权限后才可访问管理员内容。

最小回归测试 `server/terminalCommandBar.admin-menu.test.ts` 已通过 2 项断言：菜单入口不再受角色条件隐藏；`/admin` 继续保持受保护路由及上述未登录提示。
