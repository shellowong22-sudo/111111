import React from 'react';

export default function CommsPreservedModule({ moduleId, children }: { moduleId: string; children: React.ReactNode }) {
  return <div className="min-h-full" data-preserved-comms-module={moduleId}><div>{children}</div></div>;
}
