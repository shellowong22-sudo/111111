/** 新闻类功能统一进入新闻终端的对应功能页（同一功能只有一套实现） */
import { useEffect } from "react";
import { useLocation } from "wouter";
export default function NewsGoto({ tab }: { tab: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(`/news-hub?tab=${tab}`); }, [tab, setLocation]);
  return <div className="p-4 text-[12px] text-slate-500">正在打开新闻终端…</div>;
}
