// One root worker owns public offline assets and notification routing. No private data is cached.
// Vite injects a verified public asset list only for production builds.
const BUILD = /* RISE_BUILD */ null;
const PREFIX = "rise-public-v1-";
const cacheName = BUILD ? PREFIX + BUILD.release : null;
const origin = self.location.origin;
const assets = new Map((BUILD?.assets ?? []).map(asset => [asset.url, asset]));
let updating = false;
let pruning = null;

async function verifiedResponse(asset) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(asset.url, { cache: "reload", credentials: "omit", redirect: "error", signal: controller.signal });
    if (!response.ok || response.status !== 200 || response.redirected) throw new Error("Public asset unavailable");
    const bytes = await response.clone().arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (hash !== asset.sha256) throw new Error("Public asset integrity failed");
    return response;
  } finally { clearTimeout(timer); }
}
self.addEventListener("install", event => {
  if (!BUILD) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName);
      // All required chunks, including migration/backup workers, must be available before installation succeeds.
      await Promise.all([...assets.values()].map(async asset => cache.put(asset.url, await verifiedResponse(asset))));
    } catch (error) { await caches.delete(cacheName); throw error; }
    // Updates remain waiting. An explicit, coordinated request may activate them.
  })());
});
const windows = () => self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => clients.filter(client => {
  const url = new URL(client.url);
  return url.origin === origin;
}));
function ask(client, message, timeout = 6000) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, timeout);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    try { client.postMessage(message, [channel.port2]); }
    catch { clearTimeout(timer); channel.port1.close(); resolve(null); }
  });
}
async function prune() {
  if (!BUILD) return;
  const clients = await windows();
  const replies = await Promise.all(clients.map(client => ask(client, { type: "RISE_CLIENT_STATUS" })));
  // Unknown/old clients may still import old chunks; never delete their assets speculatively.
  if (replies.some(reply => !reply || typeof reply.release !== "string")) return;
  const keys = (await caches.keys()).filter(key => key.startsWith(PREFIX));
  const keep = new Set([cacheName, ...replies.map(reply => PREFIX + reply.release), ...keys.filter(key => key !== cacheName).slice(-1)]);
  await Promise.all(keys.filter(key => !keep.has(key)).map(key => caches.delete(key)));
}
function pruneOnce() {
  pruning ??= prune().finally(() => { pruning = null; });
  return pruning;
}
self.addEventListener("activate", event => {
  event.waitUntil((async () => { await self.clients.claim(); await pruneOnce(); })());
});
self.addEventListener("fetch", event => {
  if (!BUILD || event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== origin) return;
  const shell = event.request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html");
  const path = shell ? "/index.html" : url.pathname;
  // Private/API/auth/logout responses, cross-origin requests and mutations always bypass Cache Storage.
  if (!shell && url.search) return;
  if (!assets.has(path)) {
    // Retained immutable chunks may still be requested by a tab loaded just before activation.
    if (!/^\/assets\/[\w.-]+-[\w-]{8}\.(js|css)$/.test(path)) return;
    event.respondWith((async () => {
      for (const key of (await caches.keys()).filter(key => key.startsWith(PREFIX))) {
        const hit = await (await caches.open(key)).match(path);
        if (hit) return hit;
      }
      return fetch(event.request);
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(path);
    if (hit) return hit;
    try {
      const response = await verifiedResponse(assets.get(path));
      await cache.put(path, response.clone());
      return response;
    } catch {
      return new Response(shell ? "RISE is unavailable offline. Reconnect and reopen. / RISE недоступен без сети. Подключитесь и откройте снова. / RISE oflayn ochilmadi. Internetga ulanib, qayta oching." : "Offline asset unavailable", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  })());
});
async function ready() {
  if (!BUILD) return false;
  const cache = await caches.open(cacheName);
  return (await Promise.all([...assets.keys()].map(path => cache.match(path)))).every(Boolean);
}
self.addEventListener("message", event => {
  if (!event.source || !event.ports[0]) return;
  let url;
  try { url = new URL(event.source.url); } catch { return; }
  if (url.origin !== origin) return;
  const data = event.data, port = event.ports[0];
  if (data?.type === "RISE_STATUS") {
    event.waitUntil(ready().then(offlineReady => port.postMessage({ release: BUILD?.release, contract: BUILD?.contract, offlineReady })));
  } else if (data?.type === "RISE_PRUNE") {
    event.waitUntil(pruneOnce().then(() => port.postMessage({ ok: true })));
  } else if (data?.type === "RISE_APPLY_UPDATE" && BUILD && typeof data.token === "string" && /^[\w-]{1,80}$/.test(data.token)) {
    event.waitUntil((async () => {
      if (updating) { port.postMessage({ ok: false }); return; }
      updating = true;
      const token = data.token;
      let clients = [];
      try {
        clients = await windows();
        const replies = await Promise.all(clients.map(client => ask(client, { type: "RISE_PREPARE_UPDATE", token, contract: BUILD.contract })));
        const latest = await windows();
        const sameClients = latest.length === clients.length && latest.every(client => clients.some(old => old.id === client.id));
        if (!sameClients || replies.some(reply => reply?.ok !== true || reply.token !== token || reply.contract !== BUILD.contract) || !await ready()) throw new Error("Open tab not ready");
        await self.skipWaiting();
        port.postMessage({ ok: true });
      } catch {
        for (const client of clients) client.postMessage({ type: "RISE_RELEASE_UPDATE", token });
        port.postMessage({ ok: false });
      } finally { updating = false; }
    })());
  }
});

// PUSH-01 owns a separate consent record. No endpoint, credential or personal
// journey is stored here. Keep database/store/key compatible with push/store.ts.
function pushDevice(change) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rise-push-device", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("control");
    request.onerror = () => reject(new Error("push_storage_failed"));
    request.onblocked = () => reject(new Error("push_storage_blocked"));
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("control", change ? "readwrite" : "readonly"), store = tx.objectStore("control"), read = store.get("current");
      let result = null;
      read.onsuccess = () => { result = read.result ?? null; if (change && result) { result = change(result); store.put(result, "current"); } };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(new Error("push_storage_failed")); };
    };
  });
}
const pushUUID = value => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
// Matches src/push/ledger.ts. A readwrite transaction serializes page/worker claims.
async function claimReminder(owner,event,at,expiresAt){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("rise-alert-ledger",1);r.onupgradeneeded=()=>r.result.createObjectStore("events");r.onsuccess=()=>resolve(r.result);r.onerror=r.onblocked=()=>reject(new Error("alert_ledger_unavailable"));});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction("events","readwrite"),store=tx.objectStore("events"),key=`${owner}:${event}:${at}`,r=store.get(key);let claimed=false;r.onsuccess=()=>{if(!r.result&&Date.now()>=at&&Date.now()<expiresAt){store.put({owner,expiresAt},key);claimed=true;}};const cursor=store.openCursor();cursor.onsuccess=()=>{const item=cursor.result;if(item){if(item.value.expiresAt<Date.now()-86400000)item.delete();item.continue();}};tx.oncomplete=()=>resolve(claimed);tx.onerror=tx.onabort=()=>reject(new Error("alert_ledger_unavailable"));});}finally{db.close();}
}
function reminderControlValid(control){return !!control && (control.planBlocked===undefined||typeof control.planBlocked==="boolean")
 && (control.blockedEvents===undefined||Array.isArray(control.blockedEvents)&&control.blockedEvents.length<=84&&control.blockedEvents.every(pushUUID))
 && (control.cancelRequest===undefined||control.cancelRequest&&pushUUID(control.cancelRequest.id)&&typeof control.cancelRequest.pending==="boolean");}
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload, control;
    try { payload = event.data?.json(); control = await pushDevice(); } catch { /* Unknown/late messages get generic visible copy, never private content. */ }
    const now = Date.now(), expiry = typeof payload?.expiresAt === "string" ? Date.parse(payload.expiresAt) : NaN;
    const reminder=payload?.type==="reminder",groupNotice=payload?.type==="group",at=typeof payload?.eventAt==="string"?Date.parse(payload.eventAt):NaN;
    let valid = payload && Object.keys(payload).every(k => ["version", "type", "id", "owner", "installation", "generation", "expiresAt", "language", ...(reminder?["eventAt","planGeneration"]:groupNotice?["eventAt"]:[])].includes(k))
      && payload.version === 1 && (payload.type === "test"||reminder||groupNotice) && pushUUID(payload.id) && pushUUID(payload.owner) && pushUUID(payload.installation)
      && Number.isSafeInteger(payload.generation) && payload.generation > 0 && ["en", "ru", "uz"].includes(payload.language)
      && expiry > now && expiry <= now + 120000 && control?.enabled === true && control.owner === payload.owner
      && control.installation === payload.installation && control.generation === payload.generation;
    if(reminder){valid=valid&&reminderControlValid(control)&&Number.isSafeInteger(payload.planGeneration)&&payload.planGeneration>0&&!control.planBlocked&&!control.cancelRequest?.pending&&!control.blockedEvents?.includes(payload.id)&&at<=now&&expiry<=at+120000;
      if(valid)try{
        const query=new URLSearchParams(Object.fromEntries(["owner","installation","id","generation","planGeneration","eventAt","expiresAt"].map(k=>[k,String(payload[k])])));
        const response=await fetch(`/api/v1/push/reminder?${query}`,{credentials:"same-origin",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)});
        const decision=response.ok?await response.json():null;
        valid=decision?.valid===true&&Object.keys(decision).length===1&&Date.now()<expiry;
      }catch{valid=false;}
      if(valid)try{valid=await claimReminder(payload.owner,payload.id,at,expiry);}catch{valid=false;}
      if(valid){const latest=await pushDevice();valid=reminderControlValid(latest)&&latest?.enabled&&latest.owner===payload.owner&&latest.generation===payload.generation&&latest.installation===payload.installation&&!latest.planBlocked&&!latest.cancelRequest?.pending&&!latest.blockedEvents?.includes(payload.id)&&Date.now()<expiry;}
    }
    if(groupNotice){valid=valid&&at<=now&&expiry<=at+120000;
      if(valid)try{
        const query=new URLSearchParams(Object.fromEntries(["owner","installation","id","generation","eventAt","expiresAt"].map(k=>[k,String(payload[k])])));
        const response=await fetch(`/api/v1/push/group?${query}`,{credentials:"same-origin",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)});
        const decision=response.ok?await response.json():null;
        valid=decision?.valid===true&&Object.keys(decision).length===1&&Date.now()<expiry;
      }catch{valid=false;}
      if(valid)try{valid=await claimReminder(payload.owner,payload.id,at,expiry);}catch{valid=false;}
      if(valid){const latest=await pushDevice();valid=latest?.enabled===true&&latest.owner===payload.owner&&latest.installation===payload.installation&&latest.generation===payload.generation&&Date.now()<expiry;}
    }
    const language = valid ? payload.language : control?.language;
    const body = valid&&groupNotice ? language === "ru" ? "Откройте RISE, чтобы посмотреть обновление группы." : language === "uz" ? "Guruh yangiligini ko‘rish uchun RISE’ni oching." : "Open RISE to view a group update." : valid&&reminder ? language === "ru" ? "Откройте RISE, чтобы посмотреть напоминание." : language === "uz" ? "Eslatmani ko‘rish uchun RISE’ni oching." : "Open RISE to view your reminder." : valid ? language === "ru" ? "Тест RISE. Молитва не записана." : language === "uz" ? "RISE sinovi. Namoz qayd etilmadi." : "RISE test. No prayer was recorded."
      : language === "ru" ? "Откройте RISE, чтобы проверить настройки уведомлений." : language === "uz" ? "Bildirishnoma sozlamalarini tekshirish uchun RISE’ni oching." : "Open RISE to review notification settings.";
    // A visible generic fallback respects userVisibleOnly even after cancellation
    // races. It contains no account name, prayer status, route or private history.
    await self.registration.showNotification("RISE", { body, tag: valid&&groupNotice ? `rise-group:${payload.owner}:${payload.id}:${at}` : valid&&reminder ? `rise-reminder:${payload.owner}:${payload.id}:${at}` : valid ? `rise-push-test:${payload.id}` : "rise-push-settings", silent: !valid,
      data: valid&&groupNotice ? { pushGroup: payload.id, scope: payload.owner } : valid&&reminder ? { pushReminder: payload.id, scope: payload.owner } : valid ? { pushTest: payload.id, scope: payload.owner } : { pushTest: true } });
    if (valid&&!reminder&&!groupNotice) await pushDevice(latest => latest.enabled && latest.owner === payload.owner && latest.installation === payload.installation && latest.generation === payload.generation
      ? { ...latest, revision: latest.revision + 1, lastTest: { id: payload.id, at: Date.now() } } : latest);
    for (const client of await windows()) client.postMessage({ type: "RISE_PUSH_CHANGED" });
  })());
});
self.addEventListener("pushsubscriptionchange", event => {
  // Rotation/expiry is never consent to upload a replacement subscription.
  event.waitUntil((async () => { await pushDevice(control => ({ ...control, revision: control.revision + 1, enabled: false, details: false, pending: true, lastTest: null })); for (const client of await windows()) client.postMessage({ type: "RISE_PUSH_CHANGED" }); })());
});

