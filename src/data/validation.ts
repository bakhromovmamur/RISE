/** Runtime checks for private stored JSON. Unknown safe fields survive migrations. */
export class StoredDataError extends Error {
  constructor(readonly path: string) { super(`Invalid saved data at ${path}`); }
}
export type Check = (value: unknown, path: string) => void;
export function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new StoredDataError(path);
  return value as Record<string, unknown>;
}
export const shape = (fields: Record<string, Check>): Check => {
  const entries = Object.entries(fields);
  return (value, path) => {
    const row = object(value, path);
    for (const [key, check] of entries) check(row[key], `${path}.${key}`);
  };
};
export const optional = (check: Check): Check => (v, p) => { if (v !== undefined) check(v, p); };
export const nullable = (check: Check): Check => (v, p) => { if (v !== null) check(v, p); };
export const oneOf = (...values: (string | number | boolean)[]): Check => (v, p) => {
  if (!values.some(x => x === v)) throw new StoredDataError(p);
};
export const number = (min = -Number.MAX_VALUE, max = Number.MAX_VALUE, integer = false): Check => (v, p) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v))) throw new StoredDataError(p);
};
export const string = (max = 5000, pattern?: RegExp): Check => (v, p) => {
  // UTF-16 length bounds code-point length; only longer strings need the
  // Unicode-aware count. Most stored fields fit without allocating an array.
  if (typeof v !== "string" || (v.length > max && [...v].length > max) || (pattern && !pattern.test(v))) throw new StoredDataError(p);
};
export const bool = oneOf(true, false);
// Keep the same Unicode length and whitespace/control exclusions in one scan.
// Dense occurrence histories repeat these checks for every stored habit ID.
// eslint-disable-next-line no-control-regex -- Explicitly reject the existing U+0000–U+001F range.
export const id = string(160, /^[^\s\x00-\x1f]+$/u);
export const date: Check = (v, p) => {
  string(10, /^\d{4}-\d{2}-\d{2}$/)(v, p);
  if (typeof v !== "string" || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw new StoredDataError(p);
};
export const clock = string(5, /^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const instant: Check = (v, p) => {
  string(40)(v, p);
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) throw new StoredDataError(p);
  date(v.slice(0, 10), p);
};
export const zone: Check = (v, p) => {
  string(100)(v, p);
  try { new Intl.DateTimeFormat("en", { timeZone: String(v) }); } catch { throw new StoredDataError(p); }
};
export const array = (check: Check, max = 250000): Check => (v, p) => {
  if (!Array.isArray(v) || v.length > max) throw new StoredDataError(p);
  v.forEach((row, i) => check(row, `${p}[${i}]`));
};
export const dictionary = (check: Check, key: Check = id): Check => (v, p) => {
  for (const [k, row] of Object.entries(object(v, p))) { key(k, p); check(row, `${p}.${k}`); }
};
export const emptyOr = (check: Check): Check => (v, p) => { if (v !== "") check(v, p); };
export const union = (...checks: Check[]): Check => (v, p) => {
  for (const check of checks) { try { check(v, p); return; } catch (e) { if (!(e instanceof StoredDataError)) throw e; } }
  throw new StoredDataError(p);
};

export const MAX_BYTES = 50 * 1024 * 1024;
/** Limits count objects (records), not every scalar in a two-year profile. */
export function validateJson(value: unknown) {
  validateJsonValue(value, false);
}
function validateJsonValue(value: unknown, parsed: boolean) {
  let records = 0;
  const visit = (v: unknown, depth: number) => {
    if (depth > 20) throw new StoredDataError("depth");
    if (v === null || typeof v === "boolean" || typeof v === "string") return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (typeof v !== "object" || !v) throw new StoredDataError("JSON");
    if (!Array.isArray(v) && ++records > 250000) throw new StoredDataError("record limit");
    if (!Array.isArray(v)) object(v, "JSON");
    // Fresh JSON.parse results cannot contain accessors. Arbitrary objects still
    // require descriptor inspection, including hidden own fields and array length.
    for (const k of Object.getOwnPropertyNames(v)) {
      if (k === "__proto__" || k === "prototype" || k === "constructor") throw new StoredDataError("unsafe key");
      if (parsed) visit((v as Record<string, unknown>)[k], depth + 1);
      else {
        const descriptor = Object.getOwnPropertyDescriptor(v, k);
        if (!descriptor || !("value" in descriptor)) throw new StoredDataError("unsafe key");
        visit(descriptor.value, depth + 1);
      }
    }
  };
  visit(value, 0);
}
export function parseJson(raw: string): unknown {
  if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).length > MAX_BYTES) throw new StoredDataError("size limit");
  const value: unknown = JSON.parse(raw);
  validateJsonValue(value, true);
  return value;
}
