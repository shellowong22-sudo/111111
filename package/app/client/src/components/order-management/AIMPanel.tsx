import { CircleAlert, ShieldCheck } from "lucide-react";

export default function AIMPanel() {
  return (
    <section className="h-full overflow-auto bg-[#0a0a0f] p-4 text-green-400" data-aim-order-management-panel>
      <header className="border-b border-green-900/40 pb-3"><p className="text-xs font-semibold tracking-wide text-green-300">AIM · 订单管理</p><h2 className="mt-1 text-lg font-semibold text-green-100">受控订单执行边界</h2><p className="mt-1 text-xs text-green-700">该终端当前未接入经授权的订单管理系统、券商路由或交易场所连接。</p></header>
      <div className="mt-4 rounded-lg border border-amber-800/70 bg-amber-950/30 p-4 text-sm leading-6 text-amber-100"><CircleAlert className="mr-2 inline h-4 w-4 text-amber-300" />为避免呈现随机订单、模拟成交或无效提交操作，系统保持真实空状态。此页不会发送、修改、撤销或模拟交易指令。</div>
      <div className="mt-3 rounded-lg border border-green-900/40 bg-black/40 p-4"><p className="flex items-center gap-2 text-sm font-medium text-green-200"><ShieldCheck className="h-4 w-4 text-emerald-300" />启用条件</p><p className="mt-2 text-xs leading-5 text-green-700">当接入已授权订单来源且完成账户、权限、审计和风控校验后，AIM 页面才可展示实际订单状态及可执行操作。</p></div>
    </section>
  );
}
