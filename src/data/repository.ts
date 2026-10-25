import { PersonalReferenceError } from "../domain/personalCommands";
import type { State } from "../model";
import { CommandValidationError, parseOperation, type LocalOperation } from "../contracts/commands";
import { applyDomainCommand, CommandReferenceError } from "../domain/commands";

export interface RepositorySnapshot { revision: number; state: State }
export type CommandResult =
  | { ok: true; snapshot: RepositorySnapshot; operationRevision: number; replayed: boolean }
  | { ok: false; code: "invalid-command" | "missing-record" | "conflict" | "operation-reused" | "storage-failed" };
export interface RepositoryRecord extends RepositorySnapshot {
  receipts: { operation: LocalOperation; revision: number }[];
}
export interface LocalStore {
  /** Transfer an owned result: detached from durable/internal state and other calls. */
  read(): Promise<RepositoryRecord>;
  /** Serialize the callback, atomically commit, then return an owned detached result.
   * The callback's input/result must not alias the returned or retained record.
   */
  transaction(update: (current: RepositoryRecord) => RepositoryRecord): Promise<RepositoryRecord>;
}
export interface LocalRepository {
  read(): Promise<RepositorySnapshot>;
  apply(operation: unknown): Promise<CommandResult>;
}
class RepositoryConflict extends Error {
  constructor(readonly code: "conflict" | "operation-reused") { super(code); }
}
// Adapters already detach at the storage boundary. Transfer that owned state
// rather than copying the entire history again for each read/acknowledgment.
const snapshot = (record: RepositoryRecord): RepositorySnapshot => ({ revision: record.revision, state: record.state });

/** The only command-to-storage boundary. Invalid input never calls an adapter. */
export function createLocalRepository(store: LocalStore): LocalRepository {
  return {
    async read() { return snapshot(await store.read()); },
    async apply(value) {
      let operation: LocalOperation;
      try { operation = parseOperation(value); }
      catch (error) {
        if (error instanceof CommandValidationError) return { ok: false, code: "invalid-command" };
        throw error;
      }
      let replayed = false, operationRevision = 0;
      try {
        const committed = await store.transaction(current => {
          const receipt = current.receipts.find(r => r.operation.operationId === operation.operationId);
          if (receipt) {
            if (JSON.stringify(receipt.operation) !== JSON.stringify(operation)) throw new RepositoryConflict("operation-reused");
            replayed = true;
            operationRevision = receipt.revision;
            return current;
          }
          if (current.revision !== operation.baseRevision || !Number.isSafeInteger(current.revision + 1)) throw new RepositoryConflict("conflict");
          const state = applyDomainCommand(current.state, operation.command, operation.context);
          operationRevision = current.revision + 1;
          return { state, revision: operationRevision, receipts: [...current.receipts, { operation, revision: operationRevision }] };
        });
        return { ok: true, snapshot: snapshot(committed), operationRevision, replayed };
      } catch (error) {
        if (error instanceof CommandValidationError) return { ok: false, code: "invalid-command" };
        if (error instanceof CommandReferenceError || error instanceof PersonalReferenceError) return { ok: false, code: "missing-record" };
        if (error instanceof RepositoryConflict) return { ok: false, code: error.code };
        return { ok: false, code: "storage-failed" };
      }
    },
  };
}

/** Non-durable adapter for isolated tests and future session-only use; never claims a device save. */
export function createMemoryRepository(initial: State): LocalRepository {
  let record: RepositoryRecord = { state: structuredClone(initial), revision: 0, receipts: [] };
  let tail = Promise.resolve();
  return createLocalRepository({
    async read() { await tail; return structuredClone(record); },
    transaction(update) {
      const next = tail.then(() => {
        const updated = update(structuredClone(record));
        record = structuredClone(updated);
        return structuredClone(record);
      });
      tail = next.then(() => undefined, () => undefined);
      return next;
    },
  });
}
