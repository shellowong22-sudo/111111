import DerivativesBase from './DerivativesBase';

export default function CommodityFutures() {
  return (
    <DerivativesBase
      title="商品期货市场"
      code="COMM_FUT"
      description="期货公开行情与周度持仓观察；具体时点以各行观察日为准"
      apiEndpoint="openbb://derivatives_futures_curve"
      dataType="futures"
    />
  );
}
