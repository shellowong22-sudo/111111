import DerivativesBase from './DerivativesBase';

export default function IndexFutures() {
  return (
    <DerivativesBase
      title="股指期货市场"
      code="INDEX_FUT"
      description="全球主要股票指数期货的实时行情和技术分析"
      apiEndpoint="https://api.example.com/derivatives/index-futures"
      dataType="futures"
    />
  );
}
