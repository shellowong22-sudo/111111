import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { decodePublicText, distinctPublicItems } from '@/lib/contentDedupe';
import { deliveryDatasetIdentity } from '@shared/deliveryDatasetIdentity';
import { acquireContentStreamLease } from '@/lib/contentStreamLease';

export type ModuleLiveFeedItem = {
  itemKey: string;
  title: string;
  body: string;
  topic: string;
  category: string;
  sourceKind: 'public' | 'observation';
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  dataset?: {
    label: string;
    columns: string[];
    rows: Array<Record<string, string | number | boolean | null>>;
    metadata: {
      provider: string;
      queriedAt: string | null;
      observedAt: string | null;
      timezone: string;
      rowCount: number;
      displayedRowCount: number;
      truncated: boolean;
      quality: string;
      realtimeStatus: string;
      schemaVersion: string;
      checksum: string;
      observationIdentity?: string;
    };
  };
};

type StreamPayload = { items?: ModuleLiveFeedItem[]; refreshes?: Array<{ moduleId?: string; status?: string; refreshedAt?: string }>; receivedAt?: string };

export function moduleLiveFeedRetryDelay(attempt: number) {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return Math.min(30_000, 1_000 * 2 ** Math.min(safeAttempt, 5));
}

export function shouldInvalidateResearchQueries(path: string, refreshes: Array<{ status?: string; refreshedAt?: string }>) {
  if (!/module=(?:stock|preferred|equity)/i.test(path)) return false;
  const now = Date.now();
  return refreshes.some((item) => {
    if (!['available', 'partial'].includes(item.status ?? '')) return false;
    const at = item.refreshedAt ? Date.parse(item.refreshedAt) : NaN;
    return Number.isFinite(at) && at <= now;
  });
}

