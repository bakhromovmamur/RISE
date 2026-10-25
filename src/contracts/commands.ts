import { isPrayerCommand, parsePrayerCommand, type PrayerCommand } from "./prayerCommands";
import { parsePersonalCommand, parseContext, type PersonalCommand, type CommandContext } from "./personalCommands";
import { StoredDataError, id as storedId } from "../data/validation";
import type { Check } from "../model";
import type { Priority } from "../developmentModel";
import type { PrayerCheck, PrayerId } from "../prayerModel";

/** Validated personal intents. Shared simulation writes remain a separate compatibility path. */
export type DomainCommand = PersonalCommand | PrayerCommand
  | { kind: "habit.check" | "habit.correct"; habitId: string; date: string; check: Check | null }
  | { kind: "habit.archive"; habitId: string }
  | { kind: "priorities.set"; date: string; priorities: Priority[] }
  | { kind: "goal.milestone"; goalId: string; milestoneId: string; completed: boolean }
  | { kind: "goal.status"; goalId: string; status: "active" | "paused" | "archived" }
  | { kind: "reward.enjoy"; rewardId: string }
  | { kind: "prayer.record"; date: string; prayer: PrayerId; check: PrayerCheck | null; returnToWork?: "if-recorded" | "always" }
  | { kind: "prayer.pause"; pauseId: string; date: string; prayer: PrayerId }
  | { kind: "prayer.resume"; date: string; prayer: PrayerId; includeCurrent: boolean }
  | { kind: "fajr.acknowledge"; date: string };

export interface LocalOperation {
  protocolVersion: 1;
  operationId: string;
  baseRevision: number;
  command: DomainCommand;
  context?: CommandContext; // Older local receipts predate captured action time.
}
export class CommandValidationError extends Error {
  constructor(readonly field: string) {
    super(`Invalid command field: ${field}`);
    this.name = "CommandValidationError";
  }
}
const invalid = (field: string): never => { throw new CommandValidationError(field); };
const forbidden = new Set(["__proto__", "prototype", "constructor"]);

