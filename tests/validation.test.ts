import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJson, parseJson, MAX_BYTES, StoredDataError, string, id, shape, number } from "../src/data/validation.ts";

test("JSON validation rejects hidden unsafe fields and accessors without invoking them", () => {
  let calls = 0;
  for (const enumerable of [true, false]) {
    for (const value of [{}, []]) {
      Object.defineProperty(value, "private", { enumerable, get() { calls++; return "must not run"; } });
      assert.throws(() => validateJson(value), StoredDataError);
    }
    for (const key of ["__proto__", "prototype", "constructor"]) {
      const value = Object.defineProperty({}, key, { enumerable, value: { unsafe: true } });
      assert.throws(() => validateJson(value), StoredDataError);
    }
  }
  assert.equal(calls, 0);
  assert.throws(() => validateJson(Object.defineProperty({}, "hidden", { value: Infinity })), StoredDataError);
  assert.throws(() => validateJson(Object.create({ inherited: true })), StoredDataError);
  const safe = { extension: { note: "Unknown safe data stays intact", values: [null, 3, true] } };
  const before = structuredClone(safe); validateJson(safe); assert.deepEqual(safe, before);
});

test("JSON safety retains exact depth and object-record limits for large profiles", () => {
  let depth: unknown = null;
  for (let i = 0; i < 20; i++) depth = { child: depth };
  validateJson(depth);
  assert.deepEqual(parseJson(JSON.stringify(depth)), depth);
  assert.throws(() => validateJson({ child: depth }), StoredDataError);
  assert.throws(() => parseJson(JSON.stringify({ child: depth })), StoredDataError);
  const records = Array.from({ length: 250000 }, () => ({}));
  validateJson(records);
  const parsed = parseJson(JSON.stringify(records));
  assert.ok(Array.isArray(parsed)); assert.equal(parsed.length, records.length);
  records.push({});
  assert.throws(() => validateJson(records), StoredDataError);
  assert.throws(() => parseJson(JSON.stringify(records)), StoredDataError);
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  assert.throws(() => validateJson(cycle), StoredDataError);
});

test("parsed JSON preserves safe extensions and rejects unsafe keys, numbers and array depth", () => {
  const value = { extension: { toJSON: "Authored text", note: "Привет · Salom · 🌱", values: [null, 3, true, -0] } };
  const raw = JSON.stringify(value);
  assert.equal(JSON.stringify(parseJson(raw)), raw);
  for (const key of ["__proto__", "prototype", "constructor"]) {
    for (const raw of [`{"${key}":null}`, `[{"nested":{"${key}":{}}}]`]) assert.throws(() => parseJson(raw), StoredDataError);
  }
  assert.throws(() => parseJson('{"\\u005f\\u005fproto__":null}'), StoredDataError);
  for (const raw of ["1e400", "[1e400]", '{"value":-1e400}']) assert.throws(() => parseJson(raw), StoredDataError);
  for (const raw of ["{", '"unterminated', "[1,]"]) assert.throws(() => parseJson(raw), SyntaxError);
  // Empty arrays still have their own length property at the next depth.
  parseJson("[".repeat(20) + "0" + "]".repeat(20));
  assert.throws(() => parseJson("[".repeat(21) + "]".repeat(21)), StoredDataError);
});

test("parsed JSON enforces the UTF-8 byte boundary without dropping Unicode data", () => {
  const text = "€".repeat(Math.floor((MAX_BYTES - 2) / 3));
  const raw = JSON.stringify(text);
  assert.equal(Buffer.byteLength(raw), MAX_BYTES);
  assert.equal(parseJson(raw), text);
  assert.throws(() => parseJson(JSON.stringify(text + "€")), StoredDataError);
});

test("stored string limits retain Unicode code-point and pattern semantics", () => {
  const short = string(2);
  for (const value of ["", "ab", "аб", "🌱🌳", "a🌱", "e\u0301", "\ud800x"]) short(value, "title");
  for (const value of ["abc", "🌱🌳🌻", "e\u0301x", "\ud800xy", null, 12]) assert.throws(() => short(value, "title"), StoredDataError);
  string(0)("", "empty");
  assert.throws(() => string(0)("🌱", "empty"), StoredDataError);
  const patterned = string(2, /^a/u);
  patterned("a🌱", "pattern");
  assert.throws(() => patterned("🌱", "pattern"), StoredDataError);
  assert.throws(() => patterned("abx", "pattern"), StoredDataError);
});

test("stored IDs and schema checks preserve bounds, required fields and errors", () => {
  for (const value of ["a", "привычка", "🌱".repeat(160), "x".repeat(160)]) id(value, "id");
  for (let code = 0; code < 32; code++) assert.throws(() => id(`a${String.fromCharCode(code)}b`, "id"), StoredDataError);
  for (const value of ["", "a b", "a\u00a0b", "x".repeat(161), "🌱".repeat(161), null]) assert.throws(() => id(value, "id"), StoredDataError);
  const check = shape({ name: string(2), count: number(0, 2, true) });
  const row = { name: "🌱🌳", count: 2, extension: "preserve" };
  check(row, "row"); assert.equal(row.extension, "preserve");
  for (const value of [{ name: "a" }, { name: "abc", count: 1 }, { name: "a", count: 3 }, [], null]) assert.throws(() => check(value, "row"), StoredDataError);
  assert.throws(() => check({ name: "a", count: -1 }, "row"), error => error instanceof StoredDataError && error.path === "row.count");
});

test("stored IDs reject whitespace and controls at every position while retaining Unicode identifiers", () => {
  const check = shape({ record: shape({ id }) });
  const whitespace = [0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
    0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff];
  // U+0085 is not ECMAScript whitespace; existing identifiers containing it survive.
  for (const code of [...Array.from({ length: 32 }, (_, i) => i), ...whitespace.filter(c => c !== 0x85)]) {
    const character = String.fromCodePoint(code);
    for (const value of [character + "id", "i" + character + "d", "id" + character]) {
      assert.throws(() => check({ record: { id: value } }, "profile"), error =>
        error instanceof StoredDataError && error.path === "profile.record.id");
    }
  }
  for (const value of ["привычка", "odat-oʻqish", "a\u0085b", "a\u200bb", "a\u200db", "a\u007fb", "\ud800", "🌱".repeat(160)]) {
    const row = { record: { id: value }, extension: "retain" };
    check(row, "profile"); assert.equal(row.record.id, value); assert.equal(row.extension, "retain");
  }
  for (const value of ["", "🌱".repeat(161), 12, null, undefined]) {
    assert.throws(() => check({ record: { id: value } }, "profile"), error =>
      error instanceof StoredDataError && error.path === "profile.record.id");
  }
});
