/**
 * useWsFlash
 * 追踪 WebSocket 推送触发的 symbol 闪烁状态。
 * 当 wsMap 中某个 symbol 的价格发生变化时，记录其方向（up/down）并在
 * flashDuration ms 后自动清除，供行渲染层触发整行/单元格高亮动画。
 */
import { useEffect, useRef, useState } from 'react';
import type { MarketTick } from './useMarketWebSocket';

export interface FlashState {
  dir: 'up' | 'down';
  /** 每次更新递增，用于强制重新触发 CSS animation */
  key: number;
}

/**
 * @param wsMap  useMarketWebSocket 返回的 priceMap
 * @param flashDuration  闪烁持续时间（ms），默认 800
 * @returns  symbol → FlashState，仅包含当前正在闪烁的 symbol
 */
export function useWsFlash(
  wsMap: Map<string, MarketTick>,
  flashDuration = 800
): Map<string, FlashState> {
  // 上一次 wsMap 快照，用于对比价格变化
  const prevMapRef = useRef<Map<string, number>>(new Map());
  // 当前闪烁状态
  const [flashMap, setFlashMap] = useState<Map<string, FlashState>>(new Map());
  // 清除定时器 ref：symbol → timerId
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // flashKey 计数器 ref：symbol → count
  const keyCountRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (wsMap.size === 0) return;

    const newFlashes: Array<{ symbol: string; dir: 'up' | 'down'; key: number }> = [];

    for (const [symbol, tick] of Array.from(wsMap.entries())) {
      const prevPrice = prevMapRef.current.get(symbol);
      if (prevPrice === undefined) {
        // 首次出现，记录但不闪烁
        prevMapRef.current.set(symbol, tick.price);
        continue;
      }
      if (tick.price !== prevPrice) {
        const dir: 'up' | 'down' = tick.price > prevPrice ? 'up' : 'down';
        prevMapRef.current.set(symbol, tick.price);
        const count = (keyCountRef.current.get(symbol) ?? 0) + 1;
        keyCountRef.current.set(symbol, count);
        newFlashes.push({ symbol, dir, key: count });
      }
    }

    if (newFlashes.length === 0) return;

    setFlashMap(prev => {
      const next = new Map(prev);
      for (const { symbol, dir, key } of newFlashes) {
        next.set(symbol, { dir, key });
        // 清除旧定时器
        const old = timersRef.current.get(symbol);
        if (old) clearTimeout(old);
        // 设置新定时器：flashDuration 后移除该 symbol 的闪烁状态
        const timer = setTimeout(() => {
          setFlashMap(m => {
            const updated = new Map(m);
            updated.delete(symbol);
            return updated;
          });
          timersRef.current.delete(symbol);
        }, flashDuration);
        timersRef.current.set(symbol, timer);
      }
      return next;
    });
  // wsMap 是 Map 对象，每次 WS 推送都会创建新 Map，所以 wsMap 变化即触发
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsMap, flashDuration]);

  // 组件卸载时清除所有定时器
  useEffect(() => {
    return () => {
      for (const timer of Array.from(timersRef.current.values())) {
        clearTimeout(timer);
      }
    };
  }, []);

  return flashMap;
}
