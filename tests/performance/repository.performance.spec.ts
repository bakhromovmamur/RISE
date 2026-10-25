import { test, expect } from "../support/browser";
import { capacityProfile } from "../support/capacity";
import { emptyDraft, localDate, xpTotal } from "../../src/model";
import { parseStoredState } from "../../src/data/storedState";
import type { DomainCommand, LocalOperation } from "../../src/contracts/commands";
import type {} from "../../src/review/storageHarness";

test("dense repository phase measurements preserve durable records and replay", async ({ page, browser }, info) => {
  const date = localDate("UTC"), state = capacityProfile(date);
  await page.goto("/?storage-test=1");
  await expect(page.getByText("Storage test harness ready.")).toBeVisible();
  const result = await page.evaluate(async ({ raw, date, draft }) => {
    const api = window.riseStorageTest, store = await api.openDeviceStore();
    const prepared = await api.prepareProfile(null, JSON.parse(raw));
    await store.initialize(null, prepared);
    const samples: { action: string; readValidateMs: number; reducerMs: number; validateWriteCloneMs: number; repositoryMs: number; totalMs: number }[] = [];
    let phase = { readValidateMs: 0, reducerMs: 0, validateWriteCloneMs: 0, adapterMs: 0 };
    const repo = api.createLocalRepository({
      read: () => store.read(),
      async transaction(update) {
        const start = performance.now();
        let reducedAt = start;
        const result = await store.transaction(current => {
          const ready = performance.now();
          phase.readValidateMs = ready - start;
          const next = update(current);
          reducedAt = performance.now();
          phase.reducerMs = reducedAt - ready;
          return next;
        });
        phase.validateWriteCloneMs = performance.now() - reducedAt;
        phase.adapterMs = performance.now() - start;
        return result;
      },
    });
    let revision = 0, last: LocalOperation | null = null;
    try {
      for (let round = 0; round < 3; round++) {
        const commands: DomainCommand[] = [
          { kind: "habit.check", habitId: prepared.state.habits[0].id, date, check: "full" },
          { kind: "habit.correct", habitId: prepared.state.habits[0].id, date, check: null },
          { kind: "habit.draft", draft: { ...draft, name: `Synthetic draft ${round}` } },
        ];
        for (const command of commands) {
          last = { protocolVersion: 1, operationId: crypto.randomUUID(), baseRevision: revision,
            context: { date, now: Date.now(), timezone: "UTC" }, command };
          phase = { readValidateMs: 0, reducerMs: 0, validateWriteCloneMs: 0, adapterMs: 0 };
          const start = performance.now(), result = await repo.apply(last), totalMs = performance.now() - start;
          if (!result.ok) throw new Error("capacity_repository_failed");
          revision = result.snapshot.revision;
          samples.push({ action: command.kind, readValidateMs: phase.readValidateMs, reducerMs: phase.reducerMs,
            validateWriteCloneMs: phase.validateWriteCloneMs, repositoryMs: totalMs - phase.adapterMs, totalMs });
        }
      }
      const replay = await repo.apply(last);
      if (!replay.ok || !replay.replayed || replay.snapshot.revision !== revision) throw new Error("capacity_replay_failed");
      const saved = await store.verify(null);
      return { samples, revision: saved.revision, raw: JSON.stringify(saved.state), original: await store.original() };
    } finally { store.close(); }
  }, { raw: JSON.stringify(state), date, draft: emptyDraft() });
  const saved = parseStoredState(result.raw);
  expect(saved.days).toEqual(state.days);
  expect(xpTotal(saved)).toBe(xpTotal(state));
  expect(saved.draft?.name).toBe("Synthetic draft 2");
  expect(result.revision).toBe(9);
  expect(result.original).toBeNull();
  await info.attach("repository-capacity-measurements", { contentType: "application/json", body: JSON.stringify({
    scope: "Desktop repository phases; includes real strict IndexedDB transactions, no rendered UI or device/p95 acceptance.",
    browser: browser.version(), date, habits: 100, days: 730, occurrences: 73000, samples: result.samples,
    invariants: "Check/Undo preserves history and XP; nine durable revisions; exact replay does not increment; original source unchanged.",
  }, null, 2) });
});
