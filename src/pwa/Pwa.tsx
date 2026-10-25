import { useSyncExternalStore } from "react";
import { ChevronRight, Smartphone } from "lucide-react";
import { useApp } from "../context";
import { Button } from "../components";
import { pwaSnapshot, subscribePwa, checkForUpdate, applyUpdate, installApp, protectStorage } from "./client";
import { pwaText } from "./messages";

export const usePwa = () => useSyncExternalStore(subscribePwa, pwaSnapshot);
const errorText = (error: ReturnType<typeof pwaSnapshot>["error"], text: ReturnType<typeof pwaText>) => error ? ({ offline: text.reconnect, blocked: text.blocked, update: text.updateError, install: text.installError, storage: text.storage })[error] : "";
export function PwaNotice() {
  const state = usePwa(), { state: app } = useApp(), text = pwaText(app.life.language);
  if (!state.enabled || (state.online && !state.waiting && !state.updating && !state.error)) return null;
  const error = errorText(state.error, text);
  return <div className="pwa-notice">
    <p role="status">{state.updating ? text.updating : error || (!state.online ? text.offline : state.waiting ? text.waiting : text.reconnect)}</p>
    {state.waiting && !state.updating && <Button variant="secondary" onClick={() => void applyUpdate()}>{text.update}</Button>}
  </div>;
}
export function PwaSettings() {
  const state = usePwa(), { state: app, close } = useApp(), text = pwaText(app.life.language);
  if (!state.enabled) return null;
  return <details className="settings-disclosure pwa-settings">
    <summary><Smartphone size={20} /><span><strong>{text.title}</strong><small>{text.detail}</small></span><ChevronRight size={18} /></summary>
    <p className="fine-print">{state.installed ? text.installed : text.guide}</p>
    {!state.installed && state.canInstall && <Button variant="secondary" onClick={() => void installApp()}>{text.install}</Button>}
    <p className="fine-print">{text.limits}</p>
    {state.error && <p role="alert" className="form-error">{errorText(state.error, text)}</p>}
    <p className="fine-print" role="status" data-offline-ready={state.offlineReady}>{state.offlineReady ? text.ready : text.preparing}</p>
    <div className="pwa-actions">
      <Button variant="secondary" disabled={state.checking || state.updating} onClick={() => void checkForUpdate()}>{state.checking ? text.checking : text.check}</Button>
      {state.waiting && <Button disabled={state.updating} onClick={() => {
        close();
        requestAnimationFrame(() => requestAnimationFrame(() => { void applyUpdate(); }));
      }}>{text.update}</Button>}
    </div>
    <p className="fine-print">{state.persistent ? text.persistent : text.storageInfo}</p>
    {!state.persistent && typeof navigator.storage?.persist === "function" && <Button variant="ghost" onClick={() => void protectStorage()}>{text.protect}</Button>}
  </details>;
}
