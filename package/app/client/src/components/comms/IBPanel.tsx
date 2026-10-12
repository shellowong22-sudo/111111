/** IB 即时消息：已改为平台真实讨论串（账号间收发，永久保存），原示例联系人 / 消息已移除；即时消息、邮件、社区统一为同一实现 */
import CommsResearchLayer from "./CommsResearchLayer";
export default function IBPanel(props: { onClose?: () => void; defaultFolder?: string } & Record<string, unknown>) {
  return <div className="h-full overflow-auto bg-[#03070c] px-2 pb-2"><CommsResearchLayer moduleId="IB" /></div>;
}
