import { STORAGE_KEY, type State } from "../model";
import { parseOperation } from "../contracts/commands";
import type { LocalStore, RepositoryRecord } from "./repository";
import { digest, type PreparedProfile, type ImportSummary } from "./migration";
import { parseStoredState, validateState, validateStateEnvelope } from "./storedState";
import { object, number, oneOf, string, bool, instant, nullable } from "./validation";
import { projectBackup, validateArchives, type LocalArchive } from "./backupProjection";
import { canonical, validateRestore, type RestorePreview } from "./backup";

export const DATABASE_NAME = "rise-device";
export const DATABASE_VERSION = 1;
export class DeviceStorageError extends Error {
  constructor(readonly code: "unavailable" | "invalid-data" | "conflict" | "legacy-changed" | "readback" | "operation-reused") { super(code); }
}
export interface DeviceRecord extends RepositoryRecord {
  format: 1 | 2;
  migration: { status: "pending" | "verified"; hash: string; summary: ImportSummary };
  archives?: LocalArchive[];
}
export interface RestorePoint { id: string; createdAt: string; previous: DeviceRecord }
export interface PendingWrite { operationId: string; baseRevision: number; state: State }
interface LocalReceipt {
  operationId: string; baseRevision: number; revision: number; hash: string;
  kind: "local-state-change" | "domain-command" | "restore"; cloudEligible: false;
  // Compatibility writes are revision receipts, not uploadable whole-profile payloads.
  command?: ReturnType<typeof parseOperation>;
}
function record(value: unknown): DeviceRecord {
  validateStateEnvelope(value);
  const row = object(value, "device record"), migration = object(row.migration, "migration");
  oneOf(1, 2)(row.format, "format"); number(0, Number.MAX_SAFE_INTEGER, true)(row.revision, "revision");
  oneOf("pending", "verified")(migration.status, "migration status"); string(64, /^[0-9a-f]{64}$/)(migration.hash, "hash");
  const summary = object(migration.summary, "summary");
  oneOf(false)(summary.cloudEligible, "cloud eligibility");
  oneOf("new", "demo-or-mixed", "unverified-legacy")(summary.provenance, "provenance");
  instant(summary.importedAt, "import date");
  nullable(oneOf(1, 2, 3, 4))(summary.sourceSchema, "source schema");
  bool(summary.fixtureSignatures, "fixture signatures");
  for (const key of ["habits", "habitChecks", "prayerChecks", "sampleDays"]) number(0, Number.MAX_SAFE_INTEGER, true)(summary[key], key);
  if (!Array.isArray(row.receipts)) throw new DeviceStorageError("invalid-data");
  for (const item of row.receipts) { const receipt = object(item, "receipt"); parseOperation(receipt.operation); number(1, Number.MAX_SAFE_INTEGER, true)(receipt.revision, "receipt revision"); }
  if (row.archives !== undefined) validateArchives(row.archives, value.state);
  return value as DeviceRecord; // Every field used by the adapter is checked above.
}
const request = <T>(r: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const writeTransaction = (db: IDBDatabase, stores: string[]) => db.transaction(stores, "readwrite", { durability: "strict" });
const completed = (tx: IDBTransaction): Promise<void> => {
  const result = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new DeviceStorageError("unavailable")); tx.onerror = () => { /* onabort reports transaction failure, never request success. */ };
  });
  // A request can reject first. Mark the completion promise handled even on that path.
  void result.catch(() => undefined);
  return result;
};

export async function openDeviceStore(): Promise<DeviceStore> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let rejected = false;
    const r = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    r.onupgradeneeded = () => {
      for (const name of ["profile", "recovery", "outbox"]) if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name);
    };
    r.onblocked = () => { rejected = true; reject(new DeviceStorageError("unavailable")); };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => { if (rejected) r.result.close(); else resolve(r.result); };
  });
  db.onversionchange = () => db.close();
  return new DeviceStore(db);
}