function feedFingerprint(item: ModuleLiveFeedItem) {
  // 正文是推送实体的唯一业务内容；标题可能因目标子功能而不同，
  // 但同一正文不能在同一模块内重复出现。
  return (item.body || item.title)
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function distinctFeedItems(items: ModuleLiveFeedItem[]) {
  const decoded = items.map((item) => ({ ...item, title: decodePublicText(item.title), body: decodePublicText(item.body) }));
  const textKeys = new Set(distinctPublicItems(decoded.filter(item => !item.dataset)).map(item => item.itemKey));
  const datasets = new Set<string>();
  return decoded.filter(item => {
    const identity = deliveryDatasetIdentity(item.dataset);
    if (!identity) return textKeys.has(item.itemKey);
    if (datasets.has(identity)) return false;
    datasets.add(identity);
    return true;
  });
}

function getDeliveryClientKey() {
  const storageKey = 'terminal-delivery-client-key';
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}

export function useModuleLiveFeed(path: string, enabled = true, options?: { acknowledge?: boolean; publicOnly?: boolean; acknowledgeFilter?:(item:ModuleLiveFeedItem)=>boolean }) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const fallback = trpc.adminDataModules.getFeedsForPath.useQuery(
    { path },
    { enabled: enabled && visible, retry: false, staleTime: 0, refetchInterval: enabled && visible ? 15_000 : false, refetchOnWindowFocus: true },
  );
  const archived = trpc.freeMarketData.archivedPublicDatasetsForPath.useQuery(
    { path, limit: 2500 },
    { enabled: enabled && visible, retry: 2, staleTime: 30_000, refetchInterval: enabled && visible ? 60_000 : false, refetchOnWindowFocus: true },
  );
  const utils = trpc.useUtils();
  const [streamItems, setStreamItems] = useState<ModuleLiveFeedItem[] | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'fallback'>('connecting');
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const acknowledgedKeys = useRef(new Set<string>());
  const acknowledgementTimer = useRef<number | null>(null);
  const acknowledge = trpc.adminDataModules.acknowledgeFeeds.useMutation();
  const acknowledgeRef = useRef(acknowledge.mutate);
  acknowledgeRef.current = acknowledge.mutate;

  useEffect(() => {
    setStreamItems(null);
    setConnection('connecting');
    if (!enabled || !visible) { setConnection('fallback'); return; }
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      setConnection('fallback');
      return;
    }
    let stopped = false;
    let stream: EventSource | null = null;
    let retryTimer: number | null = null;
    let retryAttempt = 0;
    let healthy = false;
    let releaseLease: (() => void) | null = null;
    let acquiring = false;
    const lifetime = new AbortController();

    const closeStream = () => {
      stream?.close();
      stream = null;
      releaseLease?.();
      releaseLease = null;
    };

    const connect = async () => {
      if (stopped || acquiring) return;
      closeStream();
      healthy = false;
      acquiring = true;
      const lease = await acquireContentStreamLease(lifetime.signal);
      acquiring = false;
      if (stopped) { lease?.(); return; }
      if (!lease) {
        setConnection('fallback');
        if (retryTimer === null) retryTimer = window.setTimeout(() => { retryTimer = null; void connect(); }, 15_000);
        return;
      }
      releaseLease = lease;
      const nextStream = new EventSource(`/api/terminal/content-stream?path=${encodeURIComponent(path)}`);
      stream = nextStream;

      const scheduleReconnect = () => {
        if (stopped || stream !== nextStream) return;
        healthy = false;
        setConnection('fallback');
        closeStream();
        if (retryTimer !== null) return;
        const delay = moduleLiveFeedRetryDelay(retryAttempt);
        retryAttempt += 1;
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (healthy || stopped) return;
          // Reacquire cross-tab capacity before opening a replacement socket.
          void connect();
        }, delay);
      };

      nextStream.onmessage = (event) => {
        if (stopped || stream !== nextStream) return;
        try {
          const payload = JSON.parse(event.data) as StreamPayload;
          if (Array.isArray(payload.items)) setStreamItems(payload.items);
          // Source refresh events are invalidation hints only. Typed research
          // queries refetch from their own verified source; no pushed payload is
          // applied as a quote or chart value.
          if (Array.isArray(payload.refreshes) && shouldInvalidateResearchQueries(path, payload.refreshes)) {
            void Promise.all([
              utils.stockMarketResearch.getEnvironment.invalidate(),
              utils.preferredStockResearch.getMarketEnvironment.invalidate(),
            ]);
          }
          healthy = true;
          retryAttempt = 0;
          if (retryTimer !== null) window.clearTimeout(retryTimer);
          retryTimer = null;
          setReceivedAt(payload.receivedAt ?? new Date().toISOString());
          setConnection('live');
        } catch {
          scheduleReconnect();
        }
      };
      nextStream.addEventListener('unavailable', scheduleReconnect);
      nextStream.onerror = scheduleReconnect;
    };

    const reconnectImmediately = () => {
      if (stopped || healthy) return;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
      retryAttempt = 0;
      void connect();
    };
    const reconnectWhenVisible = () => {
      if (document.visibilityState === 'visible') reconnectImmediately();
    };

    void connect();
    window.addEventListener('online', reconnectImmediately);
    window.addEventListener('focus', reconnectImmediately);
    document.addEventListener('visibilitychange', reconnectWhenVisible);
    return () => {
      stopped = true;
      lifetime.abort();
      closeStream();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener('online', reconnectImmediately);
      window.removeEventListener('focus', reconnectImmediately);
      document.removeEventListener('visibilitychange', reconnectWhenVisible);
    };
  }, [enabled, visible, path, utils]);

  const fallbackItems = useMemo(() => distinctFeedItems((fallback.data ?? []).flatMap((feed) => feed.items) as ModuleLiveFeedItem[]), [fallback.data]);
  const archivedItems = useMemo<ModuleLiveFeedItem[]>(() => (archived.data ?? []).flatMap(dataset => {
    const rows = dataset.dataset.rows;
    if (!rows.length) return [];
    return [{
      itemKey: dataset.itemKey,
      title: dataset.title,
      body: dataset.body,
      topic: dataset.topic,
      category: dataset.category,
      sourceKind: dataset.sourceKind,
      publishedAt: dataset.publishedAt,
      updatedAt: dataset.updatedAt,
      dataset: dataset.dataset,
    } satisfies ModuleLiveFeedItem];
  }), [archived.data]);
  // The SSE channel contains only push-ledger rows.  The read endpoint also
  // projects durable publication records (including reviewed RSS articles),
  // so always merge that snapshot into a live stream.  Otherwise a healthy
  // socket could make the frontend hide persisted articles that were never
  // written to the push ledger.  The same fingerprint gate keeps the merge
  // one-copy-per-article across reconnects and tabs.
  const liveItems = connection === 'fallback' ? fallbackItems : (streamItems ?? fallbackItems);
  const items = enabled ? distinctFeedItems([...liveItems, ...fallbackItems, ...archivedItems])
    .filter(item => !options?.publicOnly || item.sourceKind === 'public') : [];
  const itemKeySignature = items.filter(item => item.dataset?.metadata.schemaVersion !== 'public-reference-history-v1')
    .filter(item=>!options?.acknowledgeFilter||options.acknowledgeFilter(item)).map((item) => item.itemKey).join('|');

  useEffect(() => {
    acknowledgedKeys.current.clear();
  }, [path]);

  useEffect(() => {
    if (!enabled || options?.acknowledge === false || !itemKeySignature) return;
    let cancelled = false;
    const pendingKeys = itemKeySignature
      .split('|')
      .filter((itemKey) => itemKey && !acknowledgedKeys.current.has(itemKey));
    if (!pendingKeys.length) return;
    // `useEffect` 本身只会在 React 已提交本批 DOM 后运行。这里再延迟一个短周期，
    // 让结构化表格完成挂载后才确认；不要依赖 requestAnimationFrame，因为后台标签页
    // 会暂停帧回调，造成“数据已渲染但 ACK 永久停留在等待中”。
    const timer = window.setTimeout(() => {
        pendingKeys.forEach((itemKey) => acknowledgedKeys.current.add(itemKey));
        const clientKey = getDeliveryClientKey();
        const sendAck = (attempt: number) => {
          if (cancelled) return;
          acknowledgeRef.current(
            { path, itemKeys: pendingKeys, clientKey },
            {
              onSuccess: (result) => {
                if (cancelled) return;
                if (result.acknowledged === pendingKeys.length) pendingKeys.forEach((itemKey) => acknowledgedKeys.current.add(itemKey));
                else pendingKeys.forEach((itemKey) => acknowledgedKeys.current.delete(itemKey));
              },
              onError: (error) => {
                if (cancelled) return;
                pendingKeys.forEach((itemKey) => acknowledgedKeys.current.delete(itemKey));
                // Transient network/database failures must not leave the
                // admin receipt permanently waiting.  Retry with bounded
                // exponential backoff; a later stream batch can retry again.
                if (attempt < 3 && error.data?.code !== 'UNAUTHORIZED' && error.data?.code !== 'FORBIDDEN') {
                  const retryTimer = window.setTimeout(() => sendAck(attempt + 1), 750 * 2 ** attempt);
                  acknowledgementTimer.current = retryTimer;
                }
              },
            },
          );
        };
        sendAck(0);
      }, 180);
    acknowledgementTimer.current = timer;
    return () => {
      cancelled = true;
      if (acknowledgementTimer.current !== null) window.clearTimeout(acknowledgementTimer.current);
    };
  }, [enabled, itemKeySignature, path, options?.acknowledge]);

  return {
    items,
    connection,
    receivedAt,
    refetch: async () => { await Promise.all([fallback.refetch(), archived.refetch()]); },
    isLoading: (fallback.isLoading && streamItems === null) || archived.isLoading,
    error: archived.error ?? (connection !== 'live' ? fallback.error : null),
  };
}
