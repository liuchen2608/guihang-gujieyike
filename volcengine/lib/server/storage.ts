import { createStorage } from './storage-core';
import { tosStore } from './tos-store';
export type { AuthUser } from './storage-core';

const storage = createStorage(tosStore);
export const { createSave, readSave, readLatestSave, saveTurn, submitFeedback,
  upsertGitHubUser, createAuthSession, readAuthUser, deleteAuthSession, adoptAnonymousData } = storage;

export function reserveModelCall() {
  return storage.reserveModelCall(Number(process.env.MODEL_MONTHLY_CALL_LIMIT ?? 1000), Number(process.env.MODEL_DAILY_CALL_LIMIT ?? 100));
}
