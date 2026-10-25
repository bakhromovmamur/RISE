import type { DeviceSession } from "./deviceSession";
import type { SyncStatus } from "../sync/session";
/** The existing UI storage contract; each scope owns its persistence and recovery. */
export type JourneySession = Pick<DeviceSession,keyof DeviceSession> & { accountStatus?:()=>SyncStatus|null };
