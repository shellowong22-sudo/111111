import { useState } from "react";
import { AlertTriangle, Database, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface BOOMPanelProps {
  onClose: () => void;
}

const tabs = [
  "纳什均衡投标分布",
  "中标利率历史走势",
  "VPIN流动性毒性",
  "竞标者行为分析",
  "实战信号",
] as const;

const unavailableCopy = {
  纳什均衡投标分布:
    "需要获准的逐笔投标利率、数量和参与者边界。当前没有这些观测，不以正态分布或噪声曲线模拟实际投标。",
  中标利率历史走势:
    "需要与本 VRDN 库存功能对应的正式发售结果历史。国债拍卖属于其他功能，不能复制到这里冒充 VRDN 历史。",
  VPIN流动性毒性:
    "VPIN 需要同一市场的逐笔成交方向和等量成交桶。当前未接入逐笔流，不计算阈值、异常或操纵结论。",
  竞标者行为分析:
    "需要获准的参与者分类、投标利率和投标量。当前不生成银行、基金、券商或保险的虚构散点。",
  实战信号:
    "拥挤、尾部风险和胜率需要可回测的独立样本。输入未齐时保持未计算，不发布交易信号。",
} satisfies Record<(typeof tabs)[number], string>;

function EmptyResearch({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-8 w-8 text-slate-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </section>
  );
}

function MetricCard({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-slate-500">—</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-600">{detail}</p>
    </div>
  );
}

export default function BOOMPanel({ onClose }: BOOMPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [vrdnIndex, setVrdnIndex] = useState(0);
  const status = trpc.municipalResearch.getBoomVrdnInventoryStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const currentTab = tabs[selectedIndex];
  const limitation =
    status.data?.limitation ??
    "正在检查 VRDN 库存数据契约；检查失败时不会回退到静态或随机数据。";

  return (
    <div className="h-full overflow-auto rounded-lg bg-gray-950 p-6 text-white shadow-lg">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-amber-400">
            BOOM货币市场发售 (Nash Equilibrium Bidding)
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            独立契约{" "}
            {status.data?.dataContractId ?? "municipal-boom-vrdn-inventory"}· 每
            1 分钟检查配置，不代表实时成交
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xl text-gray-400 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="mb-4 flex items-start gap-2 rounded border border-amber-900/70 bg-amber-950/20 p-3 text-xs text-amber-100">
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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="当前中标利率"
          detail="未接入本功能对应的正式发售结果"
        />
        <MetricCard label="认购倍数" detail="未接入同口径投标与接受金额" />
        <MetricCard label="尾部利率" detail="未接入逐笔投标尾部分布" />
        <MetricCard label="VPIN指数" detail="未接入等量成交桶与交易方向" />
      </div>

      <nav className="flex overflow-x-auto border-b border-gray-700">
        {tabs.map((tab, index) => (
          <button
            type="button"
            key={tab}
            onClick={() => setSelectedIndex(index)}
            className={`whitespace-nowrap px-3 py-2 text-sm ${
              index === selectedIndex
                ? "border-b-2 border-amber-400 text-amber-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {currentTab === "实战信号" ? (
        <div className="mt-6 space-y-4">
          {["投标拥挤信号", "尾部风险信号"].map(label => (
            <section
              key={label}
              className="rounded-lg border border-gray-700 bg-gray-900 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-400">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-500">
                    未计算
                  </p>
                </div>
                <span className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-500">
                  胜率未验证
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-500">
                保留原信号研究位置。缺少同一市场、同一口径的认购、尾部与事后表现样本时，不触发信号、不报告胜率，也不扩展为国债、政策性金融债或同业存单建议。
              </p>
            </section>
          ))}
        </div>
      ) : (
        <EmptyResearch
          title={currentTab}
          detail={unavailableCopy[currentTab]}
        />
      )}

      <section className="mt-8 rounded-lg border border-gray-700 bg-[#111827] p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold text-purple-400">
            VRDN库存市场供需分析仪
          </h2>
        </div>
        <nav className="flex border-b border-gray-700">
          {["库存分析", "利率关联"].map((tab, index) => (
            <button
              type="button"
              key={tab}
              onClick={() => setVrdnIndex(index)}
              className={`px-3 py-2 text-sm ${
                index === vrdnIndex
                  ? "border-b-2 border-purple-400 text-purple-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
        <EmptyResearch
          title={
            vrdnIndex === 0
              ? "VRDN库存规模历史趋势"
              : "VRDN库存规模 vs 利率关系气泡图"
          }
          detail={
            vrdnIndex === 0
              ? "库存、新发行和到期量必须来自同一获准 VRDN 持仓或市场统计契约。当前记录为空，不以 SLGS 未偿额或随机月份替代。"
              : "库存与利率的关系需要同日 VRDN 库存和重设利率配对。当前没有这组独立观测，不生成交易气泡。"
          }
        />
      </section>
    </div>
  );
}
