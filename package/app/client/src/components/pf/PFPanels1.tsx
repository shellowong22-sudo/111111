/** 优先股功能 1–6：SECF / PSCH / FIT 为条款检索与执行工具；WB / WEI / QFM 已改为实时数据版本 */
import PSCHPanel from '@/components/PSCHPanel';
import { PreferredTermScreeningTool, PreferredExecutionAnalysisTool } from '@/components/preferredstock/PreferredAnalysisTools';

export function PFSECFPanel({ onClose }: { onClose: () => void }) {
  return <PreferredTermScreeningTool onClose={onClose} />;
}
export function PFPSCHPanel({ onClose }: { onClose: () => void }) {
  return <PSCHPanel onClose={onClose} />;
}
export function PFFITPanel({ onClose }: { onClose: () => void }) {
  return <PreferredExecutionAnalysisTool onClose={onClose} />;
}
export { PFWBPanel, PFWEIPanel, PFQFMPanel } from '@/components/live/PFLive';
