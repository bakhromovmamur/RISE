import { WORKER_URL } from "./protocol";
let pending: Promise<ServiceWorkerRegistration> | undefined;
/** Notifications and the app shell deliberately share the existing root registration. */
export function registerAppWorker() {
  pending ??= navigator.serviceWorker.register(WORKER_URL, { scope: "/", updateViaCache: "none" }).catch(error => {
    pending = undefined;
    throw error;
  });
  return pending;
}
