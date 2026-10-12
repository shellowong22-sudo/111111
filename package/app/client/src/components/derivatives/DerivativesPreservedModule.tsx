import type { ReactNode } from 'react';

type ModuleId = 'ov' | 'oils' | 'fom' | 'wbf-ai' | 'credit-monitor' | 'cdsw' | 'vca' | 'mars' | 'ovcv' | 'dlib' | 'moso' | 'ovml';

export default function DerivativesPreservedModule({ moduleId, children }: { moduleId: ModuleId; children: ReactNode }) {
  void moduleId;
  // 衍生品各功能已是完整实时面板；不再追加公开资料层（重复且显示来源）。
  return <>{children}</>;
}
