import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Calculator,
  Database,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  onClose?: () => void;
}

const mainTabs = ["利率矩阵", "历史走势", "税率盈亏平衡"] as const;
const depthTabs = ["比值历史", "投资时钟", "套利策略"] as const;

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {text}
      </p>
    </section>
  );
}

export default function BMAPanel({ onClose }: Props) {
  const [mainTab, setMainTab] = useState<(typeof mainTabs)[number]>("利率矩阵");
  const [depthTab, setDepthTab] =
    useState<(typeof depthTabs)[number]>("比值历史");
  const [taxRate, setTaxRate] = useState("37");
  const [yieldInput, setYieldInput] = useState("");
  const status = trpc.municipalResearch.getBmaSwapIndexStatus.useQuery(
    undefined,
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
    }
  );
  const yieldPct = Number(yieldInput);
  const taxPct = Number(taxRate);
  const taxEquivalent = useMemo(() => {
    if (!Number.isFinite(yieldPct) || !Number.isFinite(taxPct) || taxPct >= 100)
      return null;
    return yieldPct / (1 - taxPct / 100);
  }, [taxPct, yieldPct]);
  const limitation =
    status.data?.limitation ??
    "正在检查 BMA/SIFMA 数据契约；失败时保持空态，不回退到其他利率。";

  return (
    <div className="flex h-full flex-col overflow-auto bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-sm font-bold text-amber-400">
            BMA
          </span>
          <span className="text-sm font-semibold text-white">
            地方债掉期指数
          </span>
          <span className="ml-2 text-[10px] text-gray-500">
            BMA/SIFMA Swap Index
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600">
            {status.data?.dataContractId ?? "municipal-bma-swap-index"} · 每 1
            分钟检查
          </span>
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
            最近检查：
            {status.data?.checkedAt
              ? new Date(status.data.checkedAt).toLocaleString()
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
        {["BMA 7天", "BMA/SOFR比率", "税等价收益", "10Y BMA/SOFR利差"].map(
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

      <div className="flex-1 overflow-auto">
        <nav className="flex overflow-x-auto border-b border-gray-800 bg-gray-900/70">
          {mainTabs.map(tab => (
            <button
              type="button"
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`whitespace-nowrap px-3 py-2 text-xs ${mainTab === tab ? "border-b-2 border-amber-400 text-amber-400" : "text-gray-400 hover:text-gray-200"}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="space-y-4 p-4">
          {mainTab === "利率矩阵" && (
            <EmptyBlock
              title="BMA/SIFMA 期限结构"
              text="期限矩阵需要获准的 BMA/SIFMA 期限序列；SOFR、SLGS 和 VRDN 是不同数据契约，不能填入这里。"
            />
          )}
          {mainTab === "历史走势" && (
            <EmptyBlock
              title="BMA 7天利率历史"
              text="没有可验证的 BMA/SIFMA 历史观察时不绘制折线、比值或分位数，不以旧样例保持图形活跃。"
            />
          )}
          {mainTab === "税率盈亏平衡" && (
            <section className="rounded border border-gray-800 bg-gray-900 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Calculator className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-gray-300">
                  税率盈亏平衡 · 用户输入测算
                </h3>
                <label className="ml-auto text-[11px] text-gray-400">
                  免税收益率 (%)
                  <input
                    value={yieldInput}
                    onChange={event => setYieldInput(event.target.value)}
                    inputMode="decimal"
                    className="ml-2 w-20 input-terminal"
                  />
                </label>
                <label className="text-[11px] text-gray-400">
                  边际税率 (%)
                  <input
                    value={taxRate}
                    onChange={event => setTaxRate(event.target.value)}
                    inputMode="decimal"
                    className="ml-2 w-16 input-terminal"
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] text-gray-500">用户输入收益率</p>
                  <p className="mt-1 font-mono text-lg text-amber-400">
                    {Number.isFinite(yieldPct)
                      ? `${yieldPct.toFixed(3)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">用户输入税率</p>
                  <p className="mt-1 font-mono text-lg text-blue-400">
                    {Number.isFinite(taxPct) ? `${taxPct.toFixed(2)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">税等价收益率</p>
                  <p className="mt-1 font-mono text-lg text-green-400">
                    {taxEquivalent == null
                      ? "—"
                      : `${taxEquivalent.toFixed(3)}%`}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-gray-500">
                仅由用户输入计算，不代表 BMA 市场报价、SOFR
                预测、地方债利差或套利建议。
              </p>
            </section>
          )}

          <section className="rounded-lg border border-gray-800 bg-[#111827] p-4">
            <div className="mb-3 flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">
                BMA/SOFR掉期比值研究
              </h2>
            </div>
            <nav className="flex overflow-x-auto rounded border border-gray-700">
              {depthTabs.map(tab => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setDepthTab(tab)}
                  className={`whitespace-nowrap px-3 py-2 text-xs ${depthTab === tab ? "bg-purple-600/40 text-purple-300" : "text-gray-400 hover:text-gray-200"}`}
                >
                  {tab}
                </button>
              ))}
            </nav>
            {depthTab === "比值历史" && (
              <div className="mt-4">
                <EmptyBlock
                  title="比值历史与市场分位数"
                  text="独立 BMA/SIFMA 比值历史未接入；不使用 SOFR 比值或固定分位数代替。"
                />
              </div>
            )}
            {depthTab === "投资时钟" && (
              <div className="mt-4">
                <EmptyBlock
                  title="比值与地方债利差点位"
                  text="没有同日 BMA/SIFMA 比值与地方债利差配对观察时，不生成气泡点或投资时钟区域。"
                />
              </div>
            )}
            {depthTab === "套利策略" && (
              <div className="mt-4">
                <EmptyBlock
                  title="套利策略条件"
                  text="只保留研究位置。未接入可验证比值、利差和交易成本序列，不输出方向性套利建议。"
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
