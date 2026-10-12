import React from 'react';

export default function NewsPreservedModule({ moduleId, children }: { moduleId: string; children: React.ReactNode }) {
  return <div className="min-h-full" data-preserved-news-module={moduleId}><div className="overflow-x-auto overscroll-x-contain" aria-label="原新闻与研究工作区，小视口可横向滚动原工作区以保持字段可读"><div className="min-w-[960px] lg:min-w-0">{children}</div></div></div>;
}
