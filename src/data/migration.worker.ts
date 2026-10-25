import { prepareProfile } from "./migration";
import { parseStoredState } from "./storedState";

self.onmessage = async (event: MessageEvent<{ raw: string | null; initial: string }>) => {
  try {
    const result = await prepareProfile(event.data.raw, parseStoredState(event.data.initial));
    self.postMessage({ ok: true, result });
  } catch {
    // Never emit user-authored content or field paths into logs/telemetry.
    self.postMessage({ ok: false });
  }
};
