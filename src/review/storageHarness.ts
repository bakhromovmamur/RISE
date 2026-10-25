/** Isolated review build only. Tests exercise the real adapter, not a simulated database. */
import { openDeviceStore } from "../data/indexedDb";
import { prepareProfile } from "../data/migration";
import { createEmptyState } from "../data/initialState";
import { createLocalRepository } from "../data/repository";
import { startDeviceSession } from "../data/deviceSession";
import { assertReviewOrigin } from "./origin";
import { createBackup, previewRestore } from "../data/backup";
import { runBackupJob } from "../data/backupWorker";

export function installStorageHarness() {
  assertReviewOrigin(location.origin);
  window.riseStorageTest = { openDeviceStore, prepareProfile, createEmptyState, createLocalRepository, startDeviceSession, createBackup, previewRestore, runBackupJob };
}
declare global {
  interface Window {
    riseStorageTest: { openDeviceStore: typeof openDeviceStore; prepareProfile: typeof prepareProfile; createEmptyState: typeof createEmptyState; createLocalRepository: typeof createLocalRepository; startDeviceSession: typeof startDeviceSession; createBackup: typeof createBackup; previewRestore: typeof previewRestore; runBackupJob: typeof runBackupJob };
  }
}
