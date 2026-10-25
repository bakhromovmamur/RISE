import { reloadSaved } from "./support/browser";
import { stored } from "./support/browser";
import { makeFixture } from "../src/review/fixtures";
import { test, expect, type Page } from "./support/browser";
import { type State } from "../src/model";

async function scene(page: Page, name = "balanced") {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption(name);
  await page.getByRole("button", { name: "Load selected fixture" }).click();
}
const dialog = (page: Page) => page.getByRole("dialog");
const mainTab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true }).click();
async function dismiss(page: Page) {
  if (await dialog(page).count()) await page.keyboard.press("Escape");
  if (await page.getByRole("button", { name: "Dismiss message" }).count()) await page.getByRole("button", { name: "Dismiss message" }).click();
}

test("Today first viewport leads with prayer and one actionable priority; rewards and routine remain reachable", async ({ page }) => {
  await scene(page);
  await page.goto("/");
  const prayer = page.getByRole("button", { name: /Asr, Upcoming/ });
  const reward = page.locator("#panel-today .reward-cue");
  const first = page.locator("#panel-today .priority-list .habit-card").first();
  await expect(prayer).toBeVisible();
  await expect(reward).toBeVisible();
  const nav = await page.getByRole("tablist", { name: "Main navigation" }).boundingBox();
  const box = await first.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
  await expect(first.getByRole("button", { name: /Log 10 pages/ })).toBeVisible();
  await expect(page.locator("#panel-today .priority-list > article")).toHaveCount(3);
  await expect(page.locator("#panel-today .routine-list")).toBeHidden();
  await page.locator(".today-disclosure > summary").filter({ hasText: "My routine" }).click();
  await expect(page.locator("#panel-today .routine-list")).toBeVisible();
  await expect(page.locator("#panel-today .routine-list")).toContainText("Practice English");
});

