import { test, expect } from "../support/browser";
import { capacityProfile } from "../support/capacity";
import { emptyDraft, localDate, xpTotal } from "../../src/model";
import type { DomainCommand } from "../../src/contracts/commands";
import type {} from "../../src/review/storageHarness";

test("dense two-year profile retains check, Undo and draft durability while measuring the real adapter", async ({ page, browser }, info) => {
  const date = localDate("UTC"), state = capacityProfile(date), beforeXp = xpTotal(state);
  await page.goto("/?storage-test=1");
  await expect(page.getByText("Storage test harness ready.")).toBeVisible();
  const result = await page.evaluate(async ({ state, date, draft }) => {
    const api = window.riseStorageTest, store = await api.openDeviceStore();
    // A new isolated IndexedDB profile avoids the unrelated localStorage quota.
    await store.initialize(null, await api.prepareProfile(null, state)); store.close();
    const startup = performance.now(), session = await api.startDeviceSession();
    const startupMs = performance.now() - startup;
    const samples: { action: string; dispatchMs: number; nextFrameMs: number; durableMs: number }[] = [];
    try {
      for (let round = 0; round < 3; round++) {
        const commands: DomainCommand[] = [
          { kind: "habit.check", habitId: state.habits[0].id, date, check: "full" },
          { kind: "habit.correct", habitId: state.habits[0].id, date, check: null },
          { kind: "habit.draft", draft: { ...draft, name: `Synthetic draft ${round}` } },
        ];
        for (const command of commands) {
          const start = performance.now(), accepted = session.dispatch(command), dispatchMs = performance.now() - start;
          if (!accepted) throw new Error("capacity_command_rejected");
          const pending = session.whenSaved().then(saved => {
            if (!saved) throw new Error("capacity_commit_failed");
            return performance.now() - start;
          });
          const nextFrameMs = await new Promise<number>(resolve => requestAnimationFrame(() => resolve(performance.now() - start)));
          samples.push({ action: command.kind, dispatchMs, nextFrameMs, durableMs: await pending });
        }
      }
      return { startupMs, samples, state: session.getSnapshot().state };
    } finally { session.close(); }
  }, { state, date, draft: emptyDraft() });
  expect(result.state.days).toEqual(state.days);
  expect(xpTotal(result.state)).toBe(beforeXp);
  expect(result.state.draft?.name).toBe("Synthetic draft 2");
  const reopened = await page.evaluate(async () => {
    const store = await window.riseStorageTest.openDeviceStore();
    try { const saved = await store.verify(null); return { state: saved.state, revision: saved.revision, original: await store.original() }; }
    finally { store.close(); }
  });
  expect(reopened.state).toEqual(result.state);
  expect(reopened.revision).toBe(9);
  expect(reopened.original).toBeNull();
  await info.attach("local-capacity-measurements", { contentType: "application/json", body: JSON.stringify({
    scope: "Desktop engine / real IndexedDB discovery; nextFrame is an opportunity to paint, not measured UI feedback. No physical NFR acceptance.",
    browser: browser.version(), date, habits: 100, days: 730, occurrences: 73000,
    profileBytes: new TextEncoder().encode(JSON.stringify(state)).length,
    startupMs: result.startupMs, samples: result.samples,
    invariants: "Check then Undo preserves all history/XP; draft and revision survive reopening; original recovery source stays null.",
  }, null, 2) });
});
