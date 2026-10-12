import { useMemo, type ReactNode } from 'react';
import { useModuleLiveFeed, type ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { decodePublicText, distinctPublicItems } from '@/lib/contentDedupe';

function visibleTerminalText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value
    .replace(/(?:后台|管理端|人工定向推送|爬虫|crawler|模块\s*ID|moduleId|映射|targetPath|strategyKey|promptKey)\s*[:：]?[^。；\n]*/gi, '')
    .replace(/[|·,:：；。]{2,}/g, ' · ')
    .replace(/^[|·,:：；。\s]+|[|·,:：；。\s]+$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || fallback;
}

function uniqueVisibleItems(items: ModuleLiveFeedItem[]) {
  return distinctPublicItems(items).flatMap((item) => {
    const title = visibleTerminalText(item.title, '抵押证券更新');
    const body = visibleTerminalText(decodePublicText(item.body));
    if (!body) return [];
    return [{ ...item, title, body }];
  }).slice(0, 8);
}

export default function MortgageModuleLiveDelivery({ open, children }: { open: string; children: ReactNode }) {
  const feed = useModuleLiveFeed(`/terminal?open=${open}&module=mortgage-bonds`, true);
  const items = useMemo(() => uniqueVisibleItems(feed.items), [feed.items]);

  return <div className="relative h-full min-h-0 overflow-hidden">
    <div className="h-full min-h-0">{children}</div>
  </div>;
}
