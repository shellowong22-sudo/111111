/** EMSX 订单录入：平台模拟交易系统的下单票据 + 我的委托（终端小窗、菜单入口与电子交易页共用同一实现）。 */
import { OrderTicket, OrdersTable, useOrders } from "@/uc/trade/kit";
import { PanelShell } from "@/uc/panels/kit";

export function EmsxOrderEntry() {
  const myOrders = useOrders();
  return (
    <div className="p-2">
      <OrderTicket initial="IEF" strategy="EMSX" />
      <div className="max-h-[420px] overflow-auto"><OrdersTable rows={myOrders.data ?? []} max={100} /></div>
    </div>
  );
}

export function EmsxOrderLive({ onClose }: { onClose?: () => void }) {
  return (
    <PanelShell code="EMSX" title="执行管理系统 · 订单录入" onClose={onClose}>
      <EmsxOrderEntry />
    </PanelShell>
  );
}

export default EmsxOrderLive;
