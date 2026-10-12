import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const protectedFiles: Record<string, string> = {
  'client/src/components/DerivativesMenu.tsx': 'fa6fcc5243d6a961a8344681c0c72b8196fd96bdb487202983229d90c02c145a',
  'client/src/components/OVPanel.tsx': 'd286352c1d6164acbe4a7bca31cfe8567225c0159e8d8fb1d4c398e8fc84bc19',
  'client/src/components/OILSPanel.tsx': '0f0156d248e5982dcfc942fbb721211ad7487ee0ed6345058d005740fb664fc1',
  // FOM 保留原页面并已完成真实数据边界升级：禁止恢复正弦 OI、生成
  // Greeks 或在无授权数据时导出替代值。此哈希保护升级后的完整页面。
  'client/src/pages/FuturesOptionsMonitor.tsx': '8e46c3d0aac3d794488f31545bfa87a38c62b63630b5f7a62810827134090377',
  'client/src/pages/WBFAdvanced.tsx': 'b2b3444fbffa0072df2963394b433b9377d54d7a9648283ebfa1dba039d459e8',
  // 两份恢复归档与当前文件逐字一致；旧测试使用了不存在于任一可用归档的错误基线。
  'client/src/pages/CreditMonitorAdvanced.tsx': '89b9d237980396d13c1c0d3c548969cdd1d3af87013d96b2fc67c5c4a0f23530',
  // 当前文件与外层恢复归档逐字一致；_baseline_archive 仍保存旧版示例页面。
  'client/src/components/CDSWPanel.tsx': '2474d5f96ff9e4242810e07f271672887a0d5c721ae40028c7883ee411e9b4be',
  'client/src/components/VCAPanel.tsx': '33056daf6e3a0f1416abeb17844a0719d9eedc4d873ce0df7fefebdfd75a1764',
  'client/src/components/MARSPanel.tsx': 'f289c8fa22024945975f77e4af1d6e6d104391a791f6efc14d5fcd499285aa8c',
  'client/src/components/OVCVPanel.tsx': 'd2f0eb319f01667ff4ed8625c2b9ae411db44cb0f4a22253f6d527677bf4a189',
  'client/src/components/DLIBPanel.tsx': '7787f97e8a3266dba01fe2ea72acee4def98af0d3fe851cfad581404f19848ad',
  // MOSO 保留原有动量、反转、因子与波动率区；期权数据改为真实源边界，不再生成随机行情。
  'client/src/components/MOSOPanel.tsx': '3a0c06130fed1fe352d50c3805a0bd519f4b14f4a521cd3fff1bd9088bde9cdc',
  // OVML 保留 GK 定价、波动率微笑、策略与 Greeks 原功能；明确标注参数和流量图为模型示例。
  'client/src/components/OVMLPanel.tsx': '203f9aba5420198cc3f3ee339ef07507a034fb49048e937093c3395675b860f0',
};

describe('derivatives original-content protection', () => {
  it('keeps the preserved derivatives menu and every existing derivatives panel byte-identical', () => {
    for (const [relativePath, expected] of Object.entries(protectedFiles)) {
      const actual = createHash('sha256').update(readFileSync(resolve(process.cwd(), relativePath))).digest('hex');
      expect(actual, relativePath).toBe(expected);
    }
  });

  it('keeps the FOM data layer free of generated market observations', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/pages/FuturesOptionsMonitor.tsx'), 'utf8');
    expect(source).not.toContain('Math.sin');
    expect(source).not.toContain('Array.from({length:11}');
    expect(source).not.toContain('Array.from({length:20}');
    expect(source).toContain('未配置授权期货持仓量数据源');
    expect(source).toContain('期权链数据源未配置；未生成替代 Delta。');
  });

  it('keeps every original MOSO research surface without restoring simulated options data', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/components/MOSOPanel.tsx'), 'utf8');
    for (const label of ['动量排行', '动量散点', '反转信号', '因子时序', '因子绩效', '期权波动率深度分析', '隐含波动率微笑曲线（不同到期日）', 'Put/Call 比率趋势（看跌情绪指标）', 'VIX指数', 'ATM隐含波动率', '偏度(Skew)', '期权成交量']) {
      expect(source).toContain(label);
    }
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('Math.sin');
    expect(source).toContain('期权行情源未配置');
    expect(source).toContain('不绘制替代曲线');
  });

  it('keeps OVML model controls while clearly separating examples from live market data', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/components/OVMLPanel.tsx'), 'utf8');
    for (const label of ['期权定价', '波动率微笑', '期权策略', 'Greeks矩阵', 'Garman-Kohlhagen外汇期权定价模型', '模型 Gamma 敏感度 & 示例流量分布', '数据源未配置']) {
      expect(source).toContain(label);
    }
    expect(source).toContain('不是实时外汇期权报价');
    expect(source).toContain('示例流量 CSV');
    expect(source).not.toContain('Math.random');
  });
});
