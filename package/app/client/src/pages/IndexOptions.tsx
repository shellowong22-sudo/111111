import DerivativesBase from './DerivativesBase';

export default function IndexOptions() {
  return (
    <DerivativesBase
      title="股指期权定价"
      code="INDEX_OPT"
      description="股票指数期权的定价、波动率和风险管理"
      apiEndpoint="openbb://derivatives_options_chains"
      dataType="option"
    />
  );
}
