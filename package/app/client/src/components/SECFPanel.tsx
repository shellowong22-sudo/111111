/** SECF 全球证券检索：已改为实时数据版本（与同代码其他入口同一实现，原写死数据已移除） */
import { IdxSECF } from "@/components/live/IndexLive";
export default function SECFPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxSECF onClose={onClose} />;
}
