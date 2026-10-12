import DerivativesBase from './DerivativesBase';

export default function GlobalCDSMarket() {
  return (
    <DerivativesBase
      title="全球CDS行情显示 (WCDS)"
      code="WCDS"
      description="全球信用违约互换市场的实时行情、点差分析和流动性监控"
      apiEndpoint="https://api.example.com/derivatives/global-cds"
      dataType="cds"
    />
  );
}
