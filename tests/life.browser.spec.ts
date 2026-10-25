import { reloadSaved } from "./support/browser";
import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import { xpTotal, type State } from "../src/model";

const dialog = (p: Page) => p.getByRole("dialog");
async function scene(p: Page, name = "daily-life") {
  await p.goto("/?review=1");
  await p.getByRole("combobox", { name: "Demo fixture" }).selectOption(name);
  await p.getByRole("button", { name: "Load selected fixture" }).click();
}
async function people(p: Page) {
  await p.getByRole("tab", { name: "You", exact: true }).click();
  await p.getByRole("button", { name: /Family Tasks & shared lists/ }).click();
}
async function family(p: Page) {
  await people(p);
  await dialog(p).getByRole("button", { name: /Our family Tasks/ }).click();
}
async function squad(p: Page) {
  await people(p);
  await dialog(p).getByRole("button", { name: "Squads", exact: true }).click();
  await dialog(p).getByRole("button", { name: /Small steps together A weekly/ }).click();
}
test("city setup, reminder preferences and nested drafts survive reload", async ({ page }) => {
  await scene(page);
  await page.getByRole("button", { name: "Prayer times: Tashkent · local demo", exact: true }).click();
  await dialog(page).getByLabel("City", { exact: true }).selectOption("Samarkand");
  await dialog(page).getByLabel("Asr planned offset").selectOption("15");
  await dialog(page).getByRole("button", { name: /Prayer reminders A cue/ }).click();
  await dialog(page).getByLabel("Preparation lead time").selectOption("15");
  await dialog(page).getByRole("switch", { name: "Asr preparation reminder", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Preview preparation reminder", exact: true }).click();
  await expect(dialog(page)).toContainText("Reminder preview · nothing will be sent");
  await dialog(page).getByRole("button", { name: "Back to what I was doing" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page).getByLabel("City", { exact: true })).toHaveValue("Samarkand");
  await dialog(page).getByRole("button", { name: "Save sample prayer plan", exact: true }).click();
  await expect(dialog(page).getByLabel("City", { exact: true })).toHaveValue("Samarkand");
  await reloadSaved(page);
  expect((await stored(page)).life.setup.city).toBe("Samarkand");
  expect((await stored(page)).life.reminderRules.asr.preparation).toBe(false);
  expect((await stored(page)).prayers.preferences.leadMinutes).toBe(15);
});
test("Fajr stop, backup and acknowledgment persist without recording a prayer", async ({ page }) => {
  await scene(page, "fajr-morning");
  const original = (await stored(page)).prayers.days;
  await dialog(page).getByRole("button", { name: "Stop this alarm", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "Alarm stopped." })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Preview backup alarm" }).click();
  await expect(dialog(page)).toContainText("One more cue. Stay on your feet.");
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  await expect(dialog(page)).toContainText("No prayer recorded.");
  expect(await dialog(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await reloadSaved(page);
  expect((await stored(page)).life.alarm?.stage).toBe("awake");
  expect((await stored(page)).prayers.days).toEqual(original);
});
test("period pause and resume are reflected in Today and Progress without changing habits", async ({ page }) => {
  await scene(page);
  const original = await stored(page);
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await dialog(page).getByRole("button", { name: /Period mode Pause prayer/ }).click();
  await dialog(page).getByLabel("Pause from", { exact: true }).selectOption("asr");
  await dialog(page).getByRole("button", { name: "Pause prayer tracking", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await expect(page.locator("#panel-today")).toContainText("Prayer tracking is paused");
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await expect(page.locator("#panel-progress")).toContainText("paused");
  expect((await stored(page)).days).toEqual(original.days);
  await reloadSaved(page);
  await page.getByRole("button", { name: "Private pause", exact: true }).click();
  await dialog(page).getByLabel("Resume from").selectOption("maghrib");
  await dialog(page).getByRole("button", { name: "Resume prayer tracking", exact: true }).click();
  expect((await stored(page)).life.pauses[0].through).toBe("2026-10-19:2");
});
test("family task draft, assignment, repetition, pinning, completion and undo stay independent of XP", async ({ page }) => {
  await scene(page, "family-planning");
  const original = await stored(page);
  await dialog(page).getByRole("button", { name: "Add task", exact: true }).click();
  await dialog(page).getByLabel("Task name", { exact: true }).fill("Plan a family picnic");
  await dialog(page).getByRole("button", { name: "Repeat Mon", exact: true }).click();
  await reloadSaved(page);
  await family(page);
  await dialog(page).getByRole("button", { name: "Add task", exact: true }).click();
  await expect(dialog(page).getByLabel("Task name", { exact: true })).toHaveValue("Plan a family picnic");
  await dialog(page).getByRole("button", { name: "Save family task", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Plan a family picnic You", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Add to my three priorities", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Remove Build my little project from priorities", exact: true }).click();
  await dialog(page).getByRole("checkbox", { name: /Plan a family picnic/ }).check();
  await dialog(page).getByRole("button", { name: "Save priorities", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Mark as done", exact: true }).click();
  let s = await stored(page);
  expect(xpTotal(s)).toBe(xpTotal(original));
  expect(s.dailyPriorities["2026-10-19"]).toHaveLength(3);
  expect(s.life.tasks.find((t) => t.title === "Plan a family picnic")?.completions["2026-10-19"]).toBeTruthy();
  await dialog(page).getByRole("button", { name: "Undo completion", exact: true }).click();
  s = await stored(page);
  expect(s.life.tasks.find((t) => t.title === "Plan a family picnic")?.completions["2026-10-19"]).toBeUndefined();
});
test("shared lists create, edit, reorder, check and retain local changes", async ({ page }) => {
  await scene(page, "family-planning");
  await dialog(page).getByRole("button", { name: "Lists", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Create a shared list", exact: true }).click();
  await dialog(page).getByLabel("List name", { exact: true }).fill("Picnic");
  await dialog(page).getByRole("button", { name: "Create list", exact: true }).click();
  for (const name of ["Fruit", "Water"]) {
    await dialog(page).getByLabel("Add an item", { exact: true }).fill(name);
    await dialog(page).getByRole("button", { name: "Add", exact: true }).click();
  }
  await dialog(page).getByRole("button", { name: "Edit Fruit", exact: true }).click();
  await dialog(page).getByLabel("Edit item", { exact: true }).fill("Apples");
  await dialog(page).getByLabel("Quantity or note").fill("1 kg");
  await dialog(page).getByRole("button", { name: "Save", exact: true }).click();
  await dialog(page).locator("summary[aria-label='Water more actions']").click();
  await dialog(page).getByRole("button", { name: "Move Water up", exact: true }).click();
  await dialog(page).getByRole("checkbox", { name: "Check Apples", exact: true }).check();
  await reloadSaved(page);
  const list = (await stored(page)).life.lists.find((l) => l.name === "Picnic")!;
  expect(list.items.map((i) => i.text)).toEqual(["Water", "Apples"]);
  expect(list.items[1]).toMatchObject({ checked: true, quantity: "1 kg" });
});
test("squad sharing uses an explicit snapshot, supports reactions, editing and withdrawal", async ({ page }) => {
  await scene(page, "squad-reflection");
  await dialog(page).getByRole("button", { name: /Cheering you on/ }).first().click();
  await dialog(page).getByRole("button", { name: "Share my week", exact: true }).click();
  await dialog(page).getByLabel("A little reflection").fill("A short walk helped me begin.");
  await dialog(page).getByRole("switch", { name: "Include habit count", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Preview my update", exact: true }).click();
  await expect(dialog(page)).toContainText("This is all they’d see.");
  await expect(dialog(page)).not.toContainText("Paused");
  await dialog(page).getByRole("button", { name: "Publish to demo squad", exact: true }).click();
  let update = (await stored(page)).life.updates.find((u) => u.memberId === "self")!;
  expect(Object.keys(update).sort()).toEqual(["groupId", "habits", "id", "memberId", "note", "reactions", "week"]);
  expect(update.habits).toBe(1);
  await reloadSaved(page);
  await squad(page);
  await dialog(page).getByRole("button", { name: "Edit my weekly update", exact: true }).click();
  await dialog(page).getByLabel("A little reflection").fill("Starting small helped.");
  await dialog(page).getByRole("button", { name: "Preview my update", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Publish to demo squad", exact: true }).click();
  expect((await stored(page)).life.updates.filter((u) => u.memberId === "self")).toHaveLength(1);
  await dialog(page).getByRole("button", { name: "Edit my weekly update", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Withdraw my update", exact: true }).click();
  expect((await stored(page)).life.updates.some((u) => u.memberId === "self")).toBe(false);
});
test("invitation simulation, member controls, archive and language are local and persistent", async ({ page }) => {
  await scene(page, "family-planning");
  await dialog(page).getByRole("button", { name: "Invite a member", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Create sample invitation", exact: true }).click();
  await dialog(page).getByLabel("Fictional member name").fill("Dilshod");
  await dialog(page).getByRole("button", { name: "Simulate invitation accepted", exact: true }).click();
  expect((await stored(page)).life.groups[0].members).toHaveLength(4);
  await dialog(page).getByRole("button", { name: "Create sample invitation", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Revoke invitation", exact: true }).click();
  await page.keyboard.press("Escape");
  await dialog(page).getByRole("button", { name: "Group settings", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Remove Dilshod", exact: true }).click();
  await dialog(page).getByRole("switch", { name: "Group notifications", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Archive group", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Confirm", exact: true }).click();
  await reloadSaved(page);
  expect((await stored(page)).life.groups[0]).toMatchObject({ archived: true, muted: true });
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await dialog(page).getByRole("button", { name: "Language English", exact: true }).click();
  await dialog(page).getByRole("button", { name: /O‘zbekcha/ }).click();
  await reloadSaved(page);
  await expect(page.getByRole("tab", { name: "Bugun", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");
});
test("readiness states, empty entry points and modal keyboard focus work without device permissions", async ({ page }) => {
  await scene(page, "needs-attention");
  await expect(dialog(page)).toContainText("Waiting for iPhone");
  for (const state of ["permission", "coverage", "ready"]) {
    await dialog(page).getByLabel("Preview device state", { exact: true }).selectOption(state);
    await expect(dialog(page)).toContainText("Device simulation · no alarm is scheduled");
  }
  await page.keyboard.press("Tab");
  expect(await dialog(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await scene(page, "empty");
  await page.getByRole("button", { name: "Set up prayer times", exact: true }).click();
  await expect(dialog(page).getByLabel("City", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await people(page);
  await dialog(page).getByRole("button", { name: "Create a family space", exact: true }).click();
  await dialog(page).getByLabel("Group name", { exact: true }).fill("Our home");
  await dialog(page).getByRole("button", { name: "Create local group", exact: true }).click();
  await expect(dialog(page)).toContainText("Our home");
  expect((await stored(page)).life.groups[0].members).toHaveLength(1);
});

test("mobile widths and 200% text preserve readable prayer controls and persistent simulation labels", async ({ page }) => {
  await scene(page);
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    await page.goto("/?text=large");
    const cells = page.locator("#panel-today .prayer-anchor");
    const first = await cells.nth(0).boundingBox(), fourth = await cells.nth(3).boundingBox();
    expect(fourth!.y).toBeGreaterThan(first!.y);
    expect(await page.locator("#panel-today").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "Prayer times: Tashkent · local demo", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Save sample prayer plan", exact: true }).scrollIntoViewIfNeeded();
    const label = await dialog(page).locator(".life-preview").boundingBox();
    const header = await dialog(page).locator(".sheet-header").boundingBox();
    expect(label!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(label!.y + label!.height).toBeLessThan(852);
  }
});

test("editing assignments and repeat schedules, task archive/restore and list uncheck retain history", async ({ page }) => {
  await scene(page, "family-planning");
  await dialog(page).getByRole("checkbox", { name: "Complete Choose our weekend outing", exact: true }).check();
  await dialog(page).getByRole("button", { name: /Choose our weekend outing You/ }).click();
  await dialog(page).getByRole("button", { name: "Edit task", exact: true }).click();
  await dialog(page).getByLabel("Assigned to", { exact: true }).selectOption("amina");
  await dialog(page).getByLabel("Task name", { exact: true }).fill("Choose a family activity");
  await dialog(page).getByRole("button", { name: "Repeat Sat", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Save family task", exact: true }).click();
  const saved = (await stored(page)).life.tasks.find((t) => t.id === "weekend")!;
  expect(saved.assignee).toBe("amina");
  expect(saved.weekdays).toEqual([6]);
  expect(saved.completions["2026-10-19"]).toBeTruthy();
  await dialog(page).getByRole("button", { name: "Archive task", exact: true }).click();
  await dialog(page).locator("summary").filter({ hasText: "Archived tasks" }).click();
  await dialog(page).getByRole("button", { name: "Choose a family activity", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Restore task", exact: true }).click();
  expect((await stored(page)).life.tasks.find((t) => t.id === "weekend")?.archived).toBe(false);
  await dialog(page).getByRole("button", { name: "Lists", exact: true }).click();
  await dialog(page).getByRole("button", { name: "For the week 1/4 checked", exact: true }).click();
  await dialog(page).getByRole("checkbox", { name: "Check Green tea", exact: true }).uncheck();
  expect((await stored(page)).life.lists[0].items.find((i) => i.id === "tea")?.checked).toBe(false);
});

test("owner transfer enables leaving, hides shared content and preserves private progress", async ({ page }) => {
  await scene(page, "family-planning");
  const before = await stored(page);
  await dialog(page).getByRole("button", { name: "Group settings", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Leave group", exact: true })).toBeDisabled();
  await dialog(page).getByLabel("Transfer ownership", { exact: true }).selectOption("amina");
  await dialog(page).getByRole("button", { name: "Leave group", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog(page)).toContainText("This space is closed.");
  await reloadSaved(page);
  const after = await stored(page);
  expect(after.life.groups[0].left).toBe(true);
  expect(after.days).toEqual(before.days);
  expect(after.prayers).toEqual(before.prayers);
  expect(after.goals).toEqual(before.goals);
  await expect(page.locator("#panel-today")).not.toContainText("Choose our weekend outing");
});

test("new control names match English and Uzbek, including optional prayer sharing", async ({ page }) => {
  for (const language of ["en", "uz"]) {
    const t = (en: string, uz: string) => language === "uz" ? uz : en;
    await scene(page);
    if (language === "uz") {
      await page.getByRole("tab", { name: "You", exact: true }).click();
      await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await dialog(page).getByRole("button", { name: "Language English", exact: true }).click();
      await dialog(page).getByRole("button", { name: /O‘zbekcha/ }).click();
      await reloadSaved(page);
    }
    await expect(page.getByRole("tablist", { name: t("Main navigation", "Asosiy navigatsiya") })).toBeVisible();
    await page.getByRole("button", { name: t("Prayer times: Tashkent · local demo", "Namoz vaqtlari: Toshkent · jadval namunasi"), exact: true }).click();
    for (const [en, uz] of [["Fajr", "Bomdod"], ["Dhuhr", "Peshin"], ["Asr", "Asr"], ["Maghrib", "Shom"], ["Isha", "Xufton"]]) {
      const prayer = t(en, uz);
      await expect(dialog(page).getByRole("combobox", { name: `${prayer} ${t("planned offset", "reja kechikishi")}`, exact: true })).toBeVisible();
    }
    await dialog(page).getByRole("button", { name: t("Prayer reminders A cue to prepare. A cue to stop.", "Namoz eslatmalari Tayyorlanish va ishni to‘xtatish uchun eslatma."), exact: true }).click();
    for (const [en, uz] of [["Fajr", "Bomdod"], ["Dhuhr", "Peshin"], ["Asr", "Asr"], ["Maghrib", "Shom"], ["Isha", "Xufton"]]) {
      const prayer = t(en, uz);
      await expect(dialog(page).getByRole("switch", { name: t(`${prayer} preparation reminder`, `${prayer} uchun tayyorgarlik eslatmasi`), exact: true })).toBeVisible();
      await expect(dialog(page).getByRole("switch", { name: t(`${prayer} prayer-time reminder`, `${prayer} vaqtidagi eslatma`), exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: t("Alarm readiness", "Signal tayyorligi"), exact: true }).click();
    await expect(dialog(page).getByRole("combobox", { name: t("Preview device state", "Qurilma holatini ko‘rish"), exact: true })).toBeVisible();
    await reloadSaved(page);
    await page.getByRole("tab", { name: t("You", "Siz"), exact: true }).click();
    await page.getByRole("button", { name: t("Family Tasks & shared lists", "Oila Vazifalar va umumiy ro‘yxatlar"), exact: true }).click();
    await dialog(page).getByRole("button", { name: /Our family/ }).click();
    await dialog(page).getByRole("button", { name: /Choose our weekend outing/ }).click();
    await dialog(page).getByRole("button", { name: t("Edit task", "Vazifani tahrirlash"), exact: true }).click();
    for (const [en, uz] of [["Mon", "Dushanba"], ["Tue", "Seshanba"], ["Wed", "Chorshanba"], ["Thu", "Payshanba"], ["Fri", "Juma"], ["Sat", "Shanba"], ["Sun", "Yakshanba"]]) {
      await expect(dialog(page).getByRole("button", { name: t(`Repeat ${en}`, `${uz} kuni takrorlash`), exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: t("Lists", "Ro‘yxatlar"), exact: true }).click();
    await dialog(page).getByRole("button", { name: /For the week/ }).click();
    await dialog(page).locator(`summary[aria-label="Green tea ${t("more actions", "amallar")}"]`).click();
    await expect(dialog(page).getByRole("button", { name: t("Move Green tea up", "Green tea bandini yuqoriga ko‘chirish"), exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: t("Move Green tea down", "Green tea bandini pastga ko‘chirish"), exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: t("Group settings", "Guruh sozlamalari"), exact: true }).click();
    await expect(dialog(page).getByRole("textbox", { name: t("Group name", "Guruh nomi"), exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("switch", { name: t("Group notifications", "Guruh bildirishnomalari"), exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: t("Remove Amina", "Amina a’zosini olib tashlash"), exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("combobox", { name: t("Transfer ownership", "Egalikni topshirish"), exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: t("Squads", "Guruhlar"), exact: true }).click();
    await dialog(page).getByRole("button", { name: /Small steps together/ }).click();
    await dialog(page).getByRole("button", { name: t("Share my week", "Haftamni ulashish"), exact: true }).click();
    for (const [en, uz] of [["Include habit count", "Odat qaydlari sonini qo‘shish"], ["Include milestones", "Bajarilgan bosqichlarni qo‘shish"], ["Include prayer total", "Namozlar sonini qo‘shish"]]) {
      await expect(dialog(page).getByRole("switch", { name: t(en, uz), exact: true })).toBeVisible();
    }
  }
});
