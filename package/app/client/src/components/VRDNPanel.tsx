import { useState } from "react";
import { AlertTriangle, Database, RefreshCw, X, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  onClose?: () => void;
}

const views = ["实时监控", "历史利率", "流动性分析"] as const;
const analysisTabs = ["利率对比", "重设周期", "流动性分析"] as const;

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/60 px-4 py-12 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <p className="mt-3 text-sm font-semibold text-slate-200">{title}</p>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {text}
      </p>
    </div>
  );
}

export default function VRDNPanel({ onClose }: Props) {
  const [view, setView] = useState<(typeof views)[number]>("实时监控");
  const [analysisTab, setAnalysisTab] =
    useState<(typeof analysisTabs)[number]>("利率对比");
  const status = trpc.municipalResearch.getVrdnSevenDayStatus.useQuery(
    undefined,
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
    }
  );
  const limitation =
    status.data?.limitation ??
    "正在检查逐券 VRDN 数据契约；失败时不使用旧证券或其他指数替代。";

  return (
    <div className="flex h-full flex-col overflow-auto bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-sm font-bold text-amber-400">
            VRDN
          </span>
          <span className="text-sm font-semibold text-white">
            佑诚7天VRDN监控
          </span>
          <span className="ml-2 text-[10px] text-gray-500">
            Variable Rate Demand Notes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => status.refetch()}
            disabled={status.isFetching}
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${status.isFetching ? "animate-spin" : ""}`}
            />
            刷新检查
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex items-start gap-2 border-b border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            独立契约{" "}
            {status.data?.dataContractId ?? "municipal-vrdn-seven-day-market"} ·
            最近检查{" "}
            {status.data?.checkedAt
              ? new Date(status.data.checkedAt).toLocaleString()
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
        {["7天VRDN均值", "SIFMA指数", "未偿还总额", "今日利率变动"].map(
          label => (
            <div key={label} className="rounded bg-gray-800/60 p-2 text-center">
              <div className="font-mono text-base font-bold text-slate-500">
                —
              </div>
              <div className="mt-0.5 text-[9px] text-gray-500">{label}</div>
            </div>
          )
        )}
      </div>

      <nav className="flex overflow-x-auto border-b border-gray-800 bg-gray-900/70">
        {views.map(tab => (
          <button
            type="button"
            key={tab}
            onClick={() => setView(tab)}
            className={`whitespace-nowrap px-3 py-2 text-xs ${view === tab ? "border-b-2 border-amber-400 text-amber-400" : "text-gray-400 hover:text-gray-200"}`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="flex-1 space-y-4 overflow-auto p-4">
        {view === "实时监控" && (
          <section className="overflow-hidden rounded border border-gray-800">
            <table className="w-full min-w-[1050px] text-[11px]">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  {[
                    "发行人",
                    "CUSIP",
                    "当前利率",
                    "变动",
                    "流动性提供方",
                    "信用支持",
                    "评级",
                    "未偿额(M)",
                    "重置模式",
                    "下次重置",
                    "行动",
                  ].map(field => (
                    <th key={field} className="px-3 py-2 text-left font-medium">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-xs text-slate-500"
                  >
                    未接入获准的逐券 VRDN
                    主数据、利率和流动性支持字段；不显示静态证券，也不提供无执行通道的申购按钮。
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
        {view === "历史利率" && (
          <>
            <Empty
              title="VRDN利率 vs SIFMA vs Fed Funds（近30日）"
              text="三组序列必须按同一观察日独立取得。当前仅有其他功能的公开参考利率，不能复制成 VRDN 或 SIFMA 历史。"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {["VRDN/SIFMA利差", "VRDN/Fed Funds比率", "30日波动率"].map(
                label => (
                  <div
                    key={label}
                    className="rounded border border-gray-800 bg-gray-900 p-3"
                  >
                    <p className="font-mono text-xl text-slate-500">—</p>
                    <p className="mt-1 text-xs text-gray-300">{label}</p>
                    <p className="mt-1 text-[10px] text-gray-500">
                      缺少同口径观察，不计算
                    </p>
                  </div>
                )
              )}
            </div>
          </>
        )}
        {view === "流动性分析" && (
          <section className="overflow-hidden rounded border border-gray-800 bg-gray-900">
            <h3 className="px-3 py-3 text-xs font-semibold text-gray-300">
              流动性提供方分析
            </h3>
            <table className="w-full text-[11px]">
              <thead className="border-y border-gray-800 text-gray-400">
                <tr>
                  {[
                    "银行",
                    "支持只数",
                    "总规模(M)",
                    "均值利率",
                    "信用评级",
                  ].map(field => (
                    <th key={field} className="px-3 py-2 text-left font-medium">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-12 text-center text-slate-500"
                  >
                    未接入获准的流动性支持协议与银行敞口，不生成银行、评级或风险结论。
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        <section className="rounded-xl border border-gray-800 bg-[#0d1117] p-4 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                VRDN利率重设周期分析仪
              </h3>
            </div>
            <nav className="flex overflow-x-auto rounded-lg border border-gray-800 bg-gray-900 p-1">
              {analysisTabs.map(tab => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setAnalysisTab(tab)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${analysisTab === tab ? "bg-indigo-500/20 text-indigo-400" : "text-gray-400 hover:text-gray-200"}`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          {analysisTab === "利率对比" && (
            <Empty
              title="VRDN / SIFMA / SOFR 利率对比"
              text="缺少 VRDN 与 SIFMA 获准序列时，不把 SOFR 单独绘制成三线对比。"
            />
          )}
          {analysisTab === "重设周期" && (
            <Empty
              title="重设规模与平均重设利率"
              text="需要逐券重设日、重设规模和结果利率；当前没有可验证数据，不按星期生成柱线图。"
            />
          )}
          {analysisTab === "流动性分析" && (
            <Empty
              title="流动性规模与重设利率"
              text="需要同一流动性支持方的规模、利率和交易活跃度；当前不生成机构气泡。"
            />
          )}
        </section>
      </main>
    </div>
  );
}
