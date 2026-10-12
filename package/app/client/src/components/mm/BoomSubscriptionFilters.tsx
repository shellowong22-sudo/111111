import { useMemo, useState } from "react";
import { Copy, ExternalLink, Filter } from "lucide-react";
import { MoneyMarketSection as Card } from "./MoneyMarketWorkbench";
import BoomSubscriptionPresetPanel, {
  type BoomSubscriptionFiltersValue,
} from "./BoomSubscriptionPresetPanel";

function copy(value: string) {
  navigator.clipboard?.writeText(value).catch(() => {
    const area = document.createElement("textarea");
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  });
}

export default function BoomSubscriptionFilters({
  terms,
  onTermsChange,
}: {
  terms: string[];
  onTermsChange: (terms: string[]) => void;
}) {
  const [cusip, setCusip] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const filters: BoomSubscriptionFiltersValue = {
    terms,
    cusip,
    minAmount,
    maxAmount,
  };
  const params = useMemo(() => {
    const value = new URLSearchParams();
    if (terms.length) value.set("terms", terms.join(","));
    if (/^[0-9A-Za-z]{1,16}$/.test(cusip.trim()))
      value.set("cusip", cusip.trim().toUpperCase());
    if (/^\d{1,15}$/.test(minAmount)) value.set("minAmount", minAmount);
    if (/^\d{1,15}$/.test(maxAmount)) value.set("maxAmount", maxAmount);
    return value;
  }, [terms, cusip, minAmount, maxAmount]);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const icsUrl = `${origin}/api/money-market-boom.ics${params.size ? `?${params.toString()}` : ""}`;
  const webcal = icsUrl.replace(/^https?:/, "webcal:");
  const applyPreset = (next: BoomSubscriptionFiltersValue) => {
    onTermsChange(next.terms);
    setCusip(next.cusip);
    setMinAmount(next.minAmount);
    setMaxAmount(next.maxAmount);
  };

  return (
    <Card
      title="BOOM 高级订阅筛选器"
      action={<Filter className="h-4 w-4 text-cyan-300" />}
    >
      <p className="mb-3 text-[11px] text-slate-500">
        订阅期限直接沿用上方发售事件轴当前选择（
        {terms.length ? terms.join("、") : "全部"}）；这里只补充 CUSIP
        与发行规模条件，避免复刻第二套期限按钮。全部字段均来自财政部已发布的拍卖记录。
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-[10px] text-slate-500">
          CUSIP（完整或前缀）
          <input
            value={cusip}
            onChange={event =>
              setCusip(
                event.target.value
                  .toUpperCase()
                  .replace(/[^0-9A-Z]/g, "")
                  .slice(0, 16)
              )
            }
            className="input-terminal mt-1 w-full text-xs"
            placeholder="例如 912797"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-500">
            最低发行规模（USD）
            <input
              value={minAmount}
              onChange={event =>
                setMinAmount(event.target.value.replace(/\D/g, "").slice(0, 15))
              }
              inputMode="numeric"
              className="input-terminal mt-1 w-full text-xs"
              placeholder="10000000000"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            最高发行规模（USD）
            <input
              value={maxAmount}
              onChange={event =>
                setMaxAmount(event.target.value.replace(/\D/g, "").slice(0, 15))
              }
              inputMode="numeric"
              className="input-terminal mt-1 w-full text-xs"
              placeholder="60000000000"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-2">
        <p className="text-[10px] text-slate-500">定制 ICS / WebCal</p>
        <p className="mt-1 break-all text-[11px] text-slate-300">{icsUrl}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <a href={icsUrl} className="text-[11px] text-cyan-300">
            下载 ICS
          </a>
          <a href={webcal} className="text-[11px] text-cyan-300">
            打开 WebCal
          </a>
          <button
            type="button"
            onClick={() => {
              copy(webcal);
              setCopied(true);
            }}
            className="text-[11px] text-cyan-300"
          >
            <Copy className="mr-1 inline h-3 w-3" />
            {copied ? "已复制" : "复制订阅地址"}
          </button>
          <a
            href="https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-cyan-300"
          >
            <ExternalLink className="mr-1 inline h-3 w-3" />
            原始字段
          </a>
        </div>
      </div>
      <BoomSubscriptionPresetPanel filters={filters} onApply={applyPreset} />
    </Card>
  );
}
