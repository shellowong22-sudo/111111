import type { QueryClient } from '@tanstack/react-query';

// 让非组件代码（例如面板工具栏按钮的事件处理）也能触发与 React Query
// 同一个客户端的刷新。main.tsx 在创建 QueryClient 后登记一次。
let registered: QueryClient | null = null;

export function registerQueryClient(client: QueryClient) {
  registered = client;
}

export async function refreshAllQueries(): Promise<boolean> {
  if (!registered) return false;
  await registered.invalidateQueries();
  return true;
}
