/**
 * Global keyboard shortcuts configuration
 * Bloomberg Terminal style shortcuts
 */

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  label: string;
  description: string;
  category: 'navigation' | 'action' | 'help' | 'theme';
  handler: () => void;
}

export const SHORTCUTS_CONFIG: Shortcut[] = [
  // Navigation - F1-F9
  {
    key: 'F1',
    label: 'F1',
    description: '行情数据中心',
    category: 'navigation',
    handler: () => window.location.hash = '/market',
  },
  {
    key: 'F2',
    label: 'F2',
    description: '收益率曲线库',
    category: 'navigation',
    handler: () => window.location.hash = '/curves-list',
  },
  {
    key: 'F3',
    label: 'F3',
    description: '基金浏览',
    category: 'navigation',
    handler: () => window.location.hash = '/fund-browse',
  },
  {
    key: 'F4',
    label: 'F4',
    description: '信用评级',
    category: 'navigation',
    handler: () => window.location.hash = '/credit-ratings',
  },
  {
    key: 'F5',
    label: 'F5',
    description: '模型预测分析',
    category: 'navigation',
    handler: () => window.location.hash = '/model-predictions',
  },
  {
    key: 'F6',
    label: 'F6',
    description: '收益率曲线分析',
    category: 'navigation',
    handler: () => window.location.hash = '/yield-curve',
  },
  {
    key: 'F7',
    label: 'F7',
    description: 'SWPM 掉期管理',
    category: 'navigation',
    handler: () => window.location.hash = '/swpm',
  },
  {
    key: 'F8',
    label: 'F8',
    description: 'OVME 期权定价',
    category: 'navigation',
    handler: () => window.location.hash = '/ovme',
  },
  {
    key: 'F9',
    label: 'F9',
    description: '设置',
    category: 'navigation',
    handler: () => window.location.hash = '/settings',
  },

  // Actions
  {
    key: 'k',
    ctrl: true,
    label: 'Ctrl+K',
    description: '打开命令面板',
    category: 'action',
    handler: () => {
      const event = new CustomEvent('open-command-palette');
      window.dispatchEvent(event);
    },
  },
  {
    key: '/',
    ctrl: true,
    label: 'Ctrl+/',
    description: '显示快捷键帮助',
    category: 'help',
    handler: () => {
      const event = new CustomEvent('open-shortcuts-help');
      window.dispatchEvent(event);
    },
  },
  {
    key: 'l',
    ctrl: true,
    label: 'Ctrl+L',
    description: '清除搜索框',
    category: 'action',
    handler: () => {
      const event = new CustomEvent('clear-search');
      window.dispatchEvent(event);
    },
  },
  {
    key: 'r',
    ctrl: true,
    label: 'Ctrl+R',
    description: '刷新数据',
    category: 'action',
    handler: () => {
      const event = new CustomEvent('refresh-data');
      window.dispatchEvent(event);
    },
  },

  // Theme
  {
    key: 't',
    ctrl: true,
    label: 'Ctrl+T',
    description: '切换主题',
    category: 'theme',
    handler: () => {
      const event = new CustomEvent('toggle-theme');
      window.dispatchEvent(event);
    },
  },
];

/**
 * Convert shortcut config to human-readable format
 */
export function formatShortcut(shortcut: Shortcut): string {
  const parts = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.meta) parts.push('Cmd');
  parts.push(shortcut.key);
  return parts.join('+');
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(): Record<string, Shortcut[]> {
  const grouped: Record<string, Shortcut[]> = {
    navigation: [],
    action: [],
    help: [],
    theme: [],
  };
  SHORTCUTS_CONFIG.forEach(shortcut => {
    grouped[shortcut.category].push(shortcut);
  });
  return grouped;
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const ctrlMatch = (shortcut.ctrl ?? false) === (event.ctrlKey || event.metaKey);
  const shiftMatch = (shortcut.shift ?? false) === event.shiftKey;
  const altMatch = (shortcut.alt ?? false) === event.altKey;
  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}
