import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type LocalSourceRule = {
  id: number;
  userId: number;
  sourceId: string;
  thresholdDays: number;
  isActive: boolean;
  timezone: string;
  digestMode: 'immediate' | 'daily';
  createdAt: string;
  updatedAt: string;
};

export type LocalSourceRuleShare = {
  id: number;
  ruleId: number;
  ownerId: number;
  sharedWithUserId: number;
  permission: 'viewer' | 'editor';
  createdAt: string;
  updatedAt: string;
};

export type LocalMmflowPackage = {
  id: number;
  userId: number;
  name: string;
  sourceIds: string[];
  status: 'draft' | 'submitted' | 'approved' | 'changes_requested';
  approvalDeadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalMmflowShare = {
  id: number;
  packageId: number;
  sharedWithUserId: number;
  permission: 'viewer' | 'editor' | 'reviewer';
  createdAt: string;
  updatedAt: string;
};

export type LocalMmflowReview = {
  id: number;
  packageId: number;
  reviewerUserId: number;
  status: 'pending' | 'approved' | 'changes_requested';
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalMmflowVersion = {
  id: number;
  packageId: number;
  version: number;
  sourceIds: string[];
  status: 'draft' | 'submitted' | 'approved' | 'changes_requested';
  snapshotAt: string;
  actorUserId: number;
  note: string | null;
};

export type LocalSourceAvailability = {
  sourceId: string;
  sourceLabel: string;
  status: 'available' | 'unavailable';
  recordCount: number;
  latencyMs: number | null;
  sampledAt: string;
};

export type LocalModuleUsage = {
  userId: number;
  moduleId: string;
  bucket: string;
  openedAt: string;
};

export type MoneyMarketLocalState = {
  revision: 1;
  nextId: number;
  sourceRules: LocalSourceRule[];
  sourceRuleShares: LocalSourceRuleShare[];
  mmflowPackages: LocalMmflowPackage[];
  mmflowShares: LocalMmflowShare[];
  mmflowReviews: LocalMmflowReview[];
  mmflowVersions: LocalMmflowVersion[];
  sourceAvailability: LocalSourceAvailability[];
  moduleUsage: LocalModuleUsage[];
};

const localDataDirectory = process.env.TERMINAL_LOCAL_DATA_DIR
  ? path.resolve(process.env.TERMINAL_LOCAL_DATA_DIR)
  : path.join(process.cwd(), 'data');
const localStatePath = path.join(localDataDirectory, 'money-market-state.json');
let writeQueue: Promise<unknown> = Promise.resolve();

function emptyState(): MoneyMarketLocalState {
  return {
    revision: 1,
    nextId: 1,
    sourceRules: [],
    sourceRuleShares: [],
    mmflowPackages: [],
    mmflowShares: [],
    mmflowReviews: [],
    mmflowVersions: [],
    sourceAvailability: [],
    moduleUsage: [],
  };
}

function normalizeState(value: Partial<MoneyMarketLocalState> | null): MoneyMarketLocalState {
  const base = emptyState();
  if (!value || value.revision !== 1) return base;
  return {
    ...base,
    ...value,
    nextId: Number.isInteger(value.nextId) && Number(value.nextId) > 0 ? Number(value.nextId) : 1,
    sourceRules: Array.isArray(value.sourceRules) ? value.sourceRules : [],
    sourceRuleShares: Array.isArray(value.sourceRuleShares) ? value.sourceRuleShares : [],
    mmflowPackages: Array.isArray(value.mmflowPackages) ? value.mmflowPackages : [],
    mmflowShares: Array.isArray(value.mmflowShares) ? value.mmflowShares : [],
    mmflowReviews: Array.isArray(value.mmflowReviews) ? value.mmflowReviews : [],
    mmflowVersions: Array.isArray(value.mmflowVersions) ? value.mmflowVersions : [],
    sourceAvailability: Array.isArray(value.sourceAvailability) ? value.sourceAvailability : [],
    moduleUsage: Array.isArray(value.moduleUsage) ? value.moduleUsage : [],
  };
}

async function loadState(): Promise<MoneyMarketLocalState> {
  try {
    return normalizeState(JSON.parse(await readFile(localStatePath, 'utf8')) as Partial<MoneyMarketLocalState>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[MoneyMarketStore] Failed to read local state:', error);
    return emptyState();
  }
}

async function persistState(state: MoneyMarketLocalState) {
  await mkdir(localDataDirectory, { recursive: true });
  const temporaryPath = `${localStatePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
  await rename(temporaryPath, localStatePath);
}

export function allocateMoneyMarketLocalId(state: MoneyMarketLocalState) {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

export async function readMoneyMarketLocalState<T>(reader: (state: MoneyMarketLocalState) => T | Promise<T>): Promise<T> {
  await writeQueue.catch(() => undefined);
  return reader(await loadState());
}

export async function updateMoneyMarketLocalState<T>(mutator: (state: MoneyMarketLocalState) => T | Promise<T>): Promise<T> {
  const operation = writeQueue.then(async () => {
    const state = await loadState();
    const result = await mutator(state);
    await persistState(state);
    return result;
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
