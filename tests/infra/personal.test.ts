import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { authHarness, AuthBrowser } from "../support/auth.ts";
import { PersonalClient } from "../support/personal.ts";
import { emptyDraft } from "../../src/model.ts";
import { hash, secrets } from "../../server/auth/crypto.ts";
import { hydrate, personalTables, readRecords } from "../../server/personal/records.ts";
import { keyOf } from "../../src/contracts/sync.ts";
import { personalTotals } from "../support/personalTestData.ts";

let harness: Awaited<ReturnType<typeof authHarness>>;
before(async () => { harness = await authHarness(); });
after(async () => { await harness?.close(); });
const failed = (code: string) => (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === code;
const envelope = (client: PersonalClient, command: object, operationId = randomUUID(), baseRevision = client.revision) => ({ protocolVersion: 1, operationId, baseRevision, command });
const sid = (client: PersonalClient) => client.browser.cookies.get("rise_test_session")!;
async function claims(client: PersonalClient) {
  const row = (await harness.admin.query("select user_id,provider_session_id from rise_private.server_sessions where id_hash = $1", [hash(sid(client))])).rows[0];
  return { sub: row.user_id, session_id: row.provider_session_id, user_metadata: { role: "admin", ownerId: row.user_id } };
}

test("personal API requires a real session and CSRF; reading never creates an account profile", async () => {
  const guest = new AuthBrowser(harness); await guest.read();
  assert.equal((await guest.request("personal")).statusCode, 401);
  assert.equal((await guest.request("personal/commands", { protocolVersion: 1, operationId: randomUUID(), baseRevision: 0, command: { kind: "account.initialize", name: "Synthetic", language: "en", timezone: "UTC" } })).statusCode, 401);
  const client = new PersonalClient(harness); await client.login();
  assert.deepEqual(await client.read(), { initialized: false, revision: 0, xp: 0, records: null });
  const input = envelope(client, { kind: "account.initialize", name: "Synthetic", timezone: "UTC", language: "en" });
  const invalidHeaders: Record<string, string>[] = [{ origin: "" }, { origin: "https://foreign.invalid" }, { "x-rise-csrf": "" }, { "x-rise-csrf": "0".repeat(64) }];
  for (const headers of invalidHeaders) assert.equal((await client.browser.request("personal/commands", input, headers)).statusCode, 403);
  for (const extra of [{ ownerId: randomUUID() }, { context: { now: 0, timezone: "UTC", date: "2026-10-21" } }, { xp: 1000 }, { role: "admin" }]) assert.equal((await client.browser.request("personal/commands", { ...input, ...extra })).statusCode, 422);
  assert.equal((await client.read()).initialized, false);
  const initialized = await client.command(input.command); assert.equal(initialized.operationRevision, 1); assert.equal(initialized.xp, 0);
  assert.equal((await client.browser.request("personal/commands", envelope(client, input.command))).statusCode, 409);
  const response = await client.browser.request("personal"); assert.equal(response.headers["cache-control"], "no-store"); assert.equal(response.headers["vary"], "Cookie");
});

test("all personal entity families round-trip with domain parity, private pauses and immutable historical targets", async () => {
  const client = new PersonalClient(harness); await client.initialize();
  const fixture = await personalTotals(client);
  const view = await client.read(), state = hydrate(view.records!);
  assert.equal(view.xp, 120); assert.equal(state.life.groups.length, 0); assert.deepEqual(state.life.drafts, {});
  assert.equal(state.days[fixture.date][0].full, 5); assert.equal(state.habits[0].versions.at(-1)!.full, 10);
  assert.equal(state.days[fixture.date][0].name, "Synthetic habit 0"); assert.equal(state.habits[0].name, "New future habit name");
  assert.equal(state.prayers.days[fixture.date].entries.fajr.check, "on_time");
  assert.equal(state.life.delivery?.acknowledgedFajr.includes(fixture.date), true);
  assert.equal(state.life.pauses.length, 1); assert.ok(state.life.pauses[0].through);
  assert.equal(state.prayers.prepared[fixture.date].backupEnabled, true);
  assert.equal(state.prayers.prepared[fixture.tomorrow].backupEnabled, false);
  assert.equal(state.prayers.work?.note, "Second private synthetic note"); assert.equal(view.records!.saved_work_breaks.length, 2);
  assert.equal(view.records!.goal_milestones.some(m => m.retired === true), true);
  assert.deepEqual(state.dailyPriorities[fixture.date], [{ kind: "milestone", goalId: fixture.goal, milestoneId: fixture.milestone }, { kind: "habit", habitId: fixture.habits[0] }]);
  for (const definition of personalTables) assert.ok(view.records![definition.name].length > 0, `missing_entity:${definition.name}`);
  assert.equal((await harness.admin.query("select count(*) from rise.personal_receipts where owner_id = $1", [client.owner])).rows[0].count, String(client.revision));
  const previous = view.xp;
  await client.command({ kind: "habit.correct", habitId: fixture.habits[0], date: fixture.date, check: null });
  const corrected = await client.read(); assert.equal(corrected.xp, previous - 20);
  assert.equal(hydrate(corrected.records!).prayers.days[fixture.date].entries.fajr.check, "on_time");
  assert.equal(/private synthetic|example\.invalid|csrfToken|provider_cipher/.test(JSON.stringify(harness.logs)), false);
});

test("no-op account commands retain record revisions and removal barriers; a nested preference edit writes only its record", async () => {
  const client = new PersonalClient(harness);
  try {
    await client.initialize(); await personalTotals(client);
    const before = await client.read(), name = String(before.records!.profiles[0].name);
    async function snapshot() {
      return Object.fromEntries(await Promise.all(personalTables.filter(t => t.name !== "profiles").map(async table => [table.name,
        (await harness.admin.query(`select to_jsonb(t) as row from rise.${table.name} t where owner_id=$1 order by ${(table.order ?? table.keys).join(",") || "owner_id"}`, [client.owner])).rows,
      ])));
    }
    const rows = await snapshot(), changes = (await harness.admin.query("select * from rise.sync_changes where owner_id=$1 order by table_name,record_key", [client.owner])).rows;
    const base = client.revision, operationId = randomUUID(), command = { kind: "profile.name", name };
    const receipt = await client.command(command, base, operationId);
    assert.equal(receipt.operationRevision, base + 1); assert.equal(receipt.xp, before.xp);
    assert.deepEqual(await client.command(command, base, operationId), { ...receipt, replayed: true });
    assert.deepEqual(await snapshot(), rows);
    assert.deepEqual((await harness.admin.query("select * from rise.sync_changes where owner_id=$1 order by table_name,record_key", [client.owner])).rows, changes);
    const preferences = hydrate(before.records!).prefs;
    await client.command({ kind: "preferences.set", changes: { haptics: !preferences.haptics, quietStart: "21:13" } });
    const after = await client.read(), updated = await snapshot();
    assert.equal(after.xp, before.xp); assert.equal(after.revision, base + 2);
    assert.deepEqual(hydrate(after.records!).prefs, { ...preferences, haptics: !preferences.haptics, quietStart: "21:13" });
    for (const [table, original] of Object.entries(rows)) {
      if (table === "account_preferences") assert.notDeepEqual(updated[table], original);
      else assert.deepEqual(updated[table], original, `unrelated_record_changed:${table}`);
    }
  } finally {
    if (client.owner) { await client.browser.request("logout", {}); await harness.admin.query("delete from auth.users where id=$1 and email=$2", [client.owner, client.email]); }
  }
});

test("habit corrections preserve row versions, reindex removed rows and retain replay barriers", async () => {
  const owner = new PersonalClient(harness);
  try {
    await owner.initialize();
    const ids = [randomUUID(),randomUUID()];
    for (const [i,id] of ids.entries()) await owner.command({kind:"habit.save",newId:id,draft:{...emptyDraft(),name:`Synthetic version ${i}`,full:5,tiny:1,days:[0,1,2,3,4,5,6]}});
    const initial = await owner.read(), date = String(initial.records!.habit_days[0].date);
    for (const id of ids) await owner.command({kind:"habit.check",habitId:id,date,check:"full"});
    const rows = async()=> (await harness.admin.query<{row:Record<string,unknown>}>("select to_jsonb(t) as row from rise.habit_occurrences t where owner_id=$1 order by date,position,habit_id",[owner.owner])).rows.map(r=>r.row);
    const before = await rows(), selected = before.find(r=>r.habit_id===ids[0])!, untouched = before.find(r=>r.habit_id===ids[1])!;
    const key = keyOf("habit_occurrences",selected), barrier = async()=> (await harness.admin.query("select revision,deleted,barrier_revision,barrier_operation from rise.sync_changes where owner_id=$1 and table_name='habit_occurrences' and record_key=$2",[owner.owner,key])).rows[0];
    const command = {kind:"habit.correct",habitId:ids[0],date,check:"tiny"}, base = owner.revision, operationId = randomUUID();
    const corrected = await owner.command(command,base,operationId), after = await rows();
    assert.equal(corrected.xp,30); assert.deepEqual(after.find(r=>r.habit_id===ids[1]),untouched);
    const changed = after.find(r=>r.habit_id===ids[0])!;
    assert.equal(changed.check_kind,"tiny"); assert.equal(changed.xp,10); assert.deepEqual(changed.data,selected.data); assert.equal(Number(changed.revision),corrected.operationRevision);
    assert.deepEqual(await barrier(),{revision:String(corrected.operationRevision),deleted:false,barrier_revision:String(corrected.operationRevision),barrier_operation:operationId});
    assert.deepEqual(await owner.command(command,base,operationId),{...corrected,replayed:true}); assert.deepEqual(await rows(),after);
    await owner.command({kind:"habit.archive",habitId:ids[0]}); assert.deepEqual(await rows(),after);
    const undoId = randomUUID(),undone = await owner.command({kind:"habit.correct",habitId:ids[0],date,check:null},owner.revision,undoId);
    assert.equal(undone.xp,20); const afterRemoval = await rows(); assert.equal(afterRemoval.length,1);
    assert.deepEqual(afterRemoval[0],{...untouched,position:0,revision:undone.operationRevision,updated_at:afterRemoval[0].updated_at});
    const removed = await barrier(); assert.deepEqual(removed,{revision:String(undone.operationRevision),deleted:true,barrier_revision:String(undone.operationRevision),barrier_operation:undoId});
    const replay = await owner.browser.request("personal/commands",envelope(owner,command,operationId,base));
    assert.equal(replay.statusCode,200); assert.deepEqual(replay.json(),{...corrected,replayed:true});
    assert.deepEqual(await rows(),afterRemoval); assert.deepEqual(await barrier(),removed);
    const final = await owner.read(); assert.equal(final.revision,undone.operationRevision); assert.equal(final.xp,20);
  } finally {
    if (owner.owner) { await owner.browser.request("logout",{}); await harness.admin.query("delete from auth.users where id=$1 and email=$2",[owner.owner,owner.email]); }
  }
});

test("occurrence reads preserve JSON dates, scalar types, ordered snapshots and owner isolation under alternate SQL settings", async () => {
  const owner = new PersonalClient(harness), other = new PersonalClient(harness);
  try {
    await owner.initialize(); await other.initialize();
    const ids = [randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries()) await owner.command({ kind: "habit.save", newId: id, draft: { ...emptyDraft(), name: `Ўзбек Русский 🙂 "quoted" ${i}`, full: 2.5, tiny: i ? null : 0.5, days: [0,1,2,3,4,5,6] } });
    const dates = ["2024-02-28", "2024-02-29", "2024-03-01"];
    await harness.admin.query("update rise.habits set data=jsonb_set(data,'{created}','\"2024-02-28\"'::jsonb) where owner_id=$1", [owner.owner]);
    await harness.admin.query("update rise.habit_versions set effective='2024-02-28' where owner_id=$1", [owner.owner]);
    for (const [i, date] of dates.entries()) {
      await harness.admin.query("insert into rise.habit_days(owner_id,date,revision) values($1,$2,$3)", [owner.owner,date,owner.revision]);
      await harness.admin.query("insert into rise.habit_occurrences(owner_id,date,habit_id,position,check_kind,data,revision) select owner_id,$2,habit_id,position,case when habit_id=$3::uuid then $4 else null end,data,revision from rise.habit_occurrences where owner_id=$1 and date=(select max(date) from rise.habit_occurrences where owner_id=$1)", [owner.owner,date,ids[0],[null,"tiny","full"][i]]);
    }
    const expected = await owner.read(), actor = await claims(owner), sql = await harness.store.pool.connect();
    try {
      for (const setting of ["ISO, MDY", "SQL, DMY", "German, DMY"]) {
        await sql.query("begin");
        try {
          await sql.query("select set_config('request.jwt.claims',$1,true),set_config('DateStyle',$2,true),set_config('TimeZone','Pacific/Apia',true)", [JSON.stringify(actor),setting]);
          const actual = await readRecords(sql,owner.owner);
          assert.deepEqual(actual,expected.records);
          const legacy = await sql.query("select jsonb_build_object('date',t.date,'habit_id',t.habit_id,'position',t.position,'check_kind',t.check_kind,'data',t.data) as record from rise.habit_occurrences t where owner_id=$1 order by t.date,t.position,t.habit_id limit 250001", [owner.owner]);
          assert.deepEqual(actual.habit_occurrences,legacy.rows.map(r=>r.record));
          assert.deepEqual(actual.habit_occurrences.filter(r=>r.habit_id===ids[0]).slice(0,3).map(r=>[r.date,r.check_kind]),dates.map((d,i)=>[d,[null,"tiny","full"][i]]));
          assert.ok(Object.values(await readRecords(sql,other.owner)).every(rows=>rows.length===0));
        } finally { await sql.query("rollback"); }
      }
    } finally { sql.release(); }
    // SQL accepts the JSON shape; the public read must still reject an invalid
    // domain field instead of returning it through the faster projection.
    const invalidDate = "2024-03-02";
    try {
      await harness.admin.query("insert into rise.habit_days(owner_id,date,revision) values($1,$2,$3)",[owner.owner,invalidDate,owner.revision]);
      await harness.admin.query("insert into rise.habit_occurrences(owner_id,date,habit_id,position,check_kind,data,revision) select owner_id,$2,habit_id,position,check_kind,jsonb_set(data,'{icon}','\"invalid-icon\"'::jsonb),revision from rise.habit_occurrences where owner_id=$1 and date=$3 and habit_id=$4",[owner.owner,invalidDate,dates[0],ids[0]]);
      assert.equal((await owner.browser.request("personal")).statusCode,503);
    } finally {
      await harness.admin.query("delete from rise.habit_occurrences where owner_id=$1 and date=$2",[owner.owner,invalidDate]);
      await harness.admin.query("delete from rise.habit_days where owner_id=$1 and date=$2",[owner.owner,invalidDate]);
    }
    assert.deepEqual(await owner.read(),expected);
  } finally {
    for (const c of [owner,other]) if (c.owner) { await c.browser.request("logout",{}); await harness.admin.query("delete from auth.users where id=$1 and email=$2",[c.owner,c.email]); }
  }
});

test("direct RLS and invoker views isolate every personal table; ownership changes and cross-owner foreign keys fail", async () => {
  const owner = new PersonalClient(harness), other = new PersonalClient(harness); await owner.initialize(); await other.initialize();
  const fixture = await personalTotals(owner), ownerClaims = await claims(owner), otherClaims = await claims(other), before = await owner.read();
  const sql = await harness.admin.connect();
  try {
    for (const [role, actor, visible] of [["authenticated", ownerClaims, true], ["authenticated", otherClaims, false], ["authenticated", { ...ownerClaims, session_id: randomUUID() }, false], ["authenticated", { ...otherClaims, user_metadata: { role: "owner", ownerId: owner.owner } }, false]] as const) {
      await sql.query("begin");
      try {
        await sql.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(actor)]); await sql.query(`set local role ${role}`);
        for (const name of [...personalTables.map(t => t.name), "personal_receipts"]) {
          const rows = await sql.query(`select owner_id from rise.${name} where owner_id = $1`, [owner.owner]);
          assert.equal((rows.rowCount ?? 0) > 0, visible, `${name}:${visible}`);
        }
        const totals = await sql.query("select xp from rise.personal_totals where owner_id=$1", [owner.owner]);
        assert.equal(totals.rowCount, visible ? 1 : 0); if (visible) assert.equal(Number(totals.rows[0].xp), 120);
      } finally { await sql.query("rollback"); }
    }
    for (const query of ["select * from rise.habits", "select * from rise.personal_totals"]) {
      await sql.query("begin"); try { await sql.query("set local role anon"); await assert.rejects(sql.query(query), failed("42501")); } finally { await sql.query("rollback"); }
    }
    await sql.query("begin");
    try { await sql.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(ownerClaims)]); await sql.query("set local role authenticated"); await assert.rejects(sql.query("update rise.profiles set name='forged' where owner_id=$1", [owner.owner]), failed("42501")); } finally { await sql.query("rollback"); }
  } finally { sql.release(); }
  const runtime = await harness.store.pool.connect();
  try {
    await runtime.query("begin");
    try { await runtime.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(ownerClaims)]); await assert.rejects(runtime.query("update rise.habit_occurrences set data=jsonb_set(data,'{full}','999'::jsonb) where owner_id=$1", [owner.owner]), failed("23514")); } finally { await runtime.query("rollback"); }
    for (const name of [...personalTables.map(t => t.name), "personal_receipts"]) {
      await runtime.query("begin");
      try { await runtime.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(ownerClaims)]); await assert.rejects(runtime.query(`update rise.${name} set owner_id=$1 where owner_id=$2`, [other.owner, owner.owner]), failed("42501")); } finally { await runtime.query("rollback"); }
    }
    await runtime.query("begin");
    try { await runtime.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(otherClaims)]); await runtime.query("set constraints all immediate"); await assert.rejects(runtime.query("insert into rise.goal_habits(owner_id,goal_id,habit_id,position,revision) values($1,$2,$3,0,1)", [other.owner, fixture.goal, fixture.habits[0]]), failed("23503")); } finally { await runtime.query("rollback"); }
  } finally { runtime.release(); }
  assert.deepEqual(await owner.read(), before);
  const direct = await fetch(`${harness.config.providerUrl}/rest/v1/profiles?select=owner_id`, { headers: { apikey: harness.config.publishableKey, "Accept-Profile": "rise" }, signal: AbortSignal.timeout(5000) });
  const denial: unknown = await direct.json(); assert.equal(direct.status, 406);
  assert.ok(denial && typeof denial === "object" && "code" in denial); assert.equal(denial.code, "PGRST106");
  for (const command of [{ kind: "habit.archive", habitId: fixture.habits[0] }, { kind: "goal.milestone", goalId: fixture.goal, milestoneId: fixture.milestone, completed: false }, { kind: "reward.enjoy", rewardId: fixture.reward }]) assert.equal((await other.browser.request("personal/commands", envelope(other, command))).statusCode, 404);
  const state = JSON.parse(await readFile(".rise-infra/test/state.json", "utf8"));
  for (const role of ["worker", "lifecycle"] as const) {
    const restricted = new pg.Client({ ...harness.config.database, user: `rise_${role}_login`, password: state.passwords[role] }); await restricted.connect();
    try { await assert.rejects(restricted.query("select * from rise.profiles"), failed("42501")); } finally { await restricted.end(); }
  }
});

