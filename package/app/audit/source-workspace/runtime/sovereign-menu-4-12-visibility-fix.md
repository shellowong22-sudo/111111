# 主权债菜单第 4–12 项可见性修复

第 4–12 项并非缺少终端窗口分支：`Terminal.tsx` 已为 WB、FIT、BTMM、GCDS、COUN、MIPR、DEBT、SRSK、GMM 分别注册窗口内容。问题在于 `SovereignBondMenu` 将选择事件派发到终端后仍保持全屏菜单覆盖层，导致新窗口被遮挡，呈现为“假按钮/死链接”。

修复后，主菜单与“当前市场”子菜单均在 `onSelectItem` 后调用 `onClose()`。因此窗口创建后立即可见，而原菜单文案、编码和窗口组件不变。

验证：`server/sovereignMenuVisibility.test.ts` 为 **3/3 通过**，覆盖主菜单关闭、子菜单关闭及第 4–12 项全部窗口分支存在。
