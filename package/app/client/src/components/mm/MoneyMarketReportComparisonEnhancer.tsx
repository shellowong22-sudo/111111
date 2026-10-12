import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";
import { useAuth } from "@/_core/hooks/useAuth";
import GcTemplateCollaborationPanel from "./GcTemplateCollaborationPanel";
import GcTeamTemplateDirectory from "./GcTeamTemplateDirectory";
import MktbeatNotificationRulePanel from "./MktbeatNotificationRulePanel";

type Rate = {
  id: string;
  label: string;
  sourceUrl: string;
  history: Array<{ date: string; value: number }>;
  value: number | null;
  observationDate: string | null;
};
type Snapshot = { rates: Rate[] } | undefined;
type Auction = {
  cusip: string | null;
  securityTerm: string | null;
  auctionDate: string | null;
  offeringAmount: string | null;
};
type Range = { startDate: string; endDate: string };

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
function shiftedDay(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDay(date);
}
function parseAmount(value: string | null) {
  return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
}
function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null>>
) {
  const escape = (value: string | number | null) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const blob = new Blob(
    [[headers, ...rows].map(row => row.map(escape).join(",")).join("\n")],
    { type: "text/csv;charset=utf-8" }
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

type GcTemplate = {
  id: number;
  userId: number;
  name: string;
  headerText: string;
  researchIdPrefix: string;
  footerText: string;
  isDefault: boolean;
  permission: "owner" | "editor" | "reviewer" | "viewer";
  ownerName?: string | null;
};
const GC_BUILT_IN_TEMPLATES = [
  {
    id: "standard",
    name: "标准研究报告",
    headerText: "货币市场短端曲线研究报告",
    researchIdPrefix: "MM-GC",
    footerText: "仅使用公开历史观察；不构成交易、估值或政策预测建议。",
  },
  {
    id: "brief",
    name: "内部简报",
    headerText: "货币市场流动性内部简报",
    researchIdPrefix: "MM-BRIEF",
    footerText: "仅供内部研究沟通；请结合原始来源、生成时点和适用权限复核。",
  },
  {
    id: "archive",
    name: "合规存档",
    headerText: "货币市场公开数据合规存档",
    researchIdPrefix: "MM-ARCHIVE",
    footerText:
      "保留公开来源、生成时点与研究编号；不载入报价、预测或执行指令。",
  },
  {
    id: "committee",
    name: "研究审阅摘要",
    headerText: "货币市场研究审阅摘要",
    researchIdPrefix: "MM-REVIEW",
    footerText: "面向研究审阅；数据范围限于本页已列示的公开历史观察与来源。",
  },
] as const;

function researchIdFromPrefix(prefix: string) {
  return `${prefix}-${isoDay(new Date()).replaceAll("-", "")}`;
}
function calendarIso(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function currentCalendarIso() {
  const now = new Date();
  return calendarIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
function btmmQuickRanges() {
  const today = currentCalendarIso();
  const year = new Date().getFullYear();
  const clamp = (range: Range): Range => ({
    startDate: range.startDate,
    endDate: range.endDate > today ? today : range.endDate,
  });
  return {
    quarters: [1, 2, 3, 4].map(quarter =>
      clamp({
        startDate: calendarIso(year, (quarter - 1) * 3 + 1, 1),
        endDate: calendarIso(year, quarter * 3 + 1, 0),
      })
    ),
    years: [0, 1, 2].map(offset => {
      const target = year - offset;
      return clamp({
        startDate: calendarIso(target, 1, 1),
        endDate: calendarIso(target, 12, 31),
      });
    }),
    year,
  };
}

export function GcProfessionalPdfReport({ snapshot }: { snapshot: Snapshot }) {
  const { user } = useAuth();
  const [header, setHeader] = useState("货币市场短端曲线研究报告");
  const [researchId, setResearchId] = useState(
    () => `MM-GC-${isoDay(new Date()).replaceAll("-", "")}`
  );
  const [footer, setFooter] = useState(
    "仅使用公开历史观察；不构成交易、估值或政策预测建议。"
  );
  const [selected, setSelected] = useState<string[]>(["SOFR", "EFFR", "DTB3"]);
  const [templateName, setTemplateName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [templateChoice, setTemplateChoice] = useState("builtin:standard");
  const utils = trpc.useUtils();
  const templatesQuery = trpc.moneyMarketResearch.listGcTemplates.useQuery(
    undefined,
    { enabled: !!user, staleTime: 60_000 }
  );
  const saveTemplate = trpc.moneyMarketResearch.saveGcTemplate.useMutation({
    onSuccess: async () => {
      await utils.moneyMarketResearch.listGcTemplates.invalidate();
      setTemplateName("");
      toast.success("GC 报告模板已保存");
    },
    onError: () => toast.error("模板保存失败，请检查登录状态和字段格式"),
  });
  const deleteTemplate = trpc.moneyMarketResearch.deleteGcTemplate.useMutation({
    onSuccess: async () => {
      await utils.moneyMarketResearch.listGcTemplates.invalidate();
      toast.success("GC 报告模板已删除");
    },
    onError: () => toast.error("模板删除失败"),
  });
  const setDefaultTemplate =
    trpc.moneyMarketResearch.setDefaultGcTemplate.useMutation({
      onSuccess: async () => {
        await utils.moneyMarketResearch.listGcTemplates.invalidate();
        toast.success("已设为默认 GC 报告模板");
      },
      onError: () => toast.error("默认模板更新失败"),
    });
  const reportRef = useRef<HTMLDivElement>(null);
  const series = (snapshot?.rates ?? []).filter(rate =>
    selected.includes(rate.id)
  );
  const toggle = (id: string) =>
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  const applyTemplate = (
    template: Pick<GcTemplate, "headerText" | "researchIdPrefix" | "footerText">
  ) => {
    setHeader(template.headerText);
    setResearchId(researchIdFromPrefix(template.researchIdPrefix));
    setFooter(template.footerText);
  };
  const savedTemplates =
    (templatesQuery.data as GcTemplate[] | undefined) ?? [];
  const selectedSavedTemplate = savedTemplates.find(
    item => `saved:${item.id}` === templateChoice
  );
  const changeTemplate = (choice: string) => {
    setTemplateChoice(choice);
    if (choice.startsWith("builtin:")) {
      const template = GC_BUILT_IN_TEMPLATES.find(
        item => `builtin:${item.id}` === choice
      );
      if (template) applyTemplate(template);
    } else {
      const template = savedTemplates.find(
        item => `saved:${item.id}` === choice
      );
      if (template) {
        applyTemplate(template);
        setTemplateName(template.name);
      }
    }
  };
  const saveCurrentTemplate = () => {
    if (!user) {
      toast.error("登录后可保存个人报告模板");
      return;
    }
    const prefix =
      researchId.trim().split("-").slice(0, -1).join("-") || researchId.trim();
    if (
      !templateName.trim() ||
      !header.trim() ||
      !footer.trim() ||
      !/^[A-Za-z0-9_-]{2,32}$/.test(prefix)
    ) {
      toast.error(
        "请填写模板名称、页眉、页脚，并使用 2–32 位字母、数字、下划线或连字符的研究编号前缀"
      );
      return;
    }
    if (
      selectedSavedTemplate?.permission === "viewer" ||
      selectedSavedTemplate?.permission === "reviewer"
    ) {
      toast.error("当前模板为只读或审阅权限，不能修改元数据");
      return;
    }
    saveTemplate.mutate({
      templateId:
        selectedSavedTemplate?.permission === "owner" ||
        selectedSavedTemplate?.permission === "editor"
          ? selectedSavedTemplate.id
          : undefined,
      name: templateName.trim(),
      headerText: header.trim(),
      researchIdPrefix: prefix,
      footerText: footer.trim(),
      isDefault:
        selectedSavedTemplate?.permission === "owner"
          ? saveAsDefault
          : selectedSavedTemplate
            ? false
            : saveAsDefault,
    });
  };
  const exportPdf = async () => {
    if (!reportRef.current || !series.length || !researchId.trim()) {
      toast.error("请至少选择一条公开序列并填写研究编号");
      return;
    }
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#020617",
        scale: 2.5,
        useCORS: true,
        logging: false,
      });
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });
      pdf.setProperties({
        title: header.trim() || "货币市场短端曲线报告",
        subject: researchId,
        author: "Finance Hub",
      });
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        canvas.width,
        canvas.height,
        undefined,
        "FAST"
      );
      pdf.save(
        `${researchId.trim().replaceAll(/[^a-zA-Z0-9_-]/g, "-")}-curve-report.pdf`
      );
      toast.success("专业 PDF 报告已导出");
    } catch {
      toast.error("PDF 导出失败，请检查浏览器下载权限");
    }
  };
  return (
    <Card
      title="GC 专业 PDF 报告元数据"
      action={
        <button
          type="button"
          onClick={exportPdf}
          disabled={!series.length || !researchId.trim()}
          className="text-xs text-rose-300 disabled:text-slate-600"
        >
          <FileText className="mr-1 inline h-3 w-3" />
          导出专业 PDF
        </button>
      }
    >
      <div className="rounded border border-cyan-900/60 bg-cyan-950/10 p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-xs text-slate-500">
            专业模板
            <select
              value={templateChoice}
              onChange={event => changeTemplate(event.target.value)}
              className="input-terminal mt-1 w-full"
            >
              <optgroup label="内置专业模板">
                {GC_BUILT_IN_TEMPLATES.map(template => (
                  <option key={template.id} value={`builtin:${template.id}`}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
              {savedTemplates.length ? (
                <optgroup label="个人与团队模板">
                  {savedTemplates.map(template => (
                    <option key={template.id} value={`saved:${template.id}`}>
                      {template.isDefault ? "默认 · " : ""}
                      {template.name} · {template.permission}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <div className="pt-5 text-[10px] text-slate-500">
            选择模板会加载页眉、研究编号前缀与页脚；原始观察、来源和生成时点始终来自当前报告。
          </div>
          <span className="pt-5 text-right text-[10px] text-cyan-300">
            {templatesQuery.isLoading
              ? "正在读取模板…"
              : user
                ? `可用 ${savedTemplates.length} 个模板`
                : "登录后可保存和协作模板"}
          </span>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <label className="text-xs text-slate-500">
            保存当前设置为
            <input
              value={templateName}
              onChange={event => setTemplateName(event.target.value)}
              maxLength={96}
              placeholder="例如：周度流动性审阅"
              className="input-terminal mt-1 w-full"
            />
          </label>
          <label className="flex items-center gap-2 pt-5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={event => setSaveAsDefault(event.target.checked)}
              disabled={Boolean(
                selectedSavedTemplate &&
                selectedSavedTemplate.permission !== "owner"
              )}
            />
            设为默认
          </label>
          <button
            type="button"
            onClick={saveCurrentTemplate}
            disabled={
              saveTemplate.isPending ||
              selectedSavedTemplate?.permission === "viewer" ||
              selectedSavedTemplate?.permission === "reviewer"
            }
            className="mt-5 rounded border border-cyan-700 px-3 py-1.5 text-xs text-cyan-200 disabled:text-slate-600"
          >
            {saveTemplate.isPending ? "保存中…" : "保存模板"}
          </button>
          <span className="mt-5 text-[10px] text-slate-500">
            仅保存导出元数据
          </span>
        </div>
        {savedTemplates.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {savedTemplates.map(template => (
              <div
                key={template.id}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
              >
                <button
                  type="button"
                  onClick={() => changeTemplate(`saved:${template.id}`)}
                  className="text-cyan-200 hover:text-cyan-100"
                >
                  {template.isDefault ? "默认 · " : ""}
                  {template.name} · {template.permission}
                </button>
                {template.permission === "owner" && !template.isDefault && (
                  <button
                    type="button"
                    onClick={() =>
                      setDefaultTemplate.mutate({ templateId: template.id })
                    }
                    className="text-amber-300 hover:text-amber-100"
                  >
                    设默认
                  </button>
                )}
                {template.permission === "owner" && (
                  <button
                    type="button"
                    onClick={() =>
                      deleteTemplate.mutate({ templateId: template.id })
                    }
                    className="text-rose-300 hover:text-rose-100"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <GcTemplateCollaborationPanel template={selectedSavedTemplate} />
        <GcTeamTemplateDirectory
          onSelect={templateId => changeTemplate(`saved:${templateId}`)}
        />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label className="text-xs text-slate-500">
          页眉标题
          <input
            value={header}
            onChange={event => setHeader(event.target.value)}
            maxLength={80}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          研究编号
          <input
            value={researchId}
            onChange={event => setResearchId(event.target.value)}
            maxLength={48}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          页脚说明
          <input
            value={footer}
            onChange={event => setFooter(event.target.value)}
            maxLength={160}
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(snapshot?.rates ?? []).map(rate => (
          <label key={rate.id} className="text-xs text-slate-400">
            <input
              type="checkbox"
              checked={selected.includes(rate.id)}
              onChange={() => toggle(rate.id)}
            />{" "}
            {rate.id}
          </label>
        ))}
      </div>
      <div
        ref={reportRef}
        className="mt-3 rounded border border-slate-700 bg-slate-950 p-4"
      >
        <div className="border-b border-slate-700 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                {header.trim() || "货币市场短端曲线研究报告"}
              </h3>
              <p className="mt-1 text-[11px] text-cyan-300">
                研究编号：{researchId.trim() || "未设置"}
              </p>
            </div>
            <p className="text-right text-[10px] text-slate-500">
              生成时间
              <br />
              {new Date().toLocaleString()}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {series.map(rate => (
            <Metric
              key={rate.id}
              label={`${rate.id} 最近观察`}
              value={rate.value == null ? "—" : `${rate.value.toFixed(4)}%`}
              tone="info"
            />
          ))}
        </div>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="p-2">公开序列</th>
                <th className="p-2">最近观察日</th>
                <th className="p-2">最近值</th>
                <th className="p-2">来源</th>
              </tr>
            </thead>
            <tbody>
              {series.map(rate => (
                <tr key={rate.id} className="border-t border-slate-800">
                  <td className="p-2 text-slate-200">{rate.id}</td>
                  <td className="p-2">{rate.observationDate || "—"}</td>
                  <td className="p-2">
                    {rate.value == null ? "—" : `${rate.value.toFixed(4)}%`}
                  </td>
                  <td className="p-2 text-cyan-300">{rate.sourceUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
          {footer.trim() ||
            "仅使用公开历史观察；不构成交易、估值或政策预测建议。"}
        </p>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        PDF 以 2.5
        倍分辨率捕获当前报告内容；可自定义元数据但不会改写原始观察、来源或生成时点。
      </p>
    </Card>
  );
}

function rangeStats(events: Auction[]) {
  const totalAmount = events.reduce(
    (sum, event) => sum + parseAmount(event.offeringAmount),
    0
  );
  const terms = new Map<string, number>();
  events.forEach(event =>
    terms.set(
      event.securityTerm || "未披露",
      (terms.get(event.securityTerm || "未披露") ?? 0) + 1
    )
  );
  return { count: events.length, totalAmount, terms };
}
function pairedPreviousYearRange(range: Range): Range {
  const move = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    const targetYear = year - 1;
    const maxDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
    return calendarIso(targetYear, month, Math.min(day, maxDay));
  };
  return { startDate: move(range.startDate), endDate: move(range.endDate) };
}

export function BtmmDualRangeComparison() {
  const [draftA, setDraftA] = useState<Range>(() => ({
    startDate: shiftedDay(-180),
    endDate: shiftedDay(0),
  }));
  const [draftB, setDraftB] = useState<Range>(() => ({
    startDate: shiftedDay(-365),
    endDate: shiftedDay(-181),
  }));
  const [rangeA, setRangeA] = useState(draftA);
  const [rangeB, setRangeB] = useState(draftB);
  const queryA = trpc.moneyMarketResearch.getAuctionRange.useQuery(rangeA, {
    staleTime: 60_000,
  });
  const queryB = trpc.moneyMarketResearch.getAuctionRange.useQuery(rangeB, {
    staleTime: 60_000,
  });
  const eventsA = (queryA.data?.events ?? []) as Auction[];
  const eventsB = (queryB.data?.events ?? []) as Auction[];
  const a = rangeStats(eventsA);
  const b = rangeStats(eventsB);
  const termRows = [...new Set([...a.terms.keys(), ...b.terms.keys()])]
    .sort()
    .map(term => ({
      term,
      区间A: a.terms.get(term) ?? 0,
      区间B: b.terms.get(term) ?? 0,
      差异: (a.terms.get(term) ?? 0) - (b.terms.get(term) ?? 0),
    }));
  const offeringAmountDelta = a.totalAmount - b.totalAmount;
  const offeringAmountDeltaPct = b.totalAmount
    ? (offeringAmountDelta / b.totalAmount) * 100
    : null;
  const valid =
    draftA.startDate <= draftA.endDate && draftB.startDate <= draftB.endDate;
  const shortcuts = btmmQuickRanges();
  const applyRange = (side: "A" | "B", range: Range) => {
    if (side === "A") {
      setDraftA(range);
      setRangeA(range);
    } else {
      setDraftB(range);
      setRangeB(range);
    }
  };
  const shortcutButtons = (side: "A" | "B", tone: "cyan" | "violet") => (
    (() => {
      // 区间 B 是区间 A 的上一年度配对；快捷按钮必须使用配对年度，
      // 避免两个区间显示同一年度并把 A 的日期误写入 B。
      const sideShortcuts = side === "B"
        ? {
            year: shortcuts.year - 1,
            quarters: shortcuts.quarters.map(pairedPreviousYearRange),
            years: shortcuts.years.map(pairedPreviousYearRange),
          }
        : shortcuts;
      return (
    <div className="mt-3 border-t border-slate-800 pt-2">
      <p className="text-[10px] text-slate-500">
        区间 {side} · 季度快捷范围（{sideShortcuts.year}）
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {sideShortcuts.quarters.map((range, index) => {
          const unavailable = range.startDate > range.endDate;
          return (
            <button
              key={`q${index + 1}`}
              type="button"
              disabled={unavailable}
              title={
                unavailable
                  ? "该季度尚未开始"
                  : `${range.startDate} 至 ${range.endDate}`
              }
              onClick={() => applyRange(side, range)}
              className={`rounded border px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600 ${tone === "cyan" ? "border-cyan-900 text-cyan-200 hover:bg-cyan-950/40" : "border-violet-900 text-violet-200 hover:bg-violet-950/40"}`}
            >
              Q{index + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">年度快捷范围</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {sideShortcuts.years.map((range, index) => (
          <button
            key={`y${index}`}
            type="button"
            title={`${range.startDate} 至 ${range.endDate}`}
            onClick={() => applyRange(side, range)}
            className={`rounded border px-2 py-1 text-[10px] ${tone === "cyan" ? "border-cyan-900 text-cyan-200 hover:bg-cyan-950/40" : "border-violet-900 text-violet-200 hover:bg-violet-950/40"}`}
          >
            {sideShortcuts.year - index} 年
          </button>
        ))}
      </div>
    </div>
      );
    })()
  );
  return (
    <Card
      title="BTMM 两个官方拍卖区间并排比较"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "btmm-dual-range-comparison.csv",
              [
                "期限",
                "区间A事件数",
                "区间B事件数",
                "事件数差异(A-B)",
                "区间A起始",
                "区间A结束",
                "区间B起始",
                "区间B结束",
              ],
              termRows.map(row => [
                row.term,
                row.区间A,
                row.区间B,
                row.差异,
                rangeA.startDate,
                rangeA.endDate,
                rangeB.startDate,
                rangeB.endDate,
              ])
            )
          }
          disabled={!termRows.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded border border-cyan-900/60 p-3">
          <b className="text-xs text-cyan-200">区间 A</b>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              起始
              <input
                type="date"
                value={draftA.startDate}
                max={draftA.endDate}
                onChange={event =>
                  setDraftA(value => ({
                    ...value,
                    startDate: event.target.value,
                  }))
                }
                className="input-terminal mt-1 w-full"
              />
            </label>
            <label className="text-xs text-slate-500">
              结束
              <input
                type="date"
                value={draftA.endDate}
                min={draftA.startDate}
                max={currentCalendarIso()}
                onChange={event =>
                  setDraftA(value => ({
                    ...value,
                    endDate: event.target.value,
                  }))
                }
                className="input-terminal mt-1 w-full"
              />
            </label>
          </div>
          {shortcutButtons("A", "cyan")}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="官方事件" value={String(a.count)} />
            <Metric
              label="原始发行额"
              value={
                a.totalAmount
                  ? a.totalAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })
                  : "—"
              }
              tone="info"
            />
          </div>
        </div>
        <div className="rounded border border-violet-900/60 p-3">
          <b className="text-xs text-violet-200">区间 B</b>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              起始
              <input
                type="date"
                value={draftB.startDate}
                max={draftB.endDate}
                onChange={event =>
                  setDraftB(value => ({
                    ...value,
                    startDate: event.target.value,
                  }))
                }
                className="input-terminal mt-1 w-full"
              />
            </label>
            <label className="text-xs text-slate-500">
              结束
              <input
                type="date"
                value={draftB.endDate}
                min={draftB.startDate}
                max={currentCalendarIso()}
                onChange={event =>
                  setDraftB(value => ({
                    ...value,
                    endDate: event.target.value,
                  }))
                }
                className="input-terminal mt-1 w-full"
              />
            </label>
          </div>
          {shortcutButtons("B", "violet")}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="官方事件" value={String(b.count)} />
            <Metric
              label="原始发行额"
              value={
                b.totalAmount
                  ? b.totalAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })
                  : "—"
              }
              tone="info"
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500">
          快捷范围会立即更新对应区间；仅比较财政部已发布 Bill 记录，每段最长 730
          天，不推断未来发行计划。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyRange("B", pairedPreviousYearRange(draftA))}
            disabled={!valid}
            className="rounded border border-violet-800 px-3 py-1 text-xs text-violet-200 disabled:text-slate-600"
          >
            区间 A → 上年同比配对
          </button>
          <button
            type="button"
            onClick={() => {
              if (valid) {
                setRangeA(draftA);
                setRangeB(draftB);
              }
            }}
            disabled={!valid}
            className="rounded border border-amber-700 px-3 py-1 text-xs text-amber-200 disabled:text-slate-600"
          >
            更新并排比较
          </button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        同比自动配对会将区间 A 的同月同日范围填入区间 B 的上一年度；2 月 29
        日会安全对齐至上一年 2 月末。
      </p>
      {!queryA.isLoading && !queryB.isLoading && termRows.length ? (
        <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-xs text-slate-200">同比差异摘要</b>
            <span className="text-[10px] text-slate-500">
              A − B · 原始财政部拍卖字段 · 期限结构按事件数比较
            </span>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <Metric
              label="发行额差异"
              value={`${offeringAmountDelta >= 0 ? "+" : ""}${offeringAmountDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              tone={offeringAmountDelta >= 0 ? "info" : "warn"}
            />
            <Metric
              label="发行额同比变化"
              value={
                offeringAmountDeltaPct == null
                  ? "—"
                  : `${offeringAmountDeltaPct >= 0 ? "+" : ""}${offeringAmountDeltaPct.toFixed(1)}%`
              }
              tone={
                offeringAmountDeltaPct != null && offeringAmountDeltaPct < 0
                  ? "warn"
                  : "info"
              }
            />
            <Metric
              label="事件数差异"
              value={`${a.count - b.count >= 0 ? "+" : ""}${a.count - b.count}`}
              tone="info"
            />
          </div>
          <div className="mt-3 grid gap-1 md:grid-cols-2">
            {termRows.map(row => (
              <div
                key={row.term}
                className="flex items-center justify-between rounded border border-slate-800 px-2 py-1 text-[10px]"
              >
                <span className="text-slate-400">{row.term}</span>
                <span
                  className={
                    row.差异 > 0
                      ? "text-cyan-200"
                      : row.差异 < 0
                        ? "text-amber-200"
                        : "text-slate-500"
                  }
                >
                  {row.差异 === 0
                    ? "持平"
                    : `${row.差异 > 0 ? "+" : ""}${row.差异} 场`}{" "}
                  · A {row.区间A} / B {row.区间B}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3 h-64">
        {queryA.isLoading || queryB.isLoading ? (
          <div className="rounded border border-dashed border-slate-700 p-4 text-xs text-slate-500">
            正在读取两段财政部官方拍卖记录…
          </div>
        ) : termRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={termRows}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="term" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Bar dataKey="区间A" fill="#22d3ee" />
              <Bar dataKey="区间B" fill="#a78bfa" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="rounded border border-dashed border-slate-700 p-4 text-xs text-slate-500">
            任一区间无可用官方 Bill 记录时不补充模拟事件。
          </div>
        )}
      </div>
    </Card>
  );
}

export function MktbeatThresholdAlert({ snapshot }: { snapshot: Snapshot }) {
  const { user } = useAuth();
  const [threshold, setThreshold] = useState("10");
  const [days, setDays] = useState(60);
  const [selected, setSelected] = useState<string[]>(["SOFR", "EFFR", "IORB"]);
  const utils = trpc.useUtils();
  const triggerNotification =
    trpc.moneyMarketResearch.triggerMktbeatThresholdNotification.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.notification.unreadCount.invalidate(),
          utils.notification.list.invalidate(),
        ]);
      },
    });
  const candidates = (snapshot?.rates ?? []).filter(rate =>
    ["SOFR", "EFFR", "IORB", "DTB4WK", "DTB3", "DTB6"].includes(rate.id)
  );
  const thresholdBps = Math.max(0, Number(threshold) || 0);
  const rows = useMemo(
    () =>
      candidates
        .filter(rate => selected.includes(rate.id))
        .map(rate => {
          const values = rate.history.slice(-days).map(point => point.value);
          const start = values[0] ?? null;
          const last = values.at(-1) ?? null;
          const changeBps =
            start != null && last != null ? (last - start) * 100 : null;
          const mean = values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : null;
          return {
            id: rate.id,
            label: rate.label,
            observationDate: rate.observationDate,
            last,
            mean,
            changeBps,
            triggered:
              changeBps != null &&
              Boolean(rate.observationDate) &&
              Math.abs(changeBps) >= thresholdBps,
            observations: values.length,
          };
        }),
    [candidates, days, selected, thresholdBps]
  );
  const triggered = rows.filter(row => row.triggered);
  const triggerKey = triggered
    .map(row => `${row.id}:${row.observationDate}:${row.changeBps?.toFixed(1)}`)
    .sort()
    .join("|");
  useEffect(() => {
    if (!user || !triggered.length || triggerNotification.isPending) return;
    triggerNotification.mutate({
      alerts: triggered.flatMap(row =>
        row.observationDate && row.changeBps != null
          ? [
              {
                seriesId: row.id as
                  | "SOFR"
                  | "EFFR"
                  | "IORB"
                  | "DTB4WK"
                  | "DTB3"
                  | "DTB6",
                label: row.label,
                windowDays: days as 20 | 60 | 120,
                thresholdBps,
                observationDate: row.observationDate,
                changeBps: row.changeBps,
              },
            ]
          : []
      ),
    });
    // 服务端按账户、序列、窗口、阈值和观察日幂等去重；此处只在触发集合变化时请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, triggerKey, days, thresholdBps]);
  const toggle = (id: string) =>
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  return (
    <Card
      title="MKTBEAT 变化阈值提醒"
      action={
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "mktbeat-threshold-alert.csv",
              ["基准", "窗口天数", "窗口变化(bp)", "阈值(bp)", "触发"],
              rows.map(row => [
                row.id,
                days,
                row.changeBps,
                thresholdBps,
                row.triggered ? "是" : "否",
              ])
            )
          }
          disabled={!rows.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-[auto_auto_1fr]">
        <label className="text-xs text-slate-500">
          变化窗口
          <select
            value={days}
            onChange={event => setDays(Number(event.target.value))}
            className="input-terminal mt-1 w-full"
          >
            <option value={20}>20 日</option>
            <option value={60}>60 日</option>
            <option value={120}>120 日</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">
          触发幅度 (bp)
          <input
            type="number"
            min="0"
            step="0.1"
            value={threshold}
            onChange={event => setThreshold(event.target.value)}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <div className="pt-5 text-xs">
          {triggered.length ? (
            <span className="rounded border border-amber-600 bg-amber-950/30 px-2 py-1 text-amber-200">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              {triggered.length} 个基准达到设定幅度
            </span>
          ) : (
            <span className="rounded border border-emerald-800 bg-emerald-950/20 px-2 py-1 text-emerald-200">
              当前观察均在设定幅度内
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map(rate => (
          <label key={rate.id} className="text-xs text-slate-400">
            <input
              type="checkbox"
              checked={selected.includes(rate.id)}
              onChange={() => toggle(rate.id)}
            />{" "}
            {rate.id}
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {rows.map(row => (
          <div
            key={row.id}
            className={`rounded border p-3 ${row.triggered ? "border-amber-600 bg-amber-950/20" : "border-slate-800 bg-slate-950"}`}
          >
            <div className="flex items-center justify-between">
              <b className="text-xs text-slate-200">{row.id}</b>
              {row.triggered && (
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              )}
            </div>
            <p className="mt-2 text-lg text-slate-100">
              {row.changeBps == null ? "—" : `${row.changeBps.toFixed(1)} bp`}
            </p>
            <p className="text-[10px] text-slate-500">
              {days} 日变化 · {row.observations} 个有效观察
            </p>
          </div>
        ))}
      </div>
      <MktbeatNotificationRulePanel
        series={candidates.map(rate => ({
          id: rate.id as "SOFR" | "EFFR" | "IORB" | "DTB4WK" | "DTB3" | "DTB6",
          label: rate.label,
        }))}
      />
      <p className="mt-3 text-[10px] text-slate-500">
        达到设定幅度后以幂等方式写入消息中心；静默时段可汇总或延后投递。这里仅判断公开历史变化是否越过用户规则，不生成政策结论、风险评级或交易指令。
      </p>
    </Card>
  );
}
