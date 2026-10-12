import {useCallback,useState,type ReactNode} from 'react';
import {EconomicDeliveryContext} from './EconomicDeliveryContext';
import {worldBankDeliveryOwner} from '@shared/worldBankDelivery';
import {wfiiFxDeliveryOwner} from '@shared/wfiiFxDelivery';
  import {wfiiStressDeliveryOwner} from '@shared/wfiiStressDelivery';
import {ecsuDeliveryOwner} from '@shared/ecsuDelivery';
import {ECONOMIC_API_CONTRACTS} from '@shared/economicApiContracts';
import {WORLD_BANK_CONTRACTS} from '@shared/worldBankContracts';
import EconomicDataHub from '@/pages/EconomicDataHub';
import ModuleLiveDeliveryTable from '@/components/ModuleLiveDeliveryTable';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { useSearch } from 'wouter';

export function EconomicFieldSourceBoundary({ children, path = '/terminal?module=economics' }: { children: ReactNode; path?: string }) {
  const [appliedKeys,setAppliedKeys]=useState<string[]>([]);
  const applied=useCallback((keys:string[])=>setAppliedKeys(old=>keys.every(k=>old.includes(k))?old:[...new Set([...old,...keys])]),[]);
  const tab=new URL(path,'http://localhost').searchParams.get('tab');
  const integrated=path.startsWith('/econ-hub')&&(tab==='ectr'||tab==='wfii');
  // WFII owns its observation panels. Older deliveries can be missing the
  // strict owner metadata (for example after a provider refresh), but they
  // still carry a contract-owned series/indicator. Keep those records in the
  // WFII context so the generic delivery table does not render the same
  // observation a second time beneath the native panel.
  const isWfiiContractDataset = (item: Parameters<typeof worldBankDeliveryOwner>[0]) => {
    if (tab !== 'wfii' || !item.dataset?.rows?.length) return false;
    const rows = item.dataset.rows;
    const seriesIds = new Set<string>(ECONOMIC_API_CONTRACTS.filter(c => c.primaryModuleId === 'economic-wfii').map(c => c.seriesId));
    const indicators = new Set<string>(WORLD_BANK_CONTRACTS.filter(c => c.primaryModuleId === 'economic-wfii').map(c => c.indicator));
    const keys = rows.map(row => String(row.series ?? row.indicator ?? ''));
    return keys.length > 0 && keys.every(key => seriesIds.has(key) || indicators.has(key));
  };
  const isIntegrated=(item:Parameters<typeof worldBankDeliveryOwner>[0]) =>
    (integrated && (
      worldBankDeliveryOwner(item)===`economic-${tab}` ||
      (tab==='wfii' && (wfiiFxDeliveryOwner(item)==='economic-wfii' || wfiiStressDeliveryOwner(item)==='economic-wfii'))
    )) || (isWfiiContractDataset(item)) ||
    (path.startsWith('/econ-hub') && tab==='ecsu' && ecsuDeliveryOwner(item)==='economic-ecsu') ||
    (path.startsWith('/econ-hub') && tab==='ecst' && ['中国宏观 GDP 观察', '中国宏观 CPI 观察'].includes((item.dataset as { label?: string } | undefined)?.label ?? ''));
  const openBBDelivery = useModuleLiveFeed(path, true,{acknowledgeFilter:item=>!isIntegrated(item)||appliedKeys.includes(item.itemKey)});
  const remaining=openBBDelivery.items.filter(item=>!isIntegrated(item));
  return <EconomicDeliveryContext.Provider value={{items:openBBDelivery.items.filter(isIntegrated),applied}}><div data-preserved-economic-hub="true">{children}</div>{remaining.length > 0 && <ModuleLiveDeliveryTable {...openBBDelivery} items={remaining} title="当前经济功能数据" />}</EconomicDeliveryContext.Provider>;
}

export default function EconomicDataHubPreservedRoute() {
  const search = useSearch();
  const tab = new URLSearchParams(search).get('tab') ?? 'eco';
  const feedPath = `/econ-hub?tab=${encodeURIComponent(tab)}`;
  return <EconomicFieldSourceBoundary key={feedPath} path={feedPath}><EconomicDataHub /></EconomicFieldSourceBoundary>;
}