test("priority replacement and reordering survive reload without duplicating completion or adding work", async ({ page }) => {
  await scene(page);
  await page.getByRole("button", { name: "Edit priorities", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Remove Build my little project from priorities", exact: true }).click();
  await dialog(page).getByRole("checkbox", { name: /Build the first working screen/ }).check();
  await dialog(page).getByRole("button", { name: "Move Build the first working screen up", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Save priorities", exact: true }).click();
  const before = (await stored(page)).dailyPriorities["2026-10-19"];
  await reloadSaved(page);
  expect((await stored(page)).dailyPriorities["2026-10-19"]).toEqual(before);
  await page.getByRole("button", { name: "Complete milestone", exact: true }).click();
  expect((await stored(page)).dailyPriorities["2026-10-19"]).toEqual(before);
  await scene(page, "completed-priority");
  await expect(page.locator("#panel-today .priority-complete")).toContainText("Your priorities are done");
  expect((await stored(page)).dailyPriorities["2026-10-19"]).toHaveLength(3);
  await expect(page.locator("#panel-today .routine-list")).toContainText("Practice English");
  await page.getByRole("button", { name: /Advance one local day/ }).click();
  await expect.poll(async () => (await stored(page)).dailyPriorities["2026-10-20"]?.length).toBeGreaterThan(0);
  expect((await stored(page)).dailyPriorities["2026-10-19"]).toHaveLength(3);
});

test("tiny, upgrade and Undo stay consistent on Today, Progress and Journey", async ({ page }) => {
  await scene(page);
  const read = page.locator("#panel-today .habit-card").filter({ has: page.getByRole("button", { name: "View Read a little", exact: true }) });
  await read.getByRole("button", { name: /Log tiny Read a little/ }).click();
  await dismiss(page); // existing Pip unlock may open
  expect((await stored(page)).days["2026-10-19"].filter((o) => o.check)).toHaveLength(2);
  await expect(page.locator("#panel-today .reward-cue")).toContainText("2/5 check-ins");
  await page.getByRole("button", { name: "View Read a little", exact: true }).click();
  await dialog(page).getByRole("button", { name: /Upgrade to full target/ }).click();
  await dismiss(page);
  await expect(page.locator("#panel-today .reward-cue")).toContainText("2/5 check-ins");
  await mainTab(page, "Progress");
  await expect(page.getByRole("tabpanel", { name: "overview progress", exact: true })).toContainText("2 of 4");
  await mainTab(page, "Journey");
  await expect(page.locator("#panel-journey .personal-rewards")).toContainText("2/5 check-ins");
  await mainTab(page, "Today");
  await page.getByRole("button", { name: "View Read a little", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Undo check-in", exact: true }).click();
  await dismiss(page);
  await expect(page.locator("#panel-today .reward-cue")).toContainText("1/5 check-ins");
});

test("all Progress views preserve one selected week and separate lifetime from weekly results", async ({ page }) => {
  await scene(page);
  await mainTab(page, "Progress");
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "overview progress" })).toContainText("1 of 4");
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  for (const view of ["Salah", "Habits", "Goals", "Overview"]) {
    await mainTab(page, view);
    await expect(page.locator(".shared-week")).toContainText("Oct 12–Oct 18");
  }
  await expect(page.getByRole("tabpanel", { name: "overview progress" })).toContainText("14 of 16");
  await page.locator(".progress-disclosure > summary").filter({ hasText: "Habits" }).click();
  await expect(page.getByRole("tabpanel", { name: "overview progress" })).toContainText("87.5%");
  await mainTab(page, "Habits");
  await page.locator(".progress-detail-disclosure > summary").filter({ hasText: "Streaks & lifetime XP" }).click();
  await expect(page.getByRole("tabpanel", { name: "habits progress" })).toContainText("240 lifetime habit XP");
  await page.getByRole("button", { name: "Back to this week", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "habits progress" })).toContainText("4 scheduled through today");
});

test("goal creation, reordering, reward unlocking, correction, pause and archive form one working flow", async ({ page }) => {
  await scene(page);
  await mainTab(page, "Progress"); await mainTab(page, "Goals");
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await dialog(page).getByLabel("Goal name", { exact: true }).fill("Plan a family Saturday");
  await dialog(page).getByLabel("Why it matters", { exact: true }).fill("A shared memory.");
  await dialog(page).getByLabel("Milestone 1", { exact: true }).fill("Choose an outing");
  await dialog(page).getByRole("button", { name: "Add milestone", exact: true }).click();
  await dialog(page).getByLabel("Milestone 2", { exact: true }).fill("Set aside time");
  await dialog(page).getByRole("button", { name: "Move milestone 2 up", exact: true }).click();
  await dialog(page).getByRole("checkbox", { name: "Take a walk", exact: true }).check();
  await dialog(page).getByRole("button", { name: "Save goal", exact: true }).click();
  const goal = (await stored(page)).goals.find((g) => g.title === "Plan a family Saturday")!;
  expect(goal.milestones[0].title).toBe("Set aside time");
  await mainTab(page, "Journey");
  await page.locator("#panel-journey .personal-rewards").getByRole("button", { name: "Add personal reward", exact: true }).click();
  await dialog(page).getByLabel("Reward name", { exact: true }).fill("Family picnic");
  await dialog(page).getByLabel("Unlock this reward by", { exact: true }).selectOption("goal");
  await dialog(page).getByLabel("Goal", { exact: true }).selectOption(goal.id);
  await dialog(page).getByRole("button", { name: "Save reward", exact: true }).click();
  await mainTab(page, "Progress");
  await page.locator("#panel-progress").getByRole("button", { name: /^Plan a family Saturday/ }).click();
  for (const name of ["Set aside time", "Choose an outing"]) await dialog(page).getByRole("button", { name: `Complete ${name}`, exact: true }).click();
  await dismiss(page);
  await mainTab(page, "Today");
  await page.locator("#panel-today .reward-cue").getByRole("button", { name: /Family picnic/ }).click();
  await dialog(page).getByRole("button", { name: "Mark as enjoyed", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Open linked goal", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Undo Choose an outing", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Pause goal", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Complete Choose an outing", exact: true })).toBeDisabled();
  await dialog(page).getByRole("button", { name: "Resume goal", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Archive goal", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Confirm archive", exact: true }).click();
  const state = await stored(page), reward = state.personalRewards.find((r) => r.name === "Family picnic")!;
  expect(reward.enjoyedOn).toBe("2026-10-19");
  expect(reward.correctedOn).toBe("2026-10-19");
  expect(state.goals.find((g) => g.id === goal.id)?.status).toBe("archived");
  expect(state.days["2026-10-19"].filter((o) => o.check)).toHaveLength(1);
});

test("a prayer becoming due does not replace an open form or erase its draft; keyboard stays inside", async ({ page }) => {
  await scene(page);
  await mainTab(page, "Progress"); await mainTab(page, "Goals");
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await dialog(page).getByLabel("Goal name", { exact: true }).fill("Keep this draft");
  await dialog(page).getByLabel("Milestone 1", { exact: true }).fill("One meaningful step");
  await page.getByRole("textbox", { name: "Demo clock", exact: true }).fill("15:45");
  await expect(dialog(page).getByLabel("Goal name", { exact: true })).toHaveValue("Keep this draft");
  await dialog(page).getByLabel("Goal name", { exact: true }).focus();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => ({
      inside: !!document.activeElement?.closest('[role="dialog"]'),
      element: document.activeElement?.outerHTML.slice(0, 240),
    }));
    expect(focus.inside, `Tab ${i + 1}: ${focus.element}`).toBe(true);
  }
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await dialog(page).getByRole("button", { name: "Save goal", exact: true }).click();
  await mainTab(page, "Today");
  await expect(page.getByRole("button", { name: "Save & step away", exact: true })).toBeVisible();
});

