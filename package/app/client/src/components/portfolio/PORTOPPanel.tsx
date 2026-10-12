/** PORT OP 组合优化：与组合中心的“组合优化”为同一功能，统一到同一实现 */
import PortfolioTerminal from "@/uc/hubs/PortfolioTerminal";
export default function PORTOPPanel(_props: Record<string, unknown> = {}) {
  return <PortfolioTerminal initialFunc="opt" />;
}
