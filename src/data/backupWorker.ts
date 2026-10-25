import type { BackupJob, BackupReply } from "./backup.worker";
import type { RestorePreview } from "./backup";

export function runBackupJob(job: BackupJob, signal: AbortSignal, progress: (phase: "reading" | "validating") => void = () => {}) {
  return new Promise<string | RestorePreview>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Canceled", "AbortError")); return; }
    const worker = new Worker(new URL("./backup.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { worker.terminate(); signal.removeEventListener("abort", cancel); };
    const cancel = () => { finish(); reject(new DOMException("Canceled", "AbortError")); };
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<BackupReply>) => {
      const reply = event.data;
      if ("phase" in reply) { progress(reply.phase); return; }
      finish(); if ("result" in reply) resolve(reply.result); else reject(new Error("invalid-backup"));
    };
    worker.onerror = () => { finish(); reject(new Error("backup-worker")); };
    try { worker.postMessage(job); } catch (error) { finish(); reject(error); }
  });
}
export function downloadBackup(raw: string, filename = `rise-backup-${new Date().toISOString().slice(0, 10)}.json`) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