test("two sessions serialize conflicting commands across every personal entity family", async () => {
  const client = new PersonalClient(harness); await client.initialize(); const fixture = await personalTotals(client), second = new PersonalClient(harness);
  const crypto = secrets(harness.config.sessionKey, harness.config.installationId);
  await harness.admin.query("delete from rise_private.auth_limits where subject_hash=$1", [crypto.rate(`send-email:${client.email}`)]);
  await new Promise(resolve => setTimeout(resolve, 1100)); await second.browser.login(client.email);
  const state = hydrate((await client.read()).records!);
  const milestoneId = state.goals[0].milestones[0].id;
  const habit = state.habits[0], version = habit.versions.at(-1)!;
  const draft = { id: habit.id, name: habit.name, icon: habit.icon, area: habit.area, reason: habit.reason, type: habit.type, unit: habit.unit, full: version.full, tiny: version.tiny, days: version.days, cue: version.cue, reminder: version.reminder };
  const day = state.prayers.days[fixture.date];
  const cleanDay = { source: day.source, sample: false, timezone: day.timezone, entries: Object.fromEntries(Object.entries(day.entries).map(([id, entry]) => [id, { begins: entry.begins, target: entry.target, ends: entry.ends }])) };
  const pairs: [object, object][] = [
    [{ kind: "habit.correct", habitId: habit.id, date: fixture.date, check: null }, { kind: "habit.correct", habitId: habit.id, date: fixture.date, check: "full" }],
    [{ kind: "habit.save", newId: randomUUID(), draft: { ...draft, full: 11 } }, { kind: "habit.save", newId: randomUUID(), draft: { ...draft, full: 12 } }],
    [{ kind: "goal.milestone", goalId: fixture.goal, milestoneId, completed: false }, { kind: "goal.milestone", goalId: fixture.goal, milestoneId, completed: true }],
    [{ kind: "reward.archive", rewardId: fixture.reward, archived: true }, { kind: "reward.archive", rewardId: fixture.reward, archived: false }],
    [{ kind: "priorities.set", date: fixture.date, priorities: [] }, { kind: "priorities.set", date: fixture.date, priorities: state.dailyPriorities[fixture.date] }],
    [{ kind: "collection.claim", xp: 100 }, { kind: "collection.claim", xp: 100 }],
    [{ kind: "prayer.timetable", date: fixture.date, day: cleanDay, preferences: state.prayers.preferences }, { kind: "prayer.timetable", date: fixture.date, day: { ...cleanDay, source: "Other synthetic timetable" }, preferences: state.prayers.preferences }],
    [{ kind: "prayer.record", date: fixture.date, prayer: "fajr", check: "on_time" }, { kind: "prayer.record", date: fixture.date, prayer: "fajr", check: null }],
    [{ kind: "prayer.pause", pauseId: randomUUID(), date: fixture.date, prayer: "dhuhr" }, { kind: "prayer.pause", pauseId: randomUUID(), date: fixture.date, prayer: "dhuhr" }],
    [{ kind: "fajr.plan", date: fixture.date, plan: { ...state.prayers.fajr, wakeLead: 5 } }, { kind: "fajr.plan", date: fixture.date, plan: { ...state.prayers.fajr, wakeLead: 15 } }],
    [{ kind: "fajr.acknowledge", date: fixture.date }, { kind: "fajr.acknowledge", date: fixture.date }],
    [{ kind: "reflection.save", date: fixture.date, reflection: { manageable: "First", smaller: "Small" } }, { kind: "reflection.save", date: fixture.date, reflection: { manageable: "Second", smaller: "Small" } }],
    [{ kind: "work.note", date: fixture.date, prayer: "dhuhr", note: "First" }, { kind: "work.note", date: fixture.date, prayer: "dhuhr", note: "Second" }],
    [{ kind: "language.set", language: "uz" }, { kind: "language.set", language: "ru" }],
    [{ kind: "preferences.set", changes: { reduceMotion: true } }, { kind: "preferences.set", changes: { reduceMotion: false } }],
  ];
  for (const [first, last] of pairs) {
    const before = await client.read(), base = before.revision;
    const responses = await Promise.all([client.browser.request("personal/commands", envelope(client, first, randomUUID(), base)), second.browser.request("personal/commands", envelope(second, last, randomUUID(), base))]);
    assert.deepEqual(responses.map(r => r.statusCode).sort(), [200,409], "entity_command_race");
    const after = await client.read(); assert.equal(after.revision, base + 1);
    assert.ok(after.xp === 100 || after.xp === 120);
  }
  assert.equal((await harness.admin.query("select count(*) from rise.personal_receipts where owner_id=$1", [client.owner])).rows[0].count, String(client.revision));
});

