import { BookOpenCheck, ShieldAlert } from "lucide-react";
import Mbs21FhfaCsvImport, { downloadFhfaTemplate } from "./Mbs21FhfaCsvImport";

const labels: Record<string, string> = {
  "1": "字段血缘与账户账簿",
  "3": "贷款池特征与账户账簿",
  "5": "新发行与账户账簿",
  "7": "数据授权与账户账簿",
  "11": "地域担保品与账户账簿",
  "13": "研究证据与账户账簿",
  "15": "结构融资管道与账户账簿",
  "20": "市场报价与账户观察",
  "21": "CMBS 地图与账户账簿",
  "22": "抵押债指数与账户账簿",
  "23": "实时监测与账户账簿",
  "26": "成交量与表现账簿",
};

export default function MortgageAccountLedgerPanel({ moduleId }: { moduleId: "1" | "3" | "5" | "7" | "11" | "13" | "15" | "20" | "21" | "22" | "23" | "26" }) {
  void downloadFhfaTemplate;
  return (
    <section className="m-4 rounded border border-cyan-950 bg-slate-950/70 p-4 text-slate-100" data-mortgage-account-ledger-panel>
      <div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-cyan-300" /><div><p className="text-xs font-semibold text-cyan-200">账户私有抵押债账簿</p><h2 className="mt-1 text-sm font-semibold">{labels[moduleId] ?? "抵押债账户观察"}</h2></div></div>
      <div className="mt-3 rounded border border-amber-900/80 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100"><ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-amber-300" />当前未接入该账户的持仓、估值、成交或服务商数据。为保护账户数据边界，本工作区不显示示例持仓、推断价格、随机盈亏或伪交易记录。</div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2"><div className="rounded border border-slate-800 bg-slate-900/40 p-3"><p className="text-xs font-semibold text-slate-200">四级权限矩阵</p><ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-400"><li><b className="text-slate-200">所有者：</b>可配置授权与审阅边界。</li><li><b className="text-slate-200">编辑成员：</b>仅在获得账户授权后可提交变更。</li><li><b className="text-slate-200">审阅成员：</b>只处理已提交的审阅项。</li><li><b className="text-slate-200">只读成员：</b>仅查看；不能修改、审批、导出或共享</li></ul></div><div className="rounded border border-slate-800 bg-slate-900/40 p-3"><p className="text-xs font-semibold text-slate-200">工作流与数据边界</p><p className="mt-2 text-xs leading-5 text-slate-400">接入后将提供高级筛选、多列排序与个人视图；导出当前筛选视图并写入操作日志。共享、撤销、保存、迁移、提交、审批、退回、时限设置和导出均追加记录。</p><p className="mt-2 text-xs leading-5 text-slate-500">当前没有创建本机副本，因此不应将“本机副本不会被删除”理解为已实现的存储承诺；亦未启用 FHFA 地理暴露 CSV 批量导入，待已授权账户文件接入后才开放。</p></div></div>
      {moduleId === '21' && <Mbs21FhfaCsvImport />}
      <div className="mt-3 rounded border border-slate-800 bg-slate-900/40 p-3 text-xs"><p className="font-semibold text-slate-200">高级筛选、多列排序与个人视图</p><p className="mt-1 leading-5 text-slate-400">点击列头添加排序；最多四列。导出当前筛选视图并写入操作日志。</p><p className="mt-2 font-semibold text-slate-200">审阅时限与实时提醒</p><p className="mt-1 leading-5 text-slate-400">提交审阅会即时推送给审阅成员；临期和逾期台账由受平台管理的周期检查生成幂等通知。</p></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">待接入已授权的账户记录并完成字段映射、来源标签、权限校验和审计验证后，此页才会显示可验证的账簿分析。</p>
    </section>
  );
}
