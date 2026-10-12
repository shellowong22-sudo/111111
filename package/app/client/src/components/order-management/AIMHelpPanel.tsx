import { BookOpen, ShieldCheck } from "lucide-react";

export default function AIMHelpPanel() {
  return (
    <section className="h-full overflow-auto bg-[#0a0a0f] p-4 text-green-400" data-aim-help-panel>
      <header className="border-b border-green-900/40 pb-3"><p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-green-300"><BookOpen className="h-4 w-4" />AIM · 使用说明</p><h2 className="mt-1 text-lg font-semibold text-green-100">订单管理帮助</h2></header>
      <div className="mt-4 space-y-3 text-sm leading-6 text-green-200"><section className="rounded-lg border border-green-900/40 bg-black/40 p-4"><h3 className="font-medium text-green-100">当前可用范围</h3><p className="mt-2 text-xs text-green-700">AIM 入口当前用于呈现交易接入状态。由于未配置经授权的订单来源或路由连接，系统不会显示模拟订单、虚构成交或可执行交易控件。</p></section><section className="rounded-lg border border-green-900/40 bg-black/40 p-4"><h3 className="flex items-center gap-2 font-medium text-green-100"><ShieldCheck className="h-4 w-4 text-emerald-300" />启用真实订单管理的条件</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-green-700"><li>接入经授权的订单与执行来源。</li><li>完成账户级权限、限额与审计策略配置。</li><li>验证订单生命周期、拒绝处理与交易后记录。</li></ol></section></div>
    </section>
  );
}
