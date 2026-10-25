# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-day.browser.spec.ts >> Fajr plans keep their displayed date, preserve drafts and distinguish saving from alarm delivery
- Location: tests/full-day.browser.spec.ts:149:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog')
Expected substring: "20.10.2026 uchun bomdod rejasi."
Received string:    "Bomdodga tayyorlanishBomdod rejasi · haqiqiy signal chalinmaydiUyg‘onishni biroz osonlashtiring.19.10.2026 uchun bomdod rejasi.Bomdod boshlanishi05:20Uyg‘onish vaqtingiz05:05Uyquga tayyorlanish vaqtiBomdoddan oldin uyg‘onish0 daqiqa5 daqiqa10 daqiqa15 daqiqa20 daqiqa30 daqiqaZaxira uyg‘onish signaliKerak bo‘lsa, yana bir eslatmaZaxira signal oralig‘i3 daqiqadan keyin5 daqiqadan keyin10 daqiqadan keyinTelefoningiz qayerda bo‘ladiXonaning narigi tomonidaYotoq yonidaKechki o‘zingizdan xabarA date-specific morning message.Bomdod rejamni saqlashSaqlash va uyg‘onish namunasini ko‘rishSignal tayyorligini tekshirish"
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByRole('dialog') with timeout 5000ms
  - waiting for getByRole('dialog')
    14 × locator resolved to <section tabindex="-1" role="dialog" aria-modal="true" class="sheet full" aria-label="Bomdodga tayyorlanish">…</section>
       - unexpected value "Bomdodga tayyorlanishBomdod rejasi · haqiqiy signal chalinmaydiUyg‘onishni biroz osonlashtiring.19.10.2026 uchun bomdod rejasi.Bomdod boshlanishi05:20Uyg‘onish vaqtingiz05:05Uyquga tayyorlanish vaqtiBomdoddan oldin uyg‘onish0 daqiqa5 daqiqa10 daqiqa15 daqiqa20 daqiqa30 daqiqaZaxira uyg‘onish signaliKerak bo‘lsa, yana bir eslatmaZaxira signal oralig‘i3 daqiqadan keyin5 daqiqadan keyin10 daqiqadan keyinTelefoningiz qayerda bo‘ladiXonaning narigi tomonidaYotoq yonidaKechki o‘zingizdan xabarA date-specific morning message.Bomdod rejamni saqlashSaqlash va uyg‘onish namunasini ko‘rishSignal tayyorligini tekshirish"

```

```yaml
- dialog "Bomdodga tayyorlanish":
  - banner:
    - button "Orqaga":
      - img
    - heading "Bomdodga tayyorlanish" [level=2]
    - button "Yopish":
      - img
  - img
  - text: Bomdod rejasi · haqiqiy signal chalinmaydi
  - banner:
    - heading "Uyg‘onishni biroz osonlashtiring." [level=1]
    - paragraph: 19.10.2026 uchun bomdod rejasi.
  - img
  - text: Bomdod boshlanishi
  - strong: 05:20
  - img
  - img
  - text: Uyg‘onish vaqtingiz
  - strong: 05:05
  - text: Uyquga tayyorlanish vaqti
  - textbox "Uyquga tayyorlanish vaqti": 22:30
  - text: Bomdoddan oldin uyg‘onish
  - combobox "Bomdoddan oldin uyg‘onish":
    - option "0 daqiqa"
    - option "5 daqiqa"
    - option "10 daqiqa"
    - option "15 daqiqa" [selected]
    - option "20 daqiqa"
    - option "30 daqiqa"
  - img
  - strong: Zaxira uyg‘onish signali
  - text: Kerak bo‘lsa, yana bir eslatma
  - switch "Zaxira signalini yoqish" [checked]
  - text: Zaxira signal oralig‘i
  - combobox "Zaxira signal oralig‘i":
    - option "3 daqiqadan keyin" [selected]
    - option "5 daqiqadan keyin"
    - option "10 daqiqadan keyin"
  - text: Telefoningiz qayerda bo‘ladi
  - combobox "Telefoningiz qayerda bo‘ladi":
    - option "Xonaning narigi tomonida" [selected]
    - option "Yotoq yonida"
  - text: Kechki o‘zingizdan xabar
  - textbox "Kechki o‘zingizdan xabar": A date-specific morning message.
  - button "Bomdod rejamni saqlash"
  - button "Saqlash va uyg‘onish namunasini ko‘rish":
    - text: Saqlash va uyg‘onish namunasini ko‘rish
    - img
  - button "Signal tayyorligini tekshirish":
    - text: Signal tayyorligini tekshirish
    - img
