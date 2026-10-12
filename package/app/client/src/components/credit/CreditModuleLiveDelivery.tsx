import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { decodePublicText, distinctPublicItems } from '@/lib/contentDedupe';

type CreditLiveDeliveryState = {
  items: ModuleLiveFeedItem[];
  connection: 'connecting' | 'live' | 'fallback';
  receivedAt: string | null;
  refetch: () => void;
};

const CreditLiveDeliveryContext = createContext<CreditLiveDeliveryState>({ items: [], connection: 'connecting', receivedAt: null, refetch: () => undefined });
export function useCreditModuleLiveDelivery() { return useContext(CreditLiveDeliveryContext); }

function terminalText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value
    .replace(/(?:后台|管理端|人工定向推送|爬虫|crawler|模块\s*ID|moduleId|映射|targetPath|strategyKey|promptKey)\s*[:：]?[^。；\n]*/gi, '')
    .replace(/[|·,:：；。]{2,}/g, ' · ')
    .replace(/^[|·,:：；。\s]+|[|·,:：；。\s]+$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || fallback;
}

export default function CreditModuleLiveDelivery({ open, children }: { open: string; children: ReactNode }) {
  const path = `/terminal?open=${open}&module=credit-bonds`;
  const feed = useModuleLiveFeed(path, true);
  const items = useMemo(() => {
    return distinctPublicItems(feed.items).flatMap((item) => {
      const title = terminalText(item.title, '信用市场更新');
      const body = terminalText(decodePublicText(item.body));
      if (!body) return [];
      return [{ ...item, title, body }];
    }).slice(0, 8);
  }, [feed.items]);

  return <CreditLiveDeliveryContext.Provider value={{ items, connection: feed.connection, receivedAt: feed.receivedAt, refetch: () => { void feed.refetch(); } }}><div className="relative h-full min-h-0 overflow-hidden">
    <div className="h-full min-h-0">{children}</div>
  </div></CreditLiveDeliveryContext.Provider>;
}
