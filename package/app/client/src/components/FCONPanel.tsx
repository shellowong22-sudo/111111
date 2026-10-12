/** FCON 金融条件指数小窗：与经济数据中心 FCON 为同一实现 */
import FCONTab from "@/components/econ/FCONTab";
export default function FCONPanel(_props: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full overflow-auto bg-[#03070c] p-2"><FCONTab /></div>;
}
