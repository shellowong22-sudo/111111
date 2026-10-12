import DerivativesBase from './DerivativesBase';

export default function MultiAssetRisk() {
  return (
    <DerivativesBase
      title="多资产风险系统 (MARS)"
      code="MARS"
      description="投资组合的VaR、压力测试和风险因子分解"
      apiEndpoint="https://api.example.com/derivatives/multi-asset-risk"
      dataType="option"
    />
  );
}
