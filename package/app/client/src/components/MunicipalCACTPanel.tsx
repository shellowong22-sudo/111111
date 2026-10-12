/** CACT 公司大事检索：与股票菜单 CACT 为同一实现。 */
import CACTPanel from "@/components/CACTPanel";
export default function MunicipalCACTPanel({ onClose }: { onClose?: () => void }) {
  return <CACTPanel onClose={onClose} />;
}
