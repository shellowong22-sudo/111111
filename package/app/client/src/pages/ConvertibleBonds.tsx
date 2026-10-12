import DerivativesBase from './DerivativesBase';

export default function ConvertibleBonds() {
  return (
    <DerivativesBase
      title="可转换债券估价 (OVCV)"
      code="OVCV"
      description="可转换债券的实时估价、转换权价值和风险分析"
      apiEndpoint="https://api.example.com/derivatives/convertible-bonds"
      dataType="option"
    />
  );
}