test("concurrent devices commit one revision and replay one receipt; changed payloads cannot reuse an operation", async () => {
  const client = new PersonalClient(harness); const email = await client.login(); await client.command({ kind: "account.initialize", name: "Synthetic", timezone: "UTC", language: "en" });
  const second = new PersonalClient(harness);
  const crypto = secrets(harness.config.sessionKey, harness.config.installationId);
  await harness.admin.query("delete from rise_private.auth_limits where subject_hash = $1", [crypto.rate(`send-email:${email}`)]);
  await new Promise(resolve => setTimeout(resolve, 1100)); await second.browser.login(email); await second.read();
  const value = envelope(client, { kind: "profile.name", name: "Atomic synthetic name" });
  const results = await Promise.all([client.browser.request("personal/commands", value), second.browser.request("personal/commands", value), client.browser.request("personal/commands", value)]);
  assert.ok(results.every(r => r.statusCode === 200)); assert.equal(results.filter(r => r.json().replayed === false).length, 1);
  const receipt = results[0].json(); assert.ok(results.every(r => r.json().operationRevision === receipt.operationRevision));
  const read = await client.read(); assert.equal(read.revision, 2);
  assert.equal((await client.browser.request("personal/commands", { ...value, command: { kind: "profile.name", name: "Different" } })).statusCode, 409);
  const base = client.revision;
  const race = await Promise.all([client.browser.request("personal/commands", envelope(client, { kind: "language.set", language: "uz" }, randomUUID(), base)), second.browser.request("personal/commands", envelope(second, { kind: "preferences.set", changes: { haptics: true } }, randomUUID(), base))]);
  assert.deepEqual(race.map(r => r.statusCode).sort(), [200,409]); assert.equal((await client.read()).revision, 3);
  // Lost-response retry still returns its original outcome after a later operation.
  const replay = await client.browser.request("personal/commands", value); assert.equal(replay.json().operationRevision, 2); assert.equal(replay.json().replayed, true);
  // A malformed persisted result must fail closed, never coerce a false acknowledgment.
  const saved = { operationId: receipt.operationId, operationRevision: receipt.operationRevision, xp: receipt.xp }, beforeCorruption = await client.read();
  try {
    for (const invalid of [{ ...saved, xp: true }, { ...saved, xp: null }, { ...saved, operationRevision: 0 }, { ...saved, operationRevision: 1 }, { ...saved, operationRevision: beforeCorruption.revision + 1 }]) {
      await harness.admin.query("update rise.personal_receipts set result=$3 where owner_id=$1 and operation_id=$2", [client.owner, value.operationId, invalid]);
      assert.equal((await client.browser.request("personal/commands", value)).statusCode, 503);
      assert.deepEqual(await client.read(), beforeCorruption);
    }
  } finally { await harness.admin.query("update rise.personal_receipts set result=$3 where owner_id=$1 and operation_id=$2", [client.owner, value.operationId, saved]); }
});

