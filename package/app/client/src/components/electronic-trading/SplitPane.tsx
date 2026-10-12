import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number; // 0-100, default 50
  minLeftWidth?: number; // px
  minRightWidth?: number; // px
  className?: string;
}

export function SplitPane({
  left,
  right,
  defaultSplit = 50,
  minLeftWidth = 320,
  minRightWidth = 320,
  className,
}: SplitPaneProps) {
  const [splitPercent, setSplitPercent] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startPercentRef = useRef(defaultSplit);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startPercentRef.current = splitPercent;
  }, [splitPercent]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const dx = e.clientX - startXRef.current;
    const dPercent = (dx / containerWidth) * 100;
    let newPercent = startPercentRef.current + dPercent;

    // Enforce min widths
    const minLeftPercent = (minLeftWidth / containerWidth) * 100;
    const minRightPercent = (minRightWidth / containerWidth) * 100;
    newPercent = Math.max(minLeftPercent, Math.min(100 - minRightPercent, newPercent));

    setSplitPercent(newPercent);
  }, [isDragging, minLeftWidth, minRightWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full w-full overflow-hidden', className)}
      style={{ userSelect: isDragging ? 'none' : 'auto' }}
    >
      {/* Left pane */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: `${splitPercent}%`, minWidth: minLeftWidth }}
      >
        {left}
      </div>

      {/* Divider */}
      <div
        className={cn(
          'relative flex-shrink-0 w-1.5 cursor-col-resize group transition-colors',
          isDragging
            ? 'bg-blue-500'
            : 'bg-[#1a2332] hover:bg-blue-500/60'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Visual handle */}
        <div className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-all',
          isDragging ? 'bg-blue-400 w-1' : 'bg-[#2a3a4a] group-hover:bg-blue-400/80'
        )} />
        {/* Center grip dots */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                'w-1 h-1 rounded-full transition-colors',
                isDragging ? 'bg-blue-300' : 'bg-[#3a4a5a] group-hover:bg-blue-300'
              )}
            />
          ))}
        </div>
      </div>

      {/* Right pane */}
      <div
        className="flex flex-col overflow-hidden flex-1"
        style={{ minWidth: minRightWidth }}
      >
        {right}
      </div>
    </div>
  );
}
