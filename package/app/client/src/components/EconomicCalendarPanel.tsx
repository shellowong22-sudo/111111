/** 经济日历：与新闻终端同一实时经济日历（原写死事件已移除） */
import EconCalendar from "@/uc/news/EconCalendar";
export default function EconomicCalendarPanel(_p: { title?: string; onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-auto bg-[#03070c]"><EconCalendar /></div>;
}
