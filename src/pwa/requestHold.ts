// Each tab drains its private requests before approving worker replacement.
// Refused/expired update leases reopen the lane; no request or credential is queued.
let token: string | null = null;
let active = 0;
const waiting = new Set<() => void>();
const notify = () => { for (const done of waiting) done(); };

export function beginPrivateRequest(): (() => void) | null {
  if (token !== null) return null;
  active++;
  let finished = false;
  return () => { if (!finished) { finished = true; active--; notify(); } };
}
export function holdPrivateRequests(value: string): Promise<boolean> {
  if (token !== null && token !== value) return Promise.resolve(false);
  token = value;
  return new Promise(resolve => {
    const done = () => {
      if (token !== value || active === 0) { waiting.delete(done); resolve(token === value); }
    };
    waiting.add(done); done();
  });
}
export function releasePrivateRequests(value: string) {
  if (token === value) { token = null; notify(); }
}
