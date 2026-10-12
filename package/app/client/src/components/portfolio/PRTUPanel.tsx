/** PRTU 组合管理：持仓录入与保存统一使用组合中心（与 /portfolio-optimizer 同一实现），不再另做一套 */
import PortfolioTerminal from "@/uc/hubs/PortfolioTerminal";
export default function PRTUPanel(_props: Record<string, unknown> = {}) {
  return <PortfolioTerminal initialFunc="hold" />;
}