test("history correction changes old-week reward eligibility while retaining enjoyed history", async ({ page }) => {
  await scene(page, "earned-reward");
  await page.locator("#panel-today .reward-cue").getByRole("button", { name: /A slow coffee/ }).click();
  await dialog(page).getByRole("button", { name: "Mark as enjoyed", exact: true }).click();
  await dismiss(page);
  await mainTab(page, "Progress"); await mainTab(page, "Habits");
  await page.getByRole("button", { name: /^Monday, Oct 19:/ }).click();
  await dialog(page).getByRole("button", { name: /^Read a little/ }).click();
  await dialog(page).getByLabel("Recorded completion", { exact: true }).selectOption("none");
  await dialog(page).getByRole("button", { name: "Save correction", exact: true }).click();
  const reward = (await stored(page)).personalRewards[0];
  expect(reward.enjoyedOn).toBeTruthy();
  expect(reward.correctedOn).toBeTruthy();
});

test("weekly reward creation normalizes the week and Try next week preserves the prior attempt", async ({ page }) => {
  await scene(page);
  await mainTab(page, "Journey");
  await page.locator("#panel-journey .personal-rewards").getByRole("button", { name: "Add personal reward", exact: true }).click();
  await dialog(page).getByLabel("Reward name", { exact: true }).fill("An afternoon outdoors");
  await dialog(page).getByLabel("Choose a day in the week", { exact: true }).fill("2026-10-18");
  await dialog(page).getByLabel("Number of check-ins", { exact: true }).fill("15");
  await expect(dialog(page)).toContainText("Oct 12–Oct 18");
  await dialog(page).getByRole("button", { name: "Save reward", exact: true }).click();
  await page.locator("#panel-journey .journey-disclosure > summary").filter({ hasText: "All rewards & history" }).click();
  await page.getByRole("button", { name: "Manage personal rewards", exact: true }).click();
  await dialog(page).getByRole("button", { name: /An afternoon outdoors/ }).click();
  await dialog(page).getByRole("button", { name: "Try next week", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "View next attempt", exact: true })).toBeVisible();
  const rewards = (await stored(page)).personalRewards.filter((r) => r.name === "An afternoon outdoors");
  expect(rewards).toHaveLength(2);
  expect(rewards[0].condition).toEqual({ kind: "weekly", week: "2026-10-12", target: 15 });
  expect(rewards[1].condition).toEqual({ kind: "weekly", week: "2026-10-19", target: 15 });
  await dialog(page).getByRole("button", { name: "View next attempt", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Edit reward", exact: true }).click();
  await dialog(page).getByLabel("Number of check-ins", { exact: true }).fill("1");
  await dialog(page).getByRole("button", { name: "Save reward", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Mark as enjoyed", exact: true })).toBeVisible();
});

test("thirteenth habit is created without an upgrade route and long names stay accessible", async ({ page }) => {
  await scene(page, "busy");
  await page.locator(".today-disclosure > summary").filter({ hasText: "My routine" }).click();
  await page.locator("#panel-today").getByRole("button", { name: "Add a habit", exact: true }).click();
  await dialog(page).getByLabel("Habit name", { exact: true }).fill("A thirteenth small commitment");
  await dialog(page).getByRole("button", { name: /Save habit|Add habit|Create habit/ }).click();
  await expect.poll(async () => (await stored(page)).habits.length).toBe(13);
  await expect(page.locator("#panel-today")).toContainText("A thirteenth small commitment");
  await expect(page.getByText("RISE Plus", { exact: true })).toHaveCount(0);
});

test("version 2 browser data migrates in place without invented goals or rewards", async ({ page }) => {
  const legacy = JSON.parse(JSON.stringify(makeFixture()));
  legacy.schema = 2;
  delete legacy.goals; delete legacy.personalRewards; delete legacy.dailyPriorities; delete legacy.selectedRewardId;
  legacy.prayers.work = { date: "2026-10-19", prayer: "asr", stage: "save", note: "My return note", wrapUntil: null, wrapUsed: true };
  await page.addInitScript((value) => localStorage.setItem("rise.local.v1", JSON.stringify(value)), legacy);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your day, Mamur." })).toBeVisible();
  const migrated = await stored(page);
  expect(migrated.schema).toBe(4);
  expect(migrated.days).toEqual(legacy.days);
  expect(migrated.habits).toEqual(legacy.habits);
  expect(migrated.prayers).toEqual(legacy.prayers);
  expect(migrated.goals).toEqual([]);
  expect(migrated.personalRewards).toEqual([]);
});

test("empty screens offer working setup actions; data export and confirmed clearing include new records", async ({ page }) => {
  await scene(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export local data/, exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString()), data = backup.data.personal;
  expect(backup.format).toBe("rise.private-backup");
  expect(data.schema).toBe(4);
  expect(data.goals).toHaveLength(2);
  expect(data.personalRewards).toHaveLength(2);
  expect(data.dailyPriorities["2026-10-19"]).toHaveLength(3);
  await mainTab(page, "You");
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await dialog(page).locator(".settings-disclosure > summary").filter({ hasText: "Your data" }).click();
  await dialog(page).getByRole("button", { name: /^Clear local data/ }).click();
  await expect(dialog(page)).toContainText("saved work notes");
  await dialog(page).getByRole("button", { name: "Clear local data", exact: true }).click();
  expect((await stored(page)).goals).toEqual([]);
  expect((await stored(page)).personalRewards).toEqual([]);
  expect((await stored(page)).dailyPriorities).toEqual({});
  await scene(page, "empty");
  await page.getByRole("button", { name: "Add your first habit", exact: true }).click();
  await expect(dialog(page).getByLabel("Habit name", { exact: true })).toBeVisible();
});
