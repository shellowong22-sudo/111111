import React, { type ReactNode } from 'react';
import ModuleLiveDeliveryTable from '@/components/ModuleLiveDeliveryTable';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';

type Props = {
  path: string;
  title: string;
  children?: (delivery: ReturnType<typeof useModuleLiveFeed>) => ReactNode;
  filterItems?: (items: ReturnType<typeof useModuleLiveFeed>["items"]) => ReturnType<typeof useModuleLiveFeed>["items"];
};

/**
 * Renders one existing module's canonical OpenBB data slot. The server owns
 * operation-to-module sharding, so this component never merges sibling feeds.
 */
export default function OpenBBModuleDataBand({ path, title, children, filterItems }: Props) {
  const rawDelivery = useModuleLiveFeed(path, true);
  const delivery = filterItems ? { ...rawDelivery, items: filterItems(rawDelivery.items) } : rawDelivery;
  return <>
    <ModuleLiveDeliveryTable
      items={delivery.items}
      connection={delivery.connection}
      receivedAt={delivery.receivedAt}
      title={title}
    />
    {children?.(delivery)}
  </>;
}
