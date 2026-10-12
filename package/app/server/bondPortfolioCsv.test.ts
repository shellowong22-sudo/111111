import { describe, expect, it } from 'vitest';
import { buildBondPortfolioErrorReport, importBondPortfolioRows, inspectBondPortfolioCsv } from '../client/src/lib/bondPortfolioCsv';

describe('债券组合 CSV 映射与失败报告', () => {
  it('自动识别常见别名并在应用映射后导入有效持仓', () => {
    const inspection = inspectBondPortfolioCsv('ISIN,Notional,Coupon,YTM,Years,Frequency\nUS0001,1000000,4,4.1,5,2');
    const result = importBondPortfolioRows(inspection, inspection.mapping);
    expect(result.missingFields).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.positions).toEqual([{ identifier: 'US0001', faceValue: 1_000_000, couponRate: 4, maturityYears: 5, yieldToMaturity: 4.1, frequency: 2 }]);
  });

  it('保留行号、失败原因和原始字段值以供下载错误报告', () => {
    const inspection = inspectBondPortfolioCsv('identifier,faceValue,couponRate,maturityYears,yieldToMaturity\nBAD,0,4,5,4\nGOOD,100,4,5,4');
    const result = importBondPortfolioRows(inspection, inspection.mapping);
    expect(result.positions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ rowNumber: 2, reason: '面值须为正数' });
    const report = buildBondPortfolioErrorReport(inspection.headers, result.errors);
    expect(report).toContain('rowNumber,reason,rawValues');
    expect(report).toContain('2,面值须为正数');
    expect(report).toContain('identifier: BAD');
  });

  it('缺失必填映射时不导入任何持仓', () => {
    const inspection = inspectBondPortfolioCsv('foo,bar\nA,1');
    const result = importBondPortfolioRows(inspection, inspection.mapping);
    expect(result.positions).toEqual([]);
    expect(result.missingFields).toContain('identifier');
    expect(result.missingFields).toContain('yieldToMaturity');
  });
});
