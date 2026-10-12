import { Send } from "lucide-react";
import { trpc } from "@/lib/trpc";

function displayDate(value: string | Date | null | undefined) {
  if (!value) return "未记录时间";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "未记录时间"
    : date.toLocaleString("zh-CN");
}

/**
 * 推送内容来自后台，但这是终端用户视图。内部路由、爬虫版本和数据库字段
 * 永远不应出现在用户可见文本中；只保留标题、正文和公开来源。
 */
function publicText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return (
    value
      // 管理端的编排字段只服务于后台筛选，终端只呈现市场事实与研究摘要。
      .replace(
        /(?:爬虫数据内容|指定模块|推送目标|数据主题|内容说明|AI\s*改写方式|改写引擎|证据输入|关联标的|策略|提示词|转换规则)\s*[:：][^。；\n]+[。；]?/gi,
        ""
      )
      .replace(
        /(?:模块专属评分|评分、排序与评级均为明确标识的本地模拟分析|仅用于功能演示|本条内容使用[^。]+。)/gi,
        ""
      )
      .replace(
        /(?:全局公告横幅|系统数据|配置变化线索|本地模拟分析|模拟上调观察|模拟维持观察|模拟下调观察|模拟资金流向观察|模拟活跃席位观察|模拟资金分歧观察)/gi,
        ""
      )
      .replace(
        /(?:分析视角|fund_flow|source_type|view_type)\s*[:：][^。；\n]+[。；]?/gi,
        ""
      )
      .replace(/(?:^|[·，。；\s])\d+\s*\/\s*98(?=$|[·，。；\s])/g, "")
      .replace(/来源标题、证券代码、上市地与来源链接保留原始出处/gi, "")
      .replace(/crawler(?:[-_ ]?v?\d+(?:\.\d+)*)?/gi, "")
      .replace(
        /后台人工定向推送|当前功能已映射|模块ID|moduleId|target_front_module_ids|candidate_push_module_ids/gi,
        ""
      )
      .replace(
        /(?:sourceReference|targetPath|strategyKey|promptKey|viewType|sourceType|transformationVersion)\s*[:：]\s*[^\s，。；]+/gi,
        ""
      )
      .replace(/(?:^|\s)(?:path|route|sourceReference)\s*[:：]\s*[^\s]+/gi, "")
      .replace(/[·|,:：；。]{2,}/g, " · ")
      .replace(/^[·|,:：；。\s]+|[·|,:：；。\s]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || fallback
  );
}

function publicSource(item: { sourceKind?: string }) {
  return item.sourceKind === "real" || item.sourceKind === "public"
    ? "公开来源"
    : "市场观察";
}

export default function PushedModuleFeed() {
  const path = `${window.location.pathname}${window.location.search}`;
  const feedQuery = trpc.adminDataModules.getFeedsForPath.useQuery(
    { path },
    { retry: false, staleTime: 10_000, refetchInterval: 30_000 }
  );
  const feeds = (feedQuery.data ?? []).filter(feed => feed.items.length > 0);
  const uniqueItems = feeds
    .flatMap(feed =>
      feed.items.map(item => ({
        ...item,
        publicModuleName: publicText(feed.moduleName, "市场更新"),
      }))
    )
    .map(item => ({
      ...item,
      publicTitle: publicText(item.title, "市场信息更新"),
      publicBody: publicText(item.body),
      publicCategory: publicText(item.category ?? item.topic, "市场资讯"),
    }))
    .filter(
      (item, index, all) =>
        all.findIndex(
          candidate =>
            `${candidate.publicTitle}|${candidate.publicBody}` ===
            `${item.publicTitle}|${item.publicBody}`
        ) === index
    )
    .slice(0, 12);
  const total = uniqueItems.length;

  if (!total) return null;

  return (
    <section
      data-testid="pushed-module-feed"
      className="border-b border-cyan-800/60 bg-[#07111f] px-3 py-3 text-slate-100"
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-center gap-2">
          <Send className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-cyan-200">市场更新</h2>
          <span className="border border-cyan-800 bg-cyan-950/50 px-2 py-0.5 text-[10px] text-cyan-300">
            最新更新 {total} 条
          </span>
          <span className="text-[10px] text-slate-500">
            按当前页面展示相关的市场与研究信息
          </span>
        </div>

        <div className="mt-2 max-h-64 overflow-auto border-y border-slate-800">
          <table className="w-full min-w-[760px] text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-slate-950 text-[10px] text-slate-500">
              <tr>
                <th className="w-36 px-2 py-2 font-normal">主题 / 来源</th>
                <th className="px-2 py-2 font-normal">推送内容</th>
                <th className="w-44 px-2 py-2 font-normal">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {uniqueItems.map(item => {
                const sourceLabel = publicSource(item);
                return (
                  <tr
                    key={item.itemKey}
                    className="border-t border-slate-800 align-top"
                  >
                    <td className="px-2 py-2 text-[10px]">
                      <div className="text-cyan-500">
                        {item.publicCategory || "市场资讯"}
                      </div>
                      <div className="mt-1 text-emerald-300">{sourceLabel}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold leading-5 text-slate-100">
                        {item.publicTitle}
                      </div>
                      {item.publicBody && (
                        <p className="mt-1 whitespace-pre-wrap leading-5 text-slate-300">
                          {item.publicBody}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[10px] text-slate-500">
                      {displayDate(item.publishedAt ?? item.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
