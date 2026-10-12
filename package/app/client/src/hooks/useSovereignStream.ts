import { useEffect, useMemo, useState } from 'react';

export type SovereignStreamFrame = {
  receivedAt: string;
  sequence?: number;
  rates: Record<string, number | null | undefined>;
};

export type SovereignStreamChartPoint = {
  time: string;
  [series: string]: string | number | null | undefined;
};

export function useSovereignStream(moduleId: number, frequency = 5) {
  const [frames, setFrames] = useState<SovereignStreamFrame[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const stream = new EventSource(`/api/terminal/stream?module=sovereign-${moduleId}&freq=${frequency}`);
    stream.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data) as SovereignStreamFrame;
        if (!frame || !frame.receivedAt || !frame.rates) return;
        setConnected(true);
        setFrames((current) => [...current.slice(-79), frame]);
      } catch {
        // Keep the most recent valid frame when a transport fragment is malformed.
      }
    };
    stream.onerror = () => setConnected(false);
    return () => stream.close();
  }, [frequency, moduleId]);

  const latest = frames.at(-1) ?? null;
  const chart = useMemo<SovereignStreamChartPoint[]>(() => frames.map((frame) => ({
    time: new Date(frame.receivedAt).toLocaleTimeString('zh-CN', { minute: '2-digit', second: '2-digit' }),
    ...frame.rates,
  })), [frames]);

  return { connected, frames, latest, chart };
}
