import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionAdmission, SessionAdmissionError } from "../server/auth/admission.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test("session admission preserves FIFO while another session proceeds independently", async () => {
  const admission = new SessionAdmission(), entered = deferred(), hold = deferred(), events: string[] = [];
  const first = admission.run("a", async () => { events.push("first"); entered.resolve(); await hold.promise; });
  await entered.promise;
  const second = admission.run("a", async () => { events.push("second"); });
  const third = admission.run("a", async () => { events.push("third"); });
  await admission.run("b", async () => { events.push("other"); });
  assert.deepEqual(events, ["first", "other"]);
  hold.resolve(); await Promise.all([first, second, third]);
  assert.deepEqual(events, ["first", "other", "second", "third"]);
});

test("admission bounds reject excess work without consuming capacity and failures release the lane", async () => {
  const admission = new SessionAdmission({ total: 3, perSession: 2, waitMs: 1000 });
  const entered = deferred(), hold = deferred(), otherHold = deferred(), failure = new Error("work_failed");
  const first = admission.run("a", async () => { entered.resolve(); await hold.promise; throw failure; });
  const failed = assert.rejects(first, error => error === failure);
  await entered.promise;
  const second = admission.run("a", async () => "queued");
  await assert.rejects(admission.run("a", async () => assert.fail("excess session work ran")), SessionAdmissionError);
  const other = admission.run("b", () => otherHold.promise);
  await assert.rejects(admission.run("c", async () => assert.fail("excess global work ran")), SessionAdmissionError);
  hold.resolve(); await failed; assert.equal(await second, "queued");
  assert.equal(await admission.run("a", async () => "reused"), "reused");
  otherHold.resolve(); await other;
});

test("expired waiting work never executes and its capacity is reusable", async () => {
  const admission = new SessionAdmission({ total: 2, perSession: 2, waitMs: 10 });
  const entered = deferred(), hold = deferred();
  const first = admission.run("a", async () => { entered.resolve(); await hold.promise; });
  await entered.promise;
  await assert.rejects(admission.run("a", async () => assert.fail("expired work ran")), SessionAdmissionError);
  await admission.run("b", async () => {});
  hold.resolve(); await first;
  await admission.run("a", async () => {});
});

test("an overdue waiter cannot run before its delayed timer callback", async () => {
  const admission = new SessionAdmission({ total: 2, perSession: 2, waitMs: 10 });
  const entered = deferred(), hold = deferred();
  const first = admission.run("a", async () => { entered.resolve(); await hold.promise; });
  await entered.promise;
  const expired = assert.rejects(admission.run("a", async () => assert.fail("overdue work ran")), SessionAdmissionError);
  const until = performance.now() + 15;
  while (performance.now() < until) { /* Exercise timer delay on the server event loop. */ }
  hold.resolve(); await Promise.all([first, expired]);
  await admission.run("a", async () => {});
});
