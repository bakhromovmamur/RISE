import { test, expect } from "../support/browser";
import { capacityProfile } from "../support/capacity";
import { emptyDraft, localDate, xpTotal } from "../../src/model";
import { parseStoredState } from "../../src/data/storedState";
import type { DomainCommand } from "../../src/contracts/commands";
import type {} from "../../src/review/storageHarness";

test("dense two-year profile retains check, Undo and draft durability while measuring the real adapter", async ({ page, browser }, info) => {
  const date = localDate("UTC"), state = capacityProfile(date), beforeXp = xpTotal(state);
  page.on("console", message => {
    if (message.text().startsWith("RISE capacity:")) console.info(`[${info.project.name}] ${message.text()}`);
  });
  await page.goto("/?storage-test=1");
  await expect(page.getByText("Storage test harness ready.")).toBeVisible();
  // Transport JSON text, not 73,000 remote object descriptors. This happens
  // outside measured operations and still uses the real runtime validator.
  const result = await page.evaluate(async ({ raw, date, draft }) => {
    console.info("RISE capacity: argument received");
    const api = window.riseStorageTest, store = await api.openDeviceStore();
    // A new isolated IndexedDB profile avoids the unrelated localStorage quota.
    const prepared = await api.prepareProfile(null, JSON.parse(raw)), state = prepared.state;
    await store.initialize(null, prepared); store.close();
    console.info("RISE capacity: initialized");
    const startup = performance.now(), session = await api.startDeviceSession();
    const startupMs = performance.now() - startup;
    console.info("RISE capacity: session started");
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
          console.info(`RISE capacity: saved ${command.kind}`);
        }
      }
      return { startupMs, samples, raw: JSON.stringify(session.getSnapshot().state) };
    } finally { session.close(); }
  }, { raw: JSON.stringify(state), date, draft: emptyDraft() });
  const saved = parseStoredState(result.raw);
  expect(saved.days).toEqual(state.days);
  expect(xpTotal(saved)).toBe(beforeXp);
  expect(saved.draft?.name).toBe("Synthetic draft 2");
  const reopened = await page.evaluate(async () => {
    const store = await window.riseStorageTest.openDeviceStore();
    try { const saved = await store.verify(null); return { raw: JSON.stringify(saved.state), revision: saved.revision, original: await store.original() }; }
    finally { store.close(); }
  });
  expect(parseStoredState(reopened.raw)).toEqual(saved);
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
