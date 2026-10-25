import { parseCommand, type DomainCommand } from "./commands";
import { exact } from "./personalCommands";
import * as v from "../data/validation";

export interface InitializeAccount { kind: "account.initialize"; name: string; timezone: string; language: "en" | "uz" | "ru" }
export type CoverageCommand = Omit<Extract<DomainCommand, { kind: "prayer.timetable" }>, "kind"> & { kind: "prayer.coverage" };
export type AccountCommand = DomainCommand | InitializeAccount | CoverageCommand | { kind: "account.timezone"; timezone: string };
export interface AccountOperation { protocolVersion: 1; operationId: string; baseRevision: number; command: AccountCommand }
export interface AccountReceipt { operationId: string; operationRevision: number; xp: number; replayed: boolean }
export const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
const invalid = (): never => { throw new v.StoredDataError("account-command"); };
const deviceOnly = new Set([
  "habit.draft", "draft.save", "draft.clear", "timer.start", "timer.pause", "timer.resume", "timer.end", "timer.complete",
  "prayer.sample-setup", "prayer.calculated-setup", "prayer.location-reviewed", "fajr.alarm", "delivery.preferences", "readiness.preview", "work.wrap",
]);
function identifiers(value: unknown, field = "") {
  if (["id", "newId", "habitId", "goalId", "milestoneId", "rewardId", "pauseId", "taskId", "groupId"].includes(field) && !uuid(value)) invalid();
  if (field === "habitIds" && (!Array.isArray(value) || value.some(id => !uuid(id)))) invalid();
  if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) identifiers(child, key);
}
/** An account intent is not a legacy profile/receipt upload. Actor and time come from the server. */
export function parseAccountOperation(value: unknown): AccountOperation {
  v.validateJson(value);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 64 * 1024) invalid();
  const row = v.object(value, "operation");
  exact({ protocolVersion: v.oneOf(1), operationId: v.string(36), baseRevision: v.number(0, Number.MAX_SAFE_INTEGER, true), command: v.validateJson })(row, "operation");
  const operationId = row.operationId;
  if (!uuid(operationId)) return invalid();
  const input = v.object(row.command, "command");
  if (input.kind === "account.timezone") {
    exact({ kind: v.oneOf("account.timezone"), timezone: v.zone })(input, "timezone");
    return { protocolVersion: 1, operationId, baseRevision: Number(row.baseRevision), command: { kind: "account.timezone", timezone: String(input.timezone) } };
  }
  if (input.kind === "account.initialize") {
    exact({ kind: v.oneOf("account.initialize"), name: v.string(80), timezone: v.zone, language: v.oneOf("en", "uz", "ru") })(input, "initialize");
    return { protocolVersion: 1, operationId, baseRevision: Number(row.baseRevision), command: { kind: "account.initialize", name: String(input.name), timezone: String(input.timezone), language: input.language === "uz" ? "uz" : input.language === "ru" ? "ru" : "en" } };
  }
  const command = parseCommand(input.kind === "prayer.coverage" ? { ...input, kind: "prayer.timetable" } : input); identifiers(command);
  if (deviceOnly.has(command.kind)) invalid();
  if (command.kind === "calendar.refresh" && command.deviceTimezone !== undefined) invalid();
  if (command.kind === "priorities.set" && command.priorities.some(p => p.kind === "task"&&!p.groupId) || command.kind === "priority.pin" && command.priority.kind === "task"&&!command.priority.groupId) invalid();
  if (command.kind === "prayer.timetable") {
    if (command.day.sample || command.day.calculationKey !== undefined) invalid();
    if (Object.values(command.day.entries).some(entry => entry.check !== undefined || entry.performedAt !== undefined || entry.recordedAt !== undefined)) invalid();
  }
  return { protocolVersion: 1, operationId, baseRevision: Number(row.baseRevision), command: input.kind === "prayer.coverage" && command.kind === "prayer.timetable" ? { ...command, kind: "prayer.coverage" } : command };
}
