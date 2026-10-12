import OrderManagement from '@/pages/OrderManagement';
import { useSearch } from 'wouter';

export default function OrderManagementPreservedRoute() {
  const search = useSearch();
  const moduleId = new URLSearchParams(search).get('panel') ?? 'AIM';
  return <div data-preserved-order-management-workspace="true"><OrderManagement /></div>;
}
