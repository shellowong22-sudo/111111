import { useEffect } from 'react';
import { SHORTCUTS_CONFIG, matchesShortcut } from '@/lib/shortcuts';

/**
 * Hook to register global keyboard shortcuts
 * Should be called once in the root App component
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      // Allow Ctrl+K and Ctrl+/ even in input fields
      const isCommandPalette = event.ctrlKey && event.key.toLowerCase() === 'k';
      const isHelpShortcut = event.ctrlKey && event.key === '/';
      
      if (isInput && !isCommandPalette && !isHelpShortcut) {
        return;
      }

      // Check all shortcuts
      for (const shortcut of SHORTCUTS_CONFIG) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
