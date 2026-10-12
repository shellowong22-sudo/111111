import type { Request } from "express";
import { ENV } from "./env";
import { sdk, type AuthenticatedUser } from "./sdk";

export type ScheduledActor = Pick<AuthenticatedUser, "isCron" | "taskUid">;

export async function authenticateScheduledRequest(
  req: Request,
): Promise<ScheduledActor> {
  if (!ENV.standaloneMode) {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      throw new Error("cron-only");
    }
    return { isCron: true, taskUid: user.taskUid };
  }

  const secret = process.env.SCHEDULER_SECRET ?? "";
  const supplied = req.header("x-scheduler-secret") ?? "";
  if (!secret || supplied !== secret) {
    throw new Error("scheduler-secret-invalid");
  }

  const taskUid = req.header("x-scheduler-task-id") ?? undefined;
  return { isCron: true, taskUid };
}