```

# Test source

```ts
  75  | 
  76  |   await checkpoint(page, "20:30");
  77  |   await page.locator(".family-today > summary").click();
  78  |   await page.locator(".family-today").getByRole("button", { name: /^Choose our weekend outing / }).click();
  79  |   await dialog(page).getByRole("button", { name: /^Family shared lists / }).click();
  80  |   await expect(dialog(page).getByRole("button", { name: "Lists", exact: true })).toHaveAttribute("aria-pressed", "true");
  81  |   await dialog(page).getByRole("button", { name: /^For the week / }).click();
  82  |   await dialog(page).getByRole("checkbox", { name: "Check Apples", exact: true }).check();
  83  |   await page.keyboard.press("Escape");
  84  |   await page.keyboard.press("Escape");
  85  |   await expect(dialog(page).getByRole("heading", { name: "Choose our weekend outing", exact: true })).toBeVisible();
  86  |   await dialog(page).getByRole("button", { name: "Mark as done", exact: true }).click();
  87  |   await page.keyboard.press("Escape");
  88  |   await tab(page, "Progress");
  89  |   await expect(page.locator("#panel-progress")).toContainText("5 prayers on time");
  90  |   await expect(page.locator("#panel-progress")).toContainText("3 of 4 checked in");
  91  |   await expect(page.locator("#panel-progress")).toContainText("1 personal reward earned");
  92  |   await page.getByRole("tab", { name: "Goals", exact: true }).click();
  93  |   await page.getByRole("button", { name: /^Launch a small vibecoded project / }).click();
  94  |   await dialog(page).getByRole("button", { name: "Complete Build the first working screen", exact: true }).click();
  95  |   await page.keyboard.press("Escape");
  96  |   await page.getByRole("tab", { name: "Overview", exact: true }).click();
  97  |   await expect(page.locator("#panel-progress")).toContainText("1 milestone completed");
  98  |   await page.getByRole("button", { name: /^Rewards in Journey / }).click();
  99  |   await page.locator("#panel-journey").getByRole("button", { name: /^A slow coffee at my favorite café / }).click();
  100 |   await dialog(page).getByRole("button", { name: "Mark as enjoyed", exact: true }).click();
  101 |   await page.keyboard.press("Escape");
  102 |   expect(xpTotal(await stored(page))).toBe(280);
  103 | 
  104 |   await checkpoint(page, "22:00");
  105 |   await tab(page, "You");
  106 |   await page.getByRole("button", { name: /^Prayer preferences / }).click();
  107 |   await dialog(page).getByRole("button", { name: /^Prepare for Fajr / }).click();
  108 |   await expect(dialog(page)).toContainText("Fajr plan for Tuesday, Oct 20.");
  109 |   await dialog(page).getByRole("textbox", { name: "A message from your evening self", exact: true }).fill("Feet on the floor. I have made room for this.");
  110 |   await dialog(page).getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  111 |   await expect(dialog(page).getByRole("status")).toHaveText("Plan saved on this device.");
  112 |   await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  113 |   await expect(page.getByRole("heading", { name: "Your day, Mamur.", exact: true })).toBeFocused();
  114 |   await expect(page.locator("#panel-today")).toContainText("Fajr plan saved");
  115 |   const final = await stored(page);
  116 |   expect(PRAYERS.every(({ id }) => final.prayers.days[date].entries[id].check === "on_time")).toBe(true);
  117 |   expect(final.dailyPriorities[date]).toEqual(initial.dailyPriorities[date]);
  118 |   expect(final.life.tasks.find((t) => t.id === "weekend")!.completions[date]).toBeTruthy();
  119 |   expect(final.life.lists[0].items.find((i) => i.id === "apples")!.checked).toBe(true);
  120 |   expect(final.personalRewards.find((r) => r.id === "coffee")!.enjoyedOn).toBe(date);
  121 |   expect(final.prayers.prepared["2026-10-20"].message).toBe("Feet on the floor. I have made room for this.");
  122 |   expect(PRAYERS.every(({ id }) => !final.prayers.days["2026-10-20"].entries[id].check)).toBe(true);
  123 |   await reloadSaved(page);
  124 |   expect(await stored(page)).toEqual(final);
  125 | });
  126 | 
  127 | test("Fajr acknowledgment follows explicit corrections and never records a prayer by itself", async ({ page }) => {
  128 |   await start(page);
  129 |   await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  130 |   await dialog(page).getByRole("button", { name: "View Fajr time", exact: true }).click();
  131 |   await expect(dialog(page).getByRole("button", { name: "Prayed on time", exact: true })).toBeDisabled();
  132 |   await checkpoint(page, "05:35");
  133 |   await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  134 |   await page.keyboard.press("Escape");
  135 |   await expect(dialog(page)).toContainText("Fajr recorded on time.");
  136 |   await dialog(page).getByRole("button", { name: "View Fajr record", exact: true }).click();
  137 |   await dialog(page).getByRole("button", { name: "Undo this record", exact: true }).click();
  138 |   await page.keyboard.press("Escape");
  139 |   await expect(dialog(page)).toContainText("No prayer recorded.");
  140 |   await expect(dialog(page)).toContainText("Record Fajr when you’re finished.");
  141 |   await checkpoint(page, "08:00");
  142 |   await dialog(page).getByRole("button", { name: "Record Fajr", exact: true }).click();
  143 |   await dialog(page).getByRole("button", { name: "Prayed later", exact: true }).click();
  144 |   await page.keyboard.press("Escape");
  145 |   await expect(dialog(page)).toContainText("Fajr recorded as prayed later.");
  146 |   expect(xpTotal(await stored(page))).toBe(230);
  147 | });
  148 | 
  149 | test("Fajr plans keep their displayed date, preserve drafts and distinguish saving from alarm delivery", async ({ page }) => {
  150 |   await start(page);
  151 |   await page.keyboard.press("Escape");
  152 |   await tab(page, "You");
  153 |   await page.getByRole("button", { name: /^Prayer preferences / }).click();
  154 |   await dialog(page).getByRole("button", { name: /^Prepare for Fajr / }).click();
  155 |   await expect(dialog(page)).toContainText("Fajr plan for Monday, Oct 19.");
  156 |   await dialog(page).getByRole("textbox", { name: "A message from your evening self", exact: true }).fill("A date-specific morning message.");
  157 |   await checkpoint(page, "05:35");
  158 |   await expect(dialog(page)).toContainText("Fajr plan for Monday, Oct 19.");
  159 |   await dialog(page).getByRole("button", { name: "Check alarm readiness", exact: true }).click();
  160 |   await page.keyboard.press("Escape");
  161 |   await expect(dialog(page).getByRole("textbox", { name: "A message from your evening self", exact: true })).toHaveValue("A date-specific morning message.");
  162 |   await dialog(page).getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  163 |   await expect(dialog(page).getByRole("status")).toContainText("Plan saved on this device.");
  164 |   expect((await stored(page)).prayers.prepared[date].message).toBe("A date-specific morning message.");
  165 |   expect((await stored(page)).prayers.prepared["2026-10-20"]).toBeUndefined();
  166 |   await dialog(page).getByLabel("Wake before Fajr", { exact: true }).selectOption("15");
  167 |   await expect(dialog(page).getByRole("status")).toHaveCount(0);
  168 |   const state = await stored(page);
  169 |   state.life.language = "uz";
  170 |   await replaceStored(page, state);
  171 |   await page.goto("/?review=1&text=large");
  172 |   await page.getByRole("tab", { name: "Siz", exact: true }).click();
  173 |   await page.getByRole("button", { name: /^Namoz sozlamalari / }).click();
  174 |   await dialog(page).getByRole("button", { name: /^Bomdodga tayyorlanish / }).click();
> 175 |   await expect(dialog(page)).toContainText("20.10.2026 uchun bomdod rejasi.");
      |                              ^ Error: expect(locator).toContainText(expected) failed
  176 |   await expect(dialog(page).getByRole("combobox", { name: "Bomdoddan oldin uyg‘onish", exact: true })).toHaveValue("15");
  177 |   for (const width of [375, 393, 430]) {
  178 |     await page.setViewportSize({ width, height: 852 });
  179 |     expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  180 |     expect(await dialog(page).locator(".fajr-preview-times strong").evaluateAll((times) => times.every((time) => {
  181 |       const range = document.createRange(); range.selectNodeContents(time);
  182 |       return range.getClientRects().length === 1;
  183 |     }))).toBe(true);
  184 |     expect(await dialog(page).locator(".sheet-header h2").evaluate((heading) => {
  185 |       const title = heading.getBoundingClientRect(), header = heading.closest(".sheet-header")!.getBoundingClientRect();
  186 |       return title.top >= header.top && title.bottom <= header.bottom;
  187 |     })).toBe(true);
  188 |   }
  189 | });
  190 | 
```