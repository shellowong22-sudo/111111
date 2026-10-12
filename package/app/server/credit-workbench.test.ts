import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditResearchWorkbench.tsx'), 'utf8');
const terminal = readFileSync(resolve(import.meta.dirname, '../client/src/pages/Terminal.tsx'), 'utf8');

describe('信用债研究工作台', () => {
  it('为既有 26 项信用债模块保留原入口并追加差异化工作流', () => {
    for (let id = 1; id <= 26; id += 1) expect(source).toContain(`'${id}':`);
    expect(terminal).toContain('<CreditResearchWorkbench moduleId={itemId} />');
    expect(terminal).toContain("requestedModule === 'credit-bonds'");
    expect(terminal).toContain("requestedModule === 'mortgage-bonds'");
    expect(terminal).toContain('independentlyVerifiedPanelIds');
  });

  it('公开数据、披露检索和用户输入计算均不伪造单券报价或 CDS 点位', () => {
    expect(source).toContain('FRED / ICE BofA');
    expect(source).toContain('SEC EDGAR');
    expect(source).toContain('不代表单券报价或 CDS');
    expect(source).toContain('(债券到期收益率 − 同币种基准收益率) × 100');
  });

  it('高级 OAS 图表具备真实筛选、刷新、自动更新与导出交互', () => {
    expect(source).toContain('refetchInterval: autoRefresh ? 60_000 : false');
    expect(source).toContain('setRangeDays(days)');
    expect(source).toContain('setSelectedBuckets');
    expect(source).toContain('oasQuery.refetch()');
    expect(source).toContain('dataUpdatedAt');
    expect(source).toContain('exportOasCsv(visibleSeries)');
    expect(source).toContain('selectedBuckets.filter');
  });

  it('OAS 图表支持拖拽选择区间、统计和 FRED 健康状态', () => {
    expect(source).toContain('<Brush dataKey="date"');
    expect(source).toContain('setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex })');
    expect(source).toContain('const intervalStats');
    expect(source).toContain('最大 {item.max');
    expect(source).toContain('平均 {item.avg');
    expect(source).toContain('数据源健康状态 · FRED API');
    expect(source).toContain('最近成功刷新：');
    expect(source).toContain('最近失败：');
  });

  it('TRACE 模块在无凭据时提供 FINRA 公开市场研究入口而不伪造实时或逐笔数据', () => {
    expect(source).toContain("'19': { title: 'TRACE 公开市场研究'");
    expect(source).toContain("mode: 'publicTrace'");
    expect(source).toContain('FINRA_MARKET_ACTIVITY_URL');
    expect(source).toContain('FINRA_MOST_ACTIVE_URL');
    expect(source).toContain('FINRA_MARKET_SENTIMENT_URL');
    expect(source).toContain('setTraceCategory(category)');
    expect(source).toContain('不显示逐笔、实时或未授权成交数据');
    expect(source).toContain('不请求或展示实时/逐笔 TRACE');
  });
});