// Notification clicks never record a prayer or wake acknowledgment.
function validAlert(alert) {
  return alert && typeof alert === "object" && typeof alert.id === "number" && Number.isSafeInteger(alert.id)
    && typeof alert.key === "string" && alert.key.length <= 200 && /^\d{4}-\d{2}-\d{2}$/.test(alert.date)
    && ["fajr", "dhuhr", "asr", "maghrib", "isha"].includes(alert.prayer)
    && ["prepare", "due", "wake", "backup"].includes(alert.kind)
    && Number.isFinite(alert.at) && Number.isFinite(alert.expiresAt) && alert.at <= Date.now() && alert.expiresAt > Date.now();
}
self.addEventListener("notificationclick", event => {
  event.notification.close();
  if(event.notification.data?.pushTest||event.notification.data?.pushReminder||event.notification.data?.pushGroup){event.waitUntil((async()=>{const client=(await windows())[0];if(client)await client.focus();else await self.clients.openWindow("/");})());return;}
  const alert = event.notification.data?.alert;
  const test = event.notification.tag === "rise-test" && alert === undefined;
  if (!test && !validAlert(alert)) return;
  event.waitUntil((async () => {
    const clients = await windows();
    const client = clients[0];
    if (client) {
      await client.focus();
      const scope=event.notification.data?.scope;
      if (!test) client.postMessage({ type: "rise-alert", scope:typeof scope==="string"&&/^(guest|[a-f0-9-]{36})$/.test(scope)?scope:"guest", alert: { id: alert.id, key: alert.key, date: alert.date, prayer: alert.prayer, kind: alert.kind, at: alert.at, expiresAt: alert.expiresAt } });
    }
    else await self.clients.openWindow("/");
  })());
});
