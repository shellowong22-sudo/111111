import type { ReactNode } from 'react';
import MunicipalTerminalWorkbench from './MunicipalTerminalWorkbench';

/** Keep every existing entry; render one active workspace, never stacked research layers. */
export default function MunicipalPreservedModule({ moduleId, original }: { moduleId: string; original: ReactNode }) {
  // The business view is a tab in the same workspace, not a second stacked panel.
  return <MunicipalTerminalWorkbench key={moduleId} moduleId={moduleId} original={original} />;
}
