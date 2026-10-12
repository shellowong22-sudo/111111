import DerivativesBase from './DerivativesBase';

export default function GlobalBondFutures() {
  return (
    <DerivativesBase
      title="全球债券期货 (WBF)"
      code="WBF"
      description="全球主要债券期货市场的实时行情、技术分析和交易工具"
      apiEndpoint="https://api.example.com/derivatives/bond-futures"
      dataType="futures"
    />
  );
}
