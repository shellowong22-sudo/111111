import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { X, Megaphone, AlertTriangle, Info, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_STYLES = {
  info: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-400',
    icon: Info,
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-400',
    icon: AlertTriangle,
  },
  urgent: {
    bg: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400',
    icon: Megaphone,
  },
  maintenance: {
    bg: 'bg-purple-500/10 border-purple-500/30',
    text: 'text-purple-400',
    icon: Wrench,
  },
};

export default function AnnouncementBanner() {
  const { data: announcements = [] } = trpc.announcement.getPublished.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });

  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 从 sessionStorage 恢复已关闭状态（当前会话有效）
  useEffect(() => {
    const closedBanner = sessionStorage.getItem('announcement-banner-closed');
    if (closedBanner === 'true') {
      setBannerClosed(true);
    }
    const stored = sessionStorage.getItem('dismissed-announcements-session');
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)));
      } catch {}
    }
  }, []);

  const dismiss = (id: number) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    sessionStorage.setItem('dismissed-announcements-session', JSON.stringify(Array.from(next)));
  };

  const closeBanner = () => {
    setBannerClosed(true);
    sessionStorage.setItem('announcement-banner-closed', 'true');
  };

  const visible = (announcements as any[]).filter((a: any) => !dismissed.has(a.id));

  // Auto-play carousel
  const goToNext = useCallback(() => {
    if (visible.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % visible.length);
      setIsTransitioning(false);
    }, 200);
  }, [visible.length]);

  const goToPrev = useCallback(() => {
    if (visible.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + visible.length) % visible.length);
      setIsTransitioning(false);
    }, 200);
  }, [visible.length]);

  useEffect(() => {
    if (visible.length <= 1) return;
    autoPlayRef.current = setInterval(goToNext, 5000);
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [visible.length, goToNext]);

  // Reset index if it goes out of bounds
  useEffect(() => {
    if (currentIndex >= visible.length) {
      setCurrentIndex(0);
    }
  }, [visible.length, currentIndex]);

  if (bannerClosed || visible.length === 0) return null;

  const safeIndex = currentIndex < visible.length ? currentIndex : 0;
  const item = visible[safeIndex];
  const style = TYPE_STYLES[item.type as keyof typeof TYPE_STYLES] || TYPE_STYLES.info;
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-4 py-2.5 border-b overflow-hidden',
        style.bg,
      )}
    >
      {/* Icon */}
      <Icon className={cn('w-4 h-4 shrink-0', style.text)} />

      {/* Content with slide animation */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div
          className={cn(
            'transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
            isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          )}
        >
          <span className={cn('text-sm font-medium mr-2', style.text)}>{item.title}</span>
          <span
            className="text-xs text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content) }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Carousel controls */}
        {visible.length > 1 && (
          <div className="flex items-center gap-0.5 mr-1">
            <button
              onClick={() => { goToPrev(); if (autoPlayRef.current) { clearInterval(autoPlayRef.current); autoPlayRef.current = setInterval(goToNext, 5000); } }}
              className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground transition-colors"
              title="上一条"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {/* Dots indicator */}
            <div className="flex items-center gap-0.5 mx-1">
              {visible.map((_: any, idx: number) => (
                <span
                  key={idx}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all duration-200',
                    idx === safeIndex ? 'bg-current scale-125' : 'bg-muted-foreground/30'
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => { goToNext(); if (autoPlayRef.current) { clearInterval(autoPlayRef.current); autoPlayRef.current = setInterval(goToNext, 5000); } }}
              className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground transition-colors"
              title="下一条"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
              {safeIndex + 1}/{visible.length}
            </span>
          </div>
        )}

        {/* Dismiss current */}
        <button
          onClick={() => dismiss(item.id)}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground transition-colors"
          title="关闭此条"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Close all banner */}
        <button
          onClick={closeBanner}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground transition-colors ml-0.5"
          title="关闭公告栏（本次会话不再显示）"
        >
          <X className="w-3 h-3 opacity-60" />
        </button>
      </div>
    </div>
  );
}

/** Simple HTML sanitizer - only allow basic formatting tags */
function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Allow only safe tags: b, i, em, strong, a, br, u, span
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/<(?!\/?(b|i|em|strong|a|br|u|span|p|ul|ol|li)\b)[^>]+>/gi, '');
}
