import { useEffect, useRef, useState } from "react";
import { Button } from "../components";
import { useApp } from "../context";
import { backupText, type BackupMessage } from "./backupMessages";
import { downloadBackup, runBackupJob } from "./backupWorker";
import type { BackupSnapshot, RestorePreview } from "./backup";
import { DeviceStorageError, type RestorePoint } from "./indexedDb";
import type { LocalArchive } from "./backupProjection";
import type { Language } from "../i18n";
import { exportDeviceRecovery } from "./StorageNotice";

export function RawRecoveryDownload() {
  const { state } = useApp(), t = backupText(state.life.language);
  const [failed, setFailed] = useState(false), [busy, setBusy] = useState(false);
  return <div><p className="fine-print">{t("rawWarning")}</p>
    <Button variant="secondary" disabled={busy} onClick={async () => {
      setBusy(true); setFailed(false);
      try { await exportDeviceRecovery(); } catch { setFailed(true); } finally { setBusy(false); }
    }}>{t("rawDownload")}</Button>
    {failed && <p role="alert">{t("exportFailed")}</p>}
  </div>;
}

export async function exportSnapshot(snapshot: BackupSnapshot, signal: AbortSignal) {
  const raw = await runBackupJob({ kind: "export", snapshot }, signal);
  if (typeof raw !== "string") throw new Error("export-result");
  downloadBackup(raw);
}
function Archives({ archives, language }: { archives: LocalArchive[]; language: Language }) {
  const t = backupText(language);
  const [expanded, setExpanded] = useState(false);
  if (!archives.length) return null;
  return <details className="backup-archives" onToggle={event => { if (event.target === event.currentTarget) setExpanded(event.currentTarget.open); }}><summary>{t("archives")}</summary>
    {expanded && archives.map((archive, index) => archive.groups.map(group => <details key={`${index}:${group.id}`}>
      <summary>{group.name}</summary>
      <p>{group.members.map(member => member.name).join(" · ")}</p>
      {archive.tasks.filter(task => task.groupId === group.id).map(task => <section key={task.id}>
        <h3>{task.title}</h3><p>{task.notes}</p><p>{task.date} {task.time}</p>
        {Object.entries(task.completions).map(([date, completion]) => <p key={date}>✓ {date} · {group.members.find(m => m.id === completion.by)?.name ?? completion.by}</p>)}
      </section>)}
      {archive.lists.filter(list => list.groupId === group.id).map(list => <section key={list.id}><h3>{list.name}</h3>
        <ul>{list.items.map(item => <li key={item.id}>{item.checked ? "✓ " : ""}{item.text} {item.quantity}</li>)}</ul>
      </section>)}
      {archive.updates.filter(update => update.groupId === group.id).map(update => <section key={update.id}>
        <h3>{group.members.find(m => m.id === update.memberId)?.name ?? update.memberId} · {update.week}</h3><p>{update.note}</p>
        {update.habits !== undefined && <p>{t("habitChecks")}: {update.habits}</p>}
        {update.milestones?.map((milestone, i) => <p key={i}>{milestone}</p>)}
        {update.prayers !== undefined && <p>{t("prayerChecks")}: {update.prayers}</p>}
        {Object.entries(update.reactions).map(([id, reaction]) => <p key={id}>{group.members.find(m => m.id === id)?.name ?? id}: {reaction}</p>)}
      </section>)}
    </details>))}
  </details>;
}

