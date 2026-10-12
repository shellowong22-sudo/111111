import { ReactNode } from 'react';
import { X, Maximize2, Minimize2, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LiveNewsTicker from '@/components/LiveNewsTicker';
import MarketBriefPanel from '@/components/MarketBriefPanel';
export interface WindowConfig {
  id: string;
  title: string;
  content: ReactNode;
  minimized?: boolean;
  maximized?: boolean;
  hideHeader?: boolean;
}

interface TerminalLayoutProps {
  windows: WindowConfig[];
  onWindowClose?: (id: string) => void;
  onWindowMinimize?: (id: string) => void;
  onWindowMaximize?: (id: string) => void;
  gridLayout?: 'single' | 'double' | 'quad';
}

export default function TerminalLayout({
  windows,
  onWindowClose,
  onWindowMinimize,
  onWindowMaximize,
  gridLayout = 'double',
}: TerminalLayoutProps) {
  const getGridClass = () => {
    switch (gridLayout) {
      case 'single':
        return 'grid-cols-1 grid-rows-1';
      case 'double':
        return 'grid-cols-1 grid-rows-1 sm:grid-cols-2';
      case 'quad':
        return 'grid-cols-1 grid-rows-1 sm:grid-cols-2 sm:grid-rows-2';
      default:
        return 'grid-cols-2 grid-rows-1';
    }
  };

  const visibleWindows = windows.filter(w => !w.minimized);
  const maximizedWindow = visibleWindows.find(w => w.maximized);
  const effectiveGridLayout = visibleWindows.length === 1 ? 'single' : gridLayout;

  // ── 最大化模式：单窗口铺满整个容器 ──────────────────────────────────────
  if (maximizedWindow) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Window Header */}
        {!maximizedWindow.hideHeader && <div className="terminal-header flex-shrink-0">
          <h3 className="terminal-title flex-1">{maximizedWindow.title}</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={() => onWindowMaximize?.(maximizedWindow.id)}
              title="Restore"
            >
              <Minimize2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
              onClick={() => onWindowClose?.(maximizedWindow.id)}
              title="Close"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>}
        {/* Window Content — flex-1 so PSCHPanel's h-full resolves correctly */}
        <div className="min-h-0 flex-1 overflow-auto bg-background/50">
          {maximizedWindow.content}
        </div>
      </div>
    );
  }

  // ── 普通网格模式 ──────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'terminal-grid',
      'grid gap-1 p-1 flex-1 overflow-hidden',
      effectiveGridLayout === 'single' ? 'grid-cols-1 grid-rows-1' : getGridClass()
    )}>
      {visibleWindows.map((window) => (
        <div
          key={window.id}
          className="terminal-panel flex flex-col"
        >
          {/* Window Header */}
          {!window.hideHeader && <div className="terminal-header">
            <h3 className="terminal-title flex-1">{window.title}</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-muted"
                onClick={() => onWindowMaximize?.(window.id)}
                title="Maximize"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                onClick={() => onWindowClose?.(window.id)}
                title="Close"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>}

          {/* Window Content */}
          <div className="min-h-0 flex-1 overflow-auto bg-background/50">
            {window.content}
          </div>
        </div>
      ))}

      {/* Empty State: AI 市场简报 + 实时市场动态 */}
      {visibleWindows.length === 0 && (
        <div className="col-span-full row-span-full flex overflow-hidden">
          <div className="flex-1 hidden md:flex flex-col overflow-hidden border-r border-border">
            <MarketBriefPanel />
          </div>
          <div className="w-full md:w-80 lg:w-96 shrink-0 h-full">
            <LiveNewsTicker />
          </div>
        </div>
      )}
    </div>
  );
}
