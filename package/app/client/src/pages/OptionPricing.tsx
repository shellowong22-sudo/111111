import DerivativesBase from './DerivativesBase';

export default function OptionPricing() {
  return (
    <DerivativesBase
      title="股票/利率期权定价 (OVME)"
      code="OVME"
      description="股票和利率期权的Black-Scholes定价、希腊值计算和风险管理"
      apiEndpoint="https://api.example.com/derivatives/option-pricing"
      dataType="option"
    />
  );
}