export function BackupScreen() {
  const { storage, state } = useApp(), language = state.life.language, t = backupText(language);
  const [preview, setPreview] = useState<RestorePreview | null>(null), [point, setPoint] = useState<RestorePoint | null>(null);
  const [phase, setPhase] = useState<BackupMessage | null>(null), [error, setError] = useState<BackupMessage | null>(null);
  const [confirmed, setConfirmed] = useState(false), [success, setSuccess] = useState(false), [recoveryId, setRecoveryId] = useState<string | undefined>();
  const operation = useRef(crypto.randomUUID()), job = useRef<AbortController | null>(null), input = useRef<HTMLInputElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void storage.restorePoint().then(value => { if (mounted.current) setPoint(value); }).catch(() => { if (mounted.current) setError("recoveryFailed"); });
    return () => { mounted.current = false; job.current?.abort(); };
  }, [storage]);
  useEffect(() => { if (preview) { heading.current?.focus(); heading.current?.scrollIntoView({ block: "start" }); } }, [preview]);
  const cancel = () => {
    job.current?.abort(); job.current = null; setPhase(null); setPreview(null); setConfirmed(false); setError(null);
    if (input.current) { input.current.value = ""; input.current.focus(); }
  };
  const load = async (file?: File, previous?: RestorePoint) => {
    job.current?.abort();
    const controller = new AbortController(); job.current = controller;
    setPreview(null); setConfirmed(false); setSuccess(false); setError(null); setPhase("reading");
    try {
      const snapshot = await storage.snapshot();
      let source: Blob;
      if (previous) {
        const raw = await runBackupJob({ kind: "export", snapshot: { state: previous.previous.state, archives: previous.previous.archives ?? [], revision: previous.previous.revision } }, controller.signal);
        if (typeof raw !== "string") throw new Error("export-result");
        source = new Blob([raw]);
      } else { if (!file) return; source = file; }
      const result = await runBackupJob({ kind: "preview", file: source, snapshot }, controller.signal, setPhase);
      if (typeof result === "string") throw new Error("preview-result");
      if (controller.signal.aborted) return;
      setRecoveryId(previous?.id); setPreview(previous ? { ...result, source: "recovery" } : result); operation.current = crypto.randomUUID();
    } catch { if (!controller.signal.aborted) setError("failed"); }
    finally { if (!controller.signal.aborted) { setPhase(null); job.current = null; } }
  };
  const commit = async () => {
    if (!preview || !confirmed || phase) return;
    setPhase("committing"); setError(null);
    try {
      await storage.restore(preview, operation.current, recoveryId);
      if (mounted.current) { setPreview(null); setConfirmed(false); setSuccess(true); if (input.current) input.current.value = ""; }
    } catch (reason) {
      if (mounted.current) {
        const conflict = reason instanceof DeviceStorageError && ["conflict", "legacy-changed"].includes(reason.code);
        setError(conflict ? "conflict" : "saveFailed");
        if (conflict) { setPreview(null); setConfirmed(false); }
      }
      return;
    } finally { if (mounted.current) setPhase(null); }
    // A failed recovery-point read after commit must not be reported as a failed restore.
    try { const savedPoint = await storage.restorePoint(); if (mounted.current) setPoint(savedPoint); }
    catch { if (mounted.current) setError("recoveryFailed"); }
  };
  const downloadPrevious = async () => {
    if (!point || phase) return;
    const controller = new AbortController(); job.current = controller; setPhase("exporting"); setError(null);
    try { await exportSnapshot({ state: point.previous.state, archives: point.previous.archives ?? [], revision: point.previous.revision }, controller.signal); }
    catch { if (!controller.signal.aborted) setError("exportFailed"); }
    finally { if (!controller.signal.aborted) { job.current = null; setPhase(null); } }
  };
  return <div className="life-screen backup-screen">
    <p className="fine-print">{t("warning")}</p>
    <p className="fine-print">{t("supported")}</p>
    <label className="field">{t("choose")}<input ref={input} type="file" accept=".json,application/json" disabled={phase !== null} onChange={event => { const file = event.target.files?.[0]; if (file) void load(file); }} /></label>
    <p className="fine-print">{t("limits")}</p>
    {phase && <p role="status">{t(phase)}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {(error === "exportFailed" || error === "recoveryFailed") && <RawRecoveryDownload />}
    {success && <p role="status">{t("success")}</p>}
    {phase && phase !== "committing" && <Button variant="ghost" onClick={cancel}>{t("cancel")}</Button>}
    {preview && <section aria-labelledby="restore-preview-title">
      <h2 id="restore-preview-title" ref={heading} tabIndex={-1}>{t("preview")}</h2>
      <p>{t(preview.source === "recovery" ? "undoNote" : "replaceNote")}</p>
      {preview.accountExport&&<p className="fine-print">{t("accountExport")}</p>}
      <dl className="backup-counts">
        <dt>{t("exportedAt")}</dt><dd>{preview.exportedAt ?? t("legacy")}</dd>
        <dt>{t("dateRange")}</dt><dd>{preview.dates.first ? `${preview.dates.first} – ${preview.dates.last}` : t("noDates")}</dd>
        <dt>{t("timezone")}</dt><dd>{preview.content.personal.timezone}</dd>
        {Object.entries(preview.counts).map(([key, count]) => <div key={key}><dt>{t(key as keyof typeof preview.counts)}</dt><dd>{count}</dd></div>)}
        {Object.entries(preview.changes).map(([key, count]) => <div key={key}><dt>{t(key as keyof typeof preview.changes)}</dt><dd>{count}</dd></div>)}
        <dt>{t("xp")}</dt><dd>{preview.xp} / {preview.currentXp}</dd>
      </dl>
      <p className="fine-print">{t(preview.source === "legacy" ? "legacy" : "checksum")}</p>
      {preview.source !== "recovery" && <p>{t("archiveNote")}</p>}
      {preview.filtered && <p className="fine-print">{t("filtered")}</p>}
      {preview.summary.provenance === "demo-or-mixed" && <p className="fine-print">{t("sample")}</p>}
      <Archives archives={preview.content.localArchives} language={language} />
      <label className="check-choice"><input type="checkbox" checked={confirmed} disabled={phase !== null} onChange={event => setConfirmed(event.target.checked)} /><span>{t("confirm")}</span></label>
      <Button className="wide" disabled={!confirmed || phase !== null} onClick={() => void commit()}>{t("restore")}</Button>
      <Button className="wide" variant="ghost" disabled={phase === "committing"} onClick={cancel}>{t("cancel")}</Button>
    </section>}
    {point && !preview && <section>
      <h2>{t("previous")}</h2><p>{point.createdAt}</p><p className="fine-print">{t("retention")}</p>
      <Button className="wide" variant="secondary" disabled={phase !== null} onClick={() => void load(undefined, point)}>{t("undo")}</Button>
      <Button className="wide" variant="ghost" disabled={phase !== null} onClick={() => void downloadPrevious()}>{t("downloadPrevious")}</Button>
    </section>}
    {!preview && <Archives archives={storage.archives} language={language} />}
  </div>;
}
