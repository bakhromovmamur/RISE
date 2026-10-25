import "./groups/groups.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startPwa, attachPwaSession } from "./pwa/client";
import "./pwa/pwa.css";
import type { ReviewSupport } from "./review/types";
import { startDeviceSession } from "./data/deviceSession";
import { StorageRecovery } from "./data/StorageNotice";
import { WorkspaceSession } from "./sync/workspace";
import {captureInvitation} from "./groups/invitation";
import "./styles.css";
import "./prayers.css";
import "./balanced.css";
import "./life.css";
import "./journey.css";
import "./you.css";
const root = createRoot(document.getElementById("root")!);
const invitation=import.meta.env.MODE==='review'?null:captureInvitation(location,history);
let starting = false;
async function start(review?: ReviewSupport) {
  if (starting) return;
  starting = true;
  try {
    const guest = await startDeviceSession(review?.initialState);
    const workspace=review?undefined:new WorkspaceSession(guest),storage=workspace??guest;
    if (!review) attachPwaSession(storage);
    root.render(<App review={review} storage={storage} workspace={workspace} invitation={invitation} />);
  } catch {
    root.render(<StorageRecovery retry={() => { void start(review); }} />);
  } finally { starting = false; }
}
if (import.meta.env.MODE === "review") {
  void import("./review/tools").then(async ({ assertReviewOrigin, reviewTools }) => {
    assertReviewOrigin(location.origin);
    if (new URLSearchParams(location.search).has("storage-test")) {
      const { installStorageHarness } = await import("./review/storageHarness");
      installStorageHarness();
      root.render(<p>Storage test harness ready.</p>);
      return;
    }
    void start(reviewTools);
  }).catch(() => {
    root.render(<p role="alert">This review build requires an isolated local origin. Use port 4174 for review, or build RISE for production.</p>);
  });
} else {
  startPwa();
  void start();
}
