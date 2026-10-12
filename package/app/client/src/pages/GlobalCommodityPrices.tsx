import DerivativesBase from './DerivativesBase';

export default function GlobalCommodityPrices() {
  return (
    <DerivativesBase
      title="全球商品价格 (GLCO)"
      code="GLCO"
      description="石油、天然气、金属和农产品的全球实时价格和市场分析"
      apiEndpoint="https://api.example.com/derivatives/commodity-prices"
      dataType="commodity"
    />
  );
}
