import DerivativesBase from './DerivativesBase';

export default function ActiveOptions() {
  return (
    <DerivativesBase
      title="交易最活跃期权 (MOSO)"
      code="MOSO"
      description="全球最活跃期权合约的实时成交量、波动率和价格走势"
      apiEndpoint="https://api.example.com/derivatives/most-active-options"
      dataType="option"
    />
  );
}
