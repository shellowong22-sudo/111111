import DerivativesBase from './DerivativesBase';

export default function DerivativesNews() {
  return (
    <DerivativesBase
      title="新闻：衍生品 (NI DRV)"
      code="NI DRV"
      description="衍生品市场的最新新闻、市场评论和交易分析"
      apiEndpoint="https://api.example.com/derivatives/news"
      dataType="news"
    />
  );
}