test("receipt insertion failure rolls back the entity write and canonical revision", async () => {
  const client = new PersonalClient(harness); await client.initialize(); const before = await client.read(), operationId = randomUUID();
  await harness.admin.query(`create function rise_private.auth02_test_receipt_failure() returns trigger language plpgsql set search_path='' as $$ begin raise exception using errcode='40001',message='synthetic_receipt_failure'; end $$`);
  try {
    await harness.admin.query(`create trigger auth02_test_receipt_failure before insert on rise.personal_receipts for each row when (new.operation_id = '${operationId}'::uuid) execute function rise_private.auth02_test_receipt_failure()`);
    const response = await client.browser.request("personal/commands", envelope(client, { kind: "profile.name", name: "Must not commit" }, operationId));
    assert.equal(response.statusCode, 503); assert.equal(response.body.includes("Must not commit") || response.body.includes("synthetic_receipt_failure"), false);
    assert.deepEqual(await client.read(), before);
    assert.equal((await harness.admin.query("select count(*) from rise.personal_receipts where owner_id=$1 and operation_id=$2", [client.owner, operationId])).rows[0].count, "0");
  } finally { await harness.admin.query("drop trigger if exists auth02_test_receipt_failure on rise.personal_receipts"); await harness.admin.query("drop function rise_private.auth02_test_receipt_failure()"); }
});