export class DeviceStore implements LocalStore {
  constructor(private readonly db: IDBDatabase) {}
  close() { this.db.close(); }
  /** The raw source and candidate are installed together. An interrupted readback stays pending. */
  async initialize(raw: string | null, prepared: PreparedProfile): Promise<DeviceRecord> {
    const tx = writeTransaction(this.db, ["profile", "recovery"]), done = completed(tx);
    try {
      const profiles = tx.objectStore("profile"), existing: unknown = await request(profiles.get("current"));
      if (existing === undefined) {
        const initial: DeviceRecord = { format: 1, revision: 0, state: prepared.state, receipts: [], migration: { status: "pending", hash: prepared.hash, summary: prepared.summary } };
        profiles.add(initial, "current"); tx.objectStore("recovery").add(raw, "legacy");
      }
      await done;
    } catch (error) { try { tx.abort(); } catch { /* already settled */ } await done.catch(() => undefined); throw error; }
    return this.verify(raw);
  }
  async existing(): Promise<DeviceRecord | null> {
    const tx = this.db.transaction("profile", "readonly"), done = completed(tx);
    const value: unknown = await request(tx.objectStore("profile").get("current")); await done;
    return value === undefined ? null : record(value);
  }
  async original(): Promise<string | null> {
    const tx = this.db.transaction("recovery", "readonly"), done = completed(tx);
    const value: unknown = await request(tx.objectStore("recovery").get("legacy")); await done;
    if (value !== null && typeof value !== "string") throw new DeviceStorageError("invalid-data");
    return value;
  }
  async verify(raw: string | null): Promise<DeviceRecord> {
    let current = await this.read();
    if (raw !== await this.original()) throw new DeviceStorageError("legacy-changed");
    if (current.migration.status === "pending") {
      if (await digest(current.state) !== current.migration.hash || current.revision !== 0) throw new DeviceStorageError("readback");
      current = await this.update(current => ({ ...current, migration: { ...current.migration, status: "verified" } }));
      // A separate committed read is required before the app enables any edits.
      const verified = await this.read();
      if (verified.migration.status !== "verified" || (verified.revision === 0 && await digest(verified.state) !== verified.migration.hash)) throw new DeviceStorageError("readback");
      return verified;
    }
    return current;
  }
  async read(): Promise<DeviceRecord> {
    const value = await this.existing();
    if (!value) throw new DeviceStorageError("invalid-data");
    return value;
  }
  private async update(change: (current: DeviceRecord, outbox: IDBObjectStore) => DeviceRecord): Promise<DeviceRecord> {
    const tx = writeTransaction(this.db, ["profile", "outbox"]), done = completed(tx);
    try {
      const profiles = tx.objectStore("profile");
      const current = record(await request(profiles.get("current")));
      const next = change(current, tx.objectStore("outbox"));
      validateState(next.state);
      // Capture an owned acknowledgment before yielding: the callback may keep
      // and mutate its working copy while the strict transaction is committing.
      const committed = structuredClone(next);
      profiles.put(committed, "current"); await done;
      return committed;
    } catch (error) { try { tx.abort(); } catch { /* already settled */ } await done.catch(() => undefined); throw error; }
  }
  async transaction(change: (current: RepositoryRecord) => RepositoryRecord): Promise<RepositoryRecord> {
    return this.update((current, outbox) => {
      if (current.migration.status !== "verified") throw new DeviceStorageError("readback");
      const next = change(current);
      for (const receipt of next.receipts.slice(current.receipts.length)) {
        const entry: LocalReceipt = { operationId: receipt.operation.operationId, baseRevision: receipt.operation.baseRevision, revision: receipt.revision, hash: "", kind: "domain-command", cloudEligible: false, command: receipt.operation };
        outbox.add(entry, entry.operationId);
      }
      return { ...current, ...next };
    });
  }
  async commit(write: PendingWrite): Promise<DeviceRecord> {
    const state = parseStoredState(JSON.stringify(write.state)), hash = await digest(state);
    const tx = writeTransaction(this.db, ["profile", "outbox"]), done = completed(tx);
    try {
      const profiles = tx.objectStore("profile"), outbox = tx.objectStore("outbox");
      const current = record(await request(profiles.get("current")));
      const receipt: unknown = await request(outbox.get(write.operationId));
      if (receipt !== undefined) {
        const previous = object(receipt, "receipt");
        if (previous.hash !== hash || previous.baseRevision !== write.baseRevision) throw new DeviceStorageError("operation-reused");
        await done; return current;
      }
      if (current.migration.status !== "verified") throw new DeviceStorageError("readback");
      if (write.baseRevision !== current.revision || !Number.isSafeInteger(current.revision + 1)) throw new DeviceStorageError("conflict");
      const next = { ...current, state, revision: current.revision + 1 };
      const entry: LocalReceipt = { operationId: write.operationId, baseRevision: write.baseRevision, revision: next.revision, hash, kind: "local-state-change", cloudEligible: false };
      profiles.put(next, "current"); outbox.add(entry, entry.operationId);
      await done;
      return next;
    } catch (error) { try { tx.abort(); } catch { /* already settled */ } await done.catch(() => undefined); throw error; }
  }
  async restorePoint(): Promise<RestorePoint | null> {
    const tx = this.db.transaction("recovery", "readonly"), done = completed(tx);
    const value: unknown = await request(tx.objectStore("recovery").get("pre-import")); await done;
    if (value === undefined) return null;
    const point = object(value, "restore point"); string(160)(point.id, "restore point ID"); instant(point.createdAt, "restore point time");
    return { id: String(point.id), createdAt: String(point.createdAt), previous: record(point.previous) };
  }
  /** Snapshot, replacement and local-only receipt either all commit or all abort. */
  async restore(preview: RestorePreview, operationId: string, recoveryId?: string): Promise<DeviceRecord> {
    const staged = structuredClone(preview);
    await validateRestore(staged);
    string(160, /^\S+$/)(operationId, "restore operation ID");
    const tx = writeTransaction(this.db, ["profile", "recovery", "outbox"]), done = completed(tx);
    try {
      const profiles = tx.objectStore("profile"), recovery = tx.objectStore("recovery"), outbox = tx.objectStore("outbox");
      const current = record(await request(profiles.get("current")));
      const receipt: unknown = await request(outbox.get(operationId));
      if (receipt !== undefined) {
        const old = object(receipt, "restore receipt");
        if (old.kind !== "restore" || old.hash !== staged.hash || old.baseRevision !== staged.baseRevision) throw new DeviceStorageError("operation-reused");
        await done; return current;
      }
      if (current.migration.status !== "verified") throw new DeviceStorageError("readback");
      if (current.revision !== staged.baseRevision || !Number.isSafeInteger(current.revision + 1)) throw new DeviceStorageError("conflict");
      let previous: DeviceRecord | null = null;
      if (recoveryId !== undefined) {
        const point = object(await request(recovery.get("pre-import")), "restore point");
        if (point.id !== recoveryId) throw new DeviceStorageError("conflict");
        previous = record(point.previous);
        if (canonical(projectBackup(previous.state, previous.archives)) !== canonical(staged.content)) throw new DeviceStorageError("readback");
      }
      // Older DATA-01 clients reject format 2 instead of clearing a profile while
      // unknowingly leaving its new recovery point or archives behind.
      const next: DeviceRecord = previous ? { ...previous, format: 2, revision: current.revision + 1, receipts: [] } :
        { ...current, format: 2, state: staged.content.personal, archives: staged.content.localArchives, receipts: [], revision: current.revision + 1,
          migration: { status: "verified", hash: staged.hash, summary: staged.summary } };
      record(next);
      recovery.put({ id: operationId, createdAt: new Date().toISOString(), previous: current } satisfies RestorePoint, "pre-import");
      profiles.put(next, "current");
      outbox.add({ operationId, baseRevision: current.revision, revision: next.revision, hash: staged.hash, kind: "restore", cloudEligible: false } satisfies LocalReceipt, operationId);
      // Failed readback can still abort every write in this transaction.
      const readback: unknown = await request(profiles.get("current"));
      if (JSON.stringify(readback) !== JSON.stringify(next)) throw new DeviceStorageError("readback");
      await done; return next;
    } catch (error) { try { tx.abort(); } catch { /* already settled */ } await done.catch(() => undefined); throw error; }
  }
  /** Only the existing explicit Clear local data confirmation may call this. */
  async clear(baseRevision: number, state: State): Promise<DeviceRecord> {
    const normalized = parseStoredState(JSON.stringify(state)), hash = await digest(normalized);
    const tx = writeTransaction(this.db, ["profile", "recovery", "outbox"]), done = completed(tx);
    try {
      const profiles = tx.objectStore("profile"), current = record(await request(profiles.get("current")));
      if (current.revision !== baseRevision) throw new DeviceStorageError("conflict");
      const next: DeviceRecord = { ...current, format: 2, revision: current.revision + 1, state: normalized, archives: [], receipts: [], migration: { status: "verified", hash, summary: { ...current.migration.summary, provenance: "new", sourceSchema: null, habits: 0, habitChecks: 0, prayerChecks: 0, sampleDays: 0, fixtureSignatures: false } } };
      // Leave a revisioned empty profile so an already-open tab cannot resurrect the old data.
      profiles.put(next, "current"); tx.objectStore("outbox").clear(); tx.objectStore("recovery").clear(); tx.objectStore("recovery").put(null, "legacy");
      await done;
      localStorage.removeItem(STORAGE_KEY);
      return next;
    } catch (error) { try { tx.abort(); } catch { /* already settled */ } await done.catch(() => undefined); throw error; }
  }
}
