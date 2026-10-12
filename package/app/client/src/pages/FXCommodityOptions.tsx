import DerivativesBase from './DerivativesBase';

export default function FXCommodityOptions() {
  return (
    <DerivativesBase
      title="外汇/商品期权定价 (OVML)"
      code="OVML"
      description="外汇和商品期权的实时定价、隐含波动率和对冲策略"
      apiEndpoint="https://api.example.com/derivatives/fx-commodity-options"
      dataType="option"
    />
  );
}