test("revoked/banned sessions cannot read records or replay an already committed receipt", async () => {
  const client = new PersonalClient(harness); await client.initialize();
  const value = envelope(client, { kind: "profile.name", name: "Private synthetic name" }); await client.browser.request("personal/commands", value);
  const oldCookies = client.browser.cookieHeader(), oldClaims = await claims(client);
  await client.browser.request("logout", {});
  assert.equal((await client.browser.request("personal", undefined, { cookie: oldCookies })).statusCode, 401);
  assert.equal((await client.browser.request("personal/commands", value, { cookie: oldCookies })).statusCode, 401);
  const sql = await harness.admin.connect(); await sql.query("begin");
  try { await sql.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(oldClaims)]); await sql.query("set local role authenticated"); for (const name of [...personalTables.map(t => t.name), "personal_receipts"]) assert.equal((await sql.query(`select owner_id from rise.${name} where owner_id=$1`, [client.owner])).rowCount, 0); } finally { await sql.query("rollback"); sql.release(); }
  const banned = new PersonalClient(harness); await banned.initialize();
  await harness.admin.query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [banned.owner]);
  assert.equal((await banned.browser.request("personal")).statusCode, 401);
});

test("documented Unicode fields survive without truncation and XP totals are not writable", async () => {
  const client = new PersonalClient(harness); await client.initialize(); const habit = randomUUID();
  const draft = { ...emptyDraft(), name: "🌱".repeat(160), area: "🌱".repeat(160), unit: "🌱".repeat(160), reason: "🌱".repeat(5000), cue: "🌱".repeat(5000) };
  await client.command({ kind: "habit.save", newId: habit, draft });
  assert.equal(hydrate((await client.read()).records!).habits[0].reason, draft.reason);
  const plan = { bedtime: "22:00", wakeLead: 10, backupMinutes: 10, message: "🌱".repeat(5000), placement: "away", enabled: true };
  const date = String((await client.read()).records!.profiles[0].started_on);
  await client.command({ kind: "fajr.plan", date, plan });
  assert.equal(hydrate((await client.read()).records!).prayers.prepared[date].message, plan.message);
  const code = await claims(client), sql = await harness.store.pool.connect(); await sql.query("begin");
  try { await sql.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(code)]); await assert.rejects(sql.query("update rise.habit_occurrences set xp=999 where owner_id=$1", [client.owner]), failed("428C9")); } finally { await sql.query("rollback"); sql.release(); }
});
