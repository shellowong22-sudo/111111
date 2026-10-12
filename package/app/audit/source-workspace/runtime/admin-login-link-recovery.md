# 管理员登录链接修复记录

`/admin` 的未登录提示此前将“立即登录”指向 `/api/oauth/login?redirect=...`。服务端只注册 OAuth 回调路径 `/api/oauth/callback`，因此该本地登录路径返回 404。

修复后，按钮调用项目既有的 `startLogin()`。该函数生成由 `VITE_OAUTH_PORTAL_URL/app-auth` 承载的有效 OAuth 登录地址，回调地址仍为当前源的 `/api/oauth/callback`。管理员页面的当前本地路径和查询参数写入 OAuth state 的 `returnPath`；回调只接受以单个 `/` 开头且不以 `//` 开头的本地路径，其他值回退至 `/`，从而避免开放重定向。

`/admin` 的既有 `ProtectedRoute` 与“需要登录 / 请先登录后再访问此页面。/ 立即登录”提示保留不变。测试结果：`server/terminalCommandBar.admin-menu.test.ts` 3/3 通过，验证公开菜单入口、受保护路由、OAuth 启动与安全回跳；`server/oauthStateReturnPath.test.ts` 2/2 通过，验证新增回跳 state 与旧 state 兼容。

写入后最小静态核验已确认：本审计文件存在；`client/src/App.tsx` 不再包含失效的 `/api/oauth/login?redirect=`；管理员登录按钮包含 `startLogin(`${window.location.pathname}${window.location.search}`)`。
