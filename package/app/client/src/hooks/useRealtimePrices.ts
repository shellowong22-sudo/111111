/**
 * useRealtimePrices
 * 将服务端/查询返回的行情值转换成稳定的展示 Map。
 * 客户端不生成或扰动金融数据；闪烁只在输入值真实变化时触发。
 *
 * The input signature is used to detect actual server/query changes.
 */
import { useEffect, useMemo, useState } from 'react';

export interface RealtimeItem {
  symbol: string;
  price: number;
  changeVal: number;
  changePct: number;
  volume: number;
  /** 'up' | 'down' | 'neutral' — 最近一次 tick 方向 */
  tickDir: 'up' | 'down' | 'neutral';
  /** 触发闪烁的唯一 key，每次 tick 改变 */
  flashKey: number;
}

interface BaseItem {
  symbol: string;
  price: string | number;
  changeVal?: string | number;
  changePct?: string | number;
  volume?: string | number;
  market?: string;
}

function toNum(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  return typeof v === 'string' ? parseFloat(v) || 0 : v;
}

export function useRealtimePrices<T extends BaseItem>(
  items: T[],
  options?: {
    tickInterval?: number; // 保留兼容参数；不在客户端生成 tick
  }
): Map<string, RealtimeItem> {
  void options;
  const [priceMap, setPriceMap] = useState<Map<string, RealtimeItem>>(new Map());
  const inputKey = useMemo(() => items.map(item => [item.symbol, item.price, item.changeVal, item.changePct, item.volume].join(':')).join('|'), [items]);

  useEffect(() => {
    setPriceMap(previous => {
      const next = new Map<string, RealtimeItem>();
      for (const item of items) {
        const existing = previous.get(item.symbol);
        const basePrice = toNum(item.price);
        const changeVal = toNum(item.changeVal);
        const changePct = toNum(item.changePct);
        const volume = toNum(item.volume);
        const changed = existing !== undefined && (existing.price !== basePrice || existing.changeVal !== changeVal || existing.changePct !== changePct || existing.volume !== volume);
        const direction = changed ? (basePrice > existing!.price ? 'up' : basePrice < existing!.price ? 'down' : 'neutral') : (existing?.tickDir ?? 'neutral');
        next.set(item.symbol, {
          symbol: item.symbol,
          price: basePrice,
          changeVal,
          changePct,
          volume,
          tickDir: direction,
          flashKey: (existing?.flashKey ?? 0) + (changed ? 1 : 0),
        });
      }
      return next;
    });
  }, [inputKey]);

  return priceMap;
}

/** 根据 tickDir 返回闪烁 className */
export function getFlashClass(dir: 'up' | 'down' | 'neutral'): string {
  if (dir === 'up') return 'price-flash-up';
  if (dir === 'down') return 'price-flash-down';
  return '';
}
