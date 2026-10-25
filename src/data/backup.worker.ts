import { createBackup, previewRestore, type BackupSnapshot, type RestorePreview } from "./backup";
import { MAX_BYTES } from "./validation";

export type BackupJob = { kind: "export"; snapshot: BackupSnapshot } | { kind: "preview"; file: Blob; snapshot: BackupSnapshot };
export type BackupReply = { phase: "reading" | "validating" } | { result: string | RestorePreview } | { error: true };
self.onmessage = async (event: MessageEvent<BackupJob>) => {
  try {
    const job = event.data;
    if (job.kind === "export") {
      self.postMessage({ phase: "validating" } satisfies BackupReply);
      self.postMessage({ result: await createBackup(job.snapshot) } satisfies BackupReply);
    } else {
      if (job.file.size > MAX_BYTES) throw new Error("size");
      self.postMessage({ phase: "reading" } satisfies BackupReply);
      const raw = new TextDecoder("utf-8", { fatal: true }).decode(await job.file.arrayBuffer());
      self.postMessage({ phase: "validating" } satisfies BackupReply);
      self.postMessage({ result: await previewRestore(raw, job.snapshot) } satisfies BackupReply);
    }
  } catch { self.postMessage({ error: true } satisfies BackupReply); }
};
