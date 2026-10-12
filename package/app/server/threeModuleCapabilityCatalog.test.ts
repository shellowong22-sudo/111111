import { describe, expect, it } from "vitest";
import {
  INDUSTRY_GROUP_CAPABILITIES,
  PREFERRED_STOCK_CAPABILITIES,
  STOCK_CAPABILITIES,
  assertThreeModuleCatalogs,
} from "@shared/threeModuleCapabilityCatalog";
import {
  ADMIN_DATA_MODULES,
  resolveAdminDataModulesForPath,
} from "@shared/adminDataModules";

describe("33/23/22 三模块冻结目录", () => {
  it("固定能力数量并拒绝重复 ID、名称、职责和代码", () => {
    expect(assertThreeModuleCatalogs()).toBe(true);
    for (const [items, expected] of [
      [STOCK_CAPABILITIES, 33],
      [PREFERRED_STOCK_CAPABILITIES, 23],
      [INDUSTRY_GROUP_CAPABILITIES, 22],
    ] as const) {
      expect(items).toHaveLength(expected);
      for (const key of ["id", "code", "name", "responsibility"] as const) {
        expect(new Set(items.map(item => item[key])).size).toBe(expected);
      }
    }
  });

  it("优先股和行业分组目录完整匹配纠偏执行令", () => {
    expect(PREFERRED_STOCK_CAPABILITIES.map(item => item.name)).toEqual([
      "优先股总览", "报价与时效", "买卖盘口", "成交明细", "发行条款", "票面股息率", "股息支付记录", "累积与非累积", "参与与非参与", "可转换条款", "可赎回条款", "回售条款", "转股价值", "转换溢价", "到期收益分析", "当前收益率", "利率敏感性", "信用评级", "发行人信用", "偿付顺序", "流动性分析", "同类证券比较", "风险与情景分析",
    ]);
    expect(INDUSTRY_GROUP_CAPABILITIES.map(item => item.name)).toEqual([
      "行业分类体系", "行业成分", "行业行情", "行业涨跌", "行业成交", "行业资金流", "行业市场宽度", "行业估值", "行业盈利", "行业盈利预测", "行业营收增长", "行业利润增长", "行业资产负债", "行业现金流", "行业资本开支", "行业股息", "行业波动率", "行业相关性", "行业轮动", "行业贡献度", "行业景气度", "行业风险与压力情景",
    ]);
  });

  it("每个能力只解析到一个后台目标且不继承通用终端流", () => {
    const groups = [
      [STOCK_CAPABILITIES, "stocks", "stock-"],
      [PREFERRED_STOCK_CAPABILITIES, "preferred-stock", "preferred-stock-"],
      [INDUSTRY_GROUP_CAPABILITIES, "industry-group", "industry-group-"],
    ] as const;
    for (const [items, moduleId, prefix] of groups) {
      for (const item of items) {
        const path = `/terminal?open=${encodeURIComponent(item.id)}&module=${moduleId}`;
        const matches = resolveAdminDataModulesForPath(path);
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(`${prefix}${item.id.toLowerCase()}`);
        expect(matches[0].path).toBe(path);
      }
    }
    expect(ADMIN_DATA_MODULES.some(item => item.id === "terminal" && item.path !== "/terminal")).toBe(false);
  });
});
