export class SessionAdmissionError extends Error {
  constructor() { super("session_admission_unavailable"); }
}
interface Waiter { enter: () => void }
interface Lane { waiting: Set<Waiter> }

/** Local scheduling only: every admitted operation must still verify its session.
 * No database connection is held while another operation for this key runs. */
export class SessionAdmission {
  private readonly lanes = new Map<string, Lane>();
  private count = 0;
  constructor(private readonly limits = { total: 256, perSession: 16, waitMs: 3000 }) {}

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const release = await this.acquire(key);
    try { return await work(); }
    finally { release(); }
  }

  private acquire(key: string): Promise<() => void> {
    const existing = this.lanes.get(key);
    if (this.count >= this.limits.total || existing && existing.waiting.size + 1 >= this.limits.perSession)
      return Promise.reject(new SessionAdmissionError());
    this.count++;
    if (!existing) {
      const lane: Lane = { waiting: new Set() };
      this.lanes.set(key, lane);
      return Promise.resolve(() => this.release(key, lane));
    }
    return new Promise((resolve, reject) => {
      const deadline = performance.now() + this.limits.waitMs;
      const waiter: Waiter = { enter: () => {
        clearTimeout(timer);
        // Promise continuations may run before an overdue timer after a busy turn.
        if (performance.now() >= deadline) { this.release(key, existing); reject(new SessionAdmissionError()); }
        else resolve(() => this.release(key, existing));
      } };
      const timer = setTimeout(() => {
        existing.waiting.delete(waiter); this.count--;
        reject(new SessionAdmissionError());
      }, this.limits.waitMs);
      existing.waiting.add(waiter);
    });
  }

  private release(key: string, lane: Lane) {
    this.count--;
    const next = lane.waiting.values().next().value;
    if (next) { lane.waiting.delete(next); next.enter(); }
    else this.lanes.delete(key);
  }
}
