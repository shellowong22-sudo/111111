import React from 'react';

export default function IndexPreservedModule({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full">{children}</div>;
}