/** Reject non-JSON objects, accessors, cycles, deep/large input and pollution keys before reading fields. */
function boundedJson(value: unknown, depth = 0): void {
  if (depth > 20) invalid("depth");
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || value === null) return invalid("json");
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (value.length > 1000 || prototype !== Array.prototype) invalid("array");
  } else if (prototype !== Object.prototype && prototype !== null) invalid("object");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || forbidden.has(key)) invalid("key");
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.hasOwn(descriptor, "value")) invalid("accessor");
    boundedJson(descriptor.value, depth + 1);
  }
}
function checkSize(value: unknown) {
  boundedJson(value);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 64 * 1024) invalid("size");
}
function fields(value: unknown, names: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("object");
  if (Object.keys(value).some(key => !names.includes(key))) invalid("unknown field");
  return value as Record<string, unknown>;
}
function choice<const T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  return allowed.find(item => item === value) ?? invalid(field);
}
function identifier(value: unknown, field: string): string {
  try { storedId(value, field); } catch { return invalid(field); }
  if (typeof value !== "string" || forbidden.has(value)) return invalid(field);
  return value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid("date");
  const instant = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value) invalid("date");
  return value;
}
function boolean(value: unknown, field: string): boolean {
  return typeof value === "boolean" ? value : invalid(field);
}
const prayer = (value: unknown) => choice(value, ["fajr", "dhuhr", "asr", "maghrib", "isha"], "prayer");
function priority(value: unknown): Priority {
  const item = fields(value, ["kind", "habitId", "goalId", "milestoneId", "taskId", "date", "groupId"]);
  switch (item.kind) {
    case "habit":
      fields(item, ["kind", "habitId"]);
      return { kind: "habit", habitId: identifier(item.habitId, "habitId") };
    case "milestone":
      fields(item, ["kind", "goalId", "milestoneId"]);
      return { kind: "milestone", goalId: identifier(item.goalId, "goalId"), milestoneId: identifier(item.milestoneId, "milestoneId") };
    case "task":
      fields(item, ["kind", "taskId", "date", "groupId"]);
      return { kind: "task", taskId: identifier(item.taskId, "taskId"), date: date(item.date), ...(item.groupId!==undefined?{groupId:identifier(item.groupId,"groupId")}: {}) };
    default: return invalid("priority.kind");
  }
}
export function parseCommand(value: unknown): DomainCommand {
  checkSize(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("object");
  const kind = (value as Record<string, unknown>).kind;
  switch (kind) {
    case "habit.check": case "habit.correct": {
      const c = fields(value, ["kind", "habitId", "date", "check"]);
      return { kind, habitId: identifier(c.habitId, "habitId"), date: date(c.date), check: c.check === null ? null : choice(c.check, ["full", "tiny"], "check") };
    }
    case "habit.archive": {
      const c = fields(value, ["kind", "habitId"]);
      return { kind, habitId: identifier(c.habitId, "habitId") };
    }
    case "priorities.set": {
      const c = fields(value, ["kind", "date", "priorities"]);
      if (!Array.isArray(c.priorities) || c.priorities.length > 3) return invalid("priorities");
      const priorities = c.priorities.map(priority);
      if (new Set(priorities.map(p => JSON.stringify(p))).size !== priorities.length) invalid("priorities");
      return { kind, date: date(c.date), priorities };
    }
    case "goal.milestone": {
      const c = fields(value, ["kind", "goalId", "milestoneId", "completed"]);
      return { kind, goalId: identifier(c.goalId, "goalId"), milestoneId: identifier(c.milestoneId, "milestoneId"), completed: boolean(c.completed, "completed") };
    }
    case "goal.status": {
      const c = fields(value, ["kind", "goalId", "status"]);
      return { kind, goalId: identifier(c.goalId, "goalId"), status: choice(c.status, ["active", "paused", "archived"], "status") };
    }
    case "reward.enjoy": {
      const c = fields(value, ["kind", "rewardId"]);
      return { kind, rewardId: identifier(c.rewardId, "rewardId") };
    }
    case "prayer.record": {
      const c = fields(value, ["kind", "date", "prayer", "check", "returnToWork"]);
      return { kind, date: date(c.date), prayer: prayer(c.prayer), check: c.check === null ? null : choice(c.check, ["on_time", "later", "missed"], "check"), ...(c.returnToWork !== undefined ? { returnToWork: choice(c.returnToWork, ["if-recorded", "always"], "returnToWork") } : {}) };
    }
    case "prayer.pause": {
      const c = fields(value, ["kind", "pauseId", "date", "prayer"]);
      return { kind, pauseId: identifier(c.pauseId, "pauseId"), date: date(c.date), prayer: prayer(c.prayer) };
    }
    case "prayer.resume": {
      const c = fields(value, ["kind", "date", "prayer", "includeCurrent"]);
      return { kind, date: date(c.date), prayer: prayer(c.prayer), includeCurrent: boolean(c.includeCurrent, "includeCurrent") };
    }
    case "fajr.acknowledge": {
      const c = fields(value, ["kind", "date"]);
      return { kind, date: date(c.date) };
    }
    default: {
      try { return isPrayerCommand(value) ? parsePrayerCommand(value) : parsePersonalCommand(value); }
      catch (error) { if (error instanceof StoredDataError) return invalid(error.path); throw error; }
    }
  }
}
export function parseOperation(value: unknown): LocalOperation {
  checkSize(value);
  const o = fields(value, ["protocolVersion", "operationId", "baseRevision", "command", "context"]);
  if (o.protocolVersion !== 1) invalid("protocolVersion");
  if (typeof o.baseRevision !== "number" || !Number.isSafeInteger(o.baseRevision) || o.baseRevision < 0) return invalid("baseRevision");
  return { protocolVersion: 1, operationId: identifier(o.operationId, "operationId"), baseRevision: o.baseRevision, command: parseCommand(o.command), ...(o.context !== undefined ? { context: parseCommandContext(o.context) } : {}) };
}

export function parseCommandContext(value: unknown): CommandContext {
  checkSize(value);
  try { return parseContext(value); } catch (error) { if (error instanceof StoredDataError) return invalid(error.path); throw error; }
}
