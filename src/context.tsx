import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { State, Check } from "./model";
import type { PrayerId } from "./prayerModel";
import type { ProgressView } from "./developmentModel";
import type { JourneySession } from "./data/journeySession";
import type { WorkspaceSession } from "./sync/workspace";
export type Screen = {
  type:
    | "detail"
    | "edit"
    | "manage"
    | "milestone"
    | "collection"
    | "settings"
    | "backup"
    | "account"
    | "backgroundNotifications"
    | "reflection"
    | "history"
    | "streak"
    | "info"
    | "timer"
    | "archive"
    | "clear"
    | "reminder"
    | "prayer"
    | "timetable"
    | "fajr"
    | "wake"
    | "workBreak"
    | "prayerRules"
    | "habitsToday"
    | "habitProgress"
    | "priorities"
    | "goal"
    | "goalEdit"
    | "personalRewards"
    | "reward"
    | "rewardEdit"
    | "habitCorrection"
    | "prayerPreferences" | "prayerSetup" | "prayerReminders" | "prayerNudge" | "readiness" | "period"
    | "groups" | "group" | "groupCreate" | "groupSettings" | "invite" | "groupJoin"
    | "task" | "taskEdit" | "sharedList" | "listCreate" | "squadCompose" | "language";
  prayer?: PrayerId;
  id?: string;
  xp?: number;
  date?: string;
  title?: string;
  text?: string;
  celebrate?: boolean;
  groupId?: string;
  occurrenceDate?: string;
  kind?: "family" | "squad";
  section?: "tasks" | "lists";
  preview?: "prepare" | "due";
  live?: boolean;
};
export type Tab = "today" | "journey" | "progress" | "you";
export interface AppContextType {
  state: State;
  dispatch: JourneySession["dispatch"];
  setState: Dispatch<SetStateAction<State>>;
  clearLocalData: (state: State) => Promise<boolean>;
  storage: JourneySession;
  workspace?: WorkspaceSession;
  open: (screen: Screen) => void;
  close: () => void;
  back: () => void;
  log: (id: string, kind: Check | null, finishTimer?: boolean) => void;
  toast: (text: string) => void;
  setTab: (tab: Tab) => void;
  progressView: ProgressView;
  setProgressView: (view: ProgressView) => void;
}
export const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);
