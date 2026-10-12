/**
 * 全局自选信号状态管理
 * 允许将任意 MBS 功能面板的投资信号收藏到侧边栏追踪
 */
import { useState, useEffect, useCallback } from 'react';

export interface FavoriteSignal {
  id: string;
  panelId: string;
  panelName: string;
  signal: 'buy' | 'sell' | 'neutral' | 'warning';
  label: string;
  value?: string;
  tooltip: string;
  addedAt: number;
}

const STORAGE_KEY = 'mbs_favorite_signals';

function loadFromStorage(): FavoriteSignal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(signals: FavoriteSignal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
  } catch {}
}

// 全局状态（模块级单例，避免多组件间不同步）
let _listeners: Array<(signals: FavoriteSignal[]) => void> = [];
let _signals: FavoriteSignal[] = loadFromStorage();

function notify() {
  _listeners.forEach(fn => fn([..._signals]));
}

export function useFavoriteSignals() {
  const [signals, setSignals] = useState<FavoriteSignal[]>([..._signals]);

  useEffect(() => {
    const listener = (updated: FavoriteSignal[]) => setSignals(updated);
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter(l => l !== listener);
    };
  }, []);

  const addFavorite = useCallback((sig: Omit<FavoriteSignal, 'id' | 'addedAt'>) => {
    const id = `${sig.panelId}-${sig.label}-${Date.now()}`;
    // 防止重复添加同一面板同一标签
    const exists = _signals.some(s => s.panelId === sig.panelId && s.label === sig.label);
    if (exists) return false;
    _signals = [{ ...sig, id, addedAt: Date.now() }, ..._signals].slice(0, 50);
    saveToStorage(_signals);
    notify();
    return true;
  }, []);

  const removeFavorite = useCallback((id: string) => {
    _signals = _signals.filter(s => s.id !== id);
    saveToStorage(_signals);
    notify();
  }, []);

  const isFavorite = useCallback((panelId: string, label: string) => {
    return _signals.some(s => s.panelId === panelId && s.label === label);
  }, [signals]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAll = useCallback(() => {
    _signals = [];
    saveToStorage(_signals);
    notify();
  }, []);

  return { signals, addFavorite, removeFavorite, isFavorite, clearAll };
}
