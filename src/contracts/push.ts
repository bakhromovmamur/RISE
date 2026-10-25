/** Installation metadata only. Endpoints and browser encryption keys never return from the API. */
export interface PushSubscriptionInput { endpoint:string; expirationTime:number|null; keys:{p256dh:string;auth:string} }
export interface PushInstallation { id:string; version:number; enabled:boolean; details:boolean; language:"en"|"ru"|"uz"; needsReview:boolean }
export interface PushTest { id:string; status:"queued"|"accepted"|"failed"|"retired"|"canceled"|"expired"; expiresAt:string }
export interface PushView { configured:boolean; publicKey:string|null; installation:PushInstallation|null; test:PushTest|null }
export const pushObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export const pushUUID=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
export const pushOnly=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
export function parsePushView(v:unknown):PushView{
  if(!pushObject(v)||!pushOnly(v,["configured","publicKey","installation","test"])||typeof v.configured!=="boolean"||!(v.publicKey===null||typeof v.publicKey==="string"&&/^[\w-]{87}$/.test(v.publicKey)))throw new Error("invalid_push_view");
  const s=v.installation,t=v.test;
  if(s!==null&&(!pushObject(s)||!pushOnly(s,["id","version","enabled","details","language","needsReview"])||!pushUUID(s.id)||!Number.isSafeInteger(s.version)||Number(s.version)<1||typeof s.enabled!=="boolean"||typeof s.details!=="boolean"||typeof s.needsReview!=="boolean"||typeof s.language!=="string"||!["en","ru","uz"].includes(s.language)))throw new Error("invalid_push_view");
  if(t!==null&&(!pushObject(t)||!pushOnly(t,["id","status","expiresAt"])||!pushUUID(t.id)||typeof t.status!=="string"||!["queued","accepted","failed","retired","canceled","expired"].includes(t.status)||typeof t.expiresAt!=="string"||!Number.isFinite(Date.parse(t.expiresAt))))throw new Error("invalid_push_view");
  return v as unknown as PushView;
}
