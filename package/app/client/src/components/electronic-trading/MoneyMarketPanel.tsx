/** 电子交易 MONEY 货币市场：与货币市场 BTMM 资金面监控为同一实现（隔夜利率、短端利差、逆回购与成交规模，真实数据） */
import { BtmmLive } from "@/components/live/MMLive2";
export default function MoneyMarketPanel(_props: Record<string, unknown> = {}) {
  return <BtmmLive code="MONEY" />;
}
