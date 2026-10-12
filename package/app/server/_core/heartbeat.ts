import { TRPCError } from "@trpc/server";
import {
  createStandaloneSchedule,
  deleteStandaloneSchedule,
  listStandaloneSchedules,
  updateStandaloneSchedule,
} from "./standaloneScheduler";

export type HeartbeatJob = {
  name: string;
  cron: string;
  path: string;
  method?: "POST" | "PUT";
  payload?: unknown;
  description?: string;
};

export type HeartbeatJobUpdate = Partial<Omit<HeartbeatJob, "name">> & { enable?: boolean };

export type HeartbeatJobInfo = {
  taskUid: string;
  name: string;
  userId: string;
  description: string;
  cronExpression: string;
  callbackPath: string;
  callbackMethod: string;
  callbackPayload: string;
  isEnable: boolean;
  createdAt?: string | null;
  lastExecutedAt?: string | null;
  nextExecutionAt?: string | null;
};

function validateCallbackPath(path: string): void {
  if (!path || !path.startsWith("/api/scheduled/")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "callback path must start with /api/scheduled/" });
  }
}

export async function createHeartbeatJob(
  job: HeartbeatJob,
  _userSession: string,
): Promise<{ taskUid: string; nextExecutionAt?: string | null }> {
  validateCallbackPath(job.path);
  return createStandaloneSchedule({
    name: job.name,
    cron: job.cron,
    path: job.path,
    method: job.method,
    payload: job.payload,
    description: job.description,
  });
}

export async function updateHeartbeatJob(
  taskUid: string,
  patch: HeartbeatJobUpdate,
  _userSession: string,
): Promise<{ nextExecutionAt?: string | null }> {
  if (patch.path !== undefined) validateCallbackPath(patch.path);
  return updateStandaloneSchedule(taskUid, patch);
}

export async function deleteHeartbeatJob(taskUid: string, _userSession: string): Promise<void> {
  await deleteStandaloneSchedule(taskUid);
}

export async function listHeartbeatJobs(
  _userSession: string,
  _pagination?: { page?: number; pageSize?: number },
): Promise<{ total: number; actorUserId: string; jobs: HeartbeatJobInfo[] }> {
  return listStandaloneSchedules();
}
