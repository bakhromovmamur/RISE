import { PWA_CONTRACT } from '../pwa/protocol';
const pick=(value:unknown,allowed:readonly string[],fallback='unknown')=>typeof value==='string'&&allowed.includes(value)?value:fallback;
const errors=['conflict','save','legacy-changed','invalid-edit','storage','invalid_edit','recovery_required','group_pending','unauthorized','network','unavailable','revision_conflict','session_expired'] as const;
/** Accept status primitives only. Never serialize State, error messages, URLs or identities. */
export function diagnosticReport(input:{release:unknown;storageStatus:unknown;storageError:unknown;syncPhase:unknown;syncError:unknown;pending:boolean;persistent:boolean;online:boolean;worker:boolean},now=new Date()){
  return {format:'rise-diagnostics',version:1,createdAt:now.toISOString(),release:typeof input.release==='string'&&/^[a-f0-9]{20}$/.test(input.release)?input.release:'unavailable',storageContract:PWA_CONTRACT,
    storageStatus:pick(input.storageStatus,['saved','saving','attention']),storageError:input.storageError===null?null:pick(input.storageError,errors),
    syncPhase:pick(input.syncPhase,['saving-device','saved-device','syncing','synced','offline','attention','sign-in','guest']),syncError:input.syncError===null?null:pick(input.syncError,errors),
    pendingChanges:input.pending===true||input.storageStatus!=='saved'||input.storageError!==null,persistentStorage:input.persistent===true,online:input.online===true,serviceWorkerControlled:input.worker===true};
}
