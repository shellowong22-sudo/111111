/**
 * 前端实时刷新通道：后台发布 / 推送数据后，向所有打开的前端页面广播受影响的槽位。
 */
import type { Response } from "express";

const clients = new Set<Response>();
const MAX_CLIENTS = 500;

export function addUcStreamClient(res: Response) {
  if (clients.size >= MAX_CLIENTS) {
    const oldest = clients.values().next().value as Response | undefined;
    if (oldest) {
      clients.delete(oldest);
      try { oldest.end(); } catch { /* closed */ }
    }
  }
  clients.add(res);
  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* closed */ }
  }, 25_000);
  res.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(res);
  });
}

export function broadcastUcUpdate(slotIds: string[]) {
  const payload = `event: uc-update\ndata: ${JSON.stringify({ slots: [...new Set(slotIds)], at: Date.now() })}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

export function ucStreamClientCount() {
  return clients.size;
}
