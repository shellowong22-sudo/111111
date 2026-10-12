import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { groupShortcutsByCategory, SHORTCUTS_CONFIG } from '@/lib/shortcuts';
import { Keyboard, Navigation, Zap, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_ICONS = {
  navigation: Navigation,
  action: Zap,
  help: Keyboard,
  theme: Palette,
};

const CATEGORY_LABELS = {
  navigation: '快速导航',
  action: '常用操作',
  help: '帮助',
  theme: '主题',
};

export default function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('navigation');
  const grouped = groupShortcutsByCategory();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            键盘快捷键 (Ctrl+/ 打开)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'px-3 py-1.5 rounded-sm text-sm font-medium transition-colors flex items-center gap-2',
                  selectedCategory === category
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {(() => {
                  const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];
                  return <Icon className="w-4 h-4" />;
                })()}
                {label}
              </button>
            ))}
          </div>

          {/* Shortcuts List */}
          <div className="space-y-3">
            {grouped[selectedCategory]?.map((shortcut) => (
              <div key={shortcut.label} className="flex items-start justify-between gap-4 pb-3 border-b border-border last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{shortcut.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {shortcut.category === 'navigation' && '按下此键快速跳转到对应页面'}
                    {shortcut.category === 'action' && '执行常用操作'}
                    {shortcut.category === 'help' && '获取帮助信息'}
                    {shortcut.category === 'theme' && '切换应用主题'}
                  </p>
                </div>
                <kbd className="px-2 py-1 bg-card border border-border rounded-sm text-xs font-mono whitespace-nowrap">
                  {shortcut.label}
                </kbd>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="bg-muted/50 border border-border rounded-sm p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">💡 提示</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• 在输入框中输入时，大多数快捷键被禁用（除了 Ctrl+K 和 Ctrl+/）</li>
              <li>• 所有快捷键都遵循 Ucheer Terminal 的设计惯例</li>
              <li>• 可以在任何页面按 Ctrl+/ 随时打开此帮助面板</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
