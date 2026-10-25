# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: parity.visual.spec.ts >> en-dark-1440x1000-100
- Location: tests/visual/parity.visual.spec.ts:23:9

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('.app-shell')
Timeout: 5000ms
  Timeout 5000ms exceeded.

  Snapshot: en-dark-1440x1000-100/journey.png

Call log:
  - Expect "toHaveScreenshot(en-dark-1440x1000-100/journey.png)" locator('.app-shell') with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('.app-shell')
    - locator resolved to <div data-theme="dark" class="app-shell reduce-motion">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Timeout 5000ms exceeded.

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - link "RISE" [ref=e5] [cursor=pointer]:
      - /url: ./
      - text: rise
    - generic [ref=e10]:
      - heading "A complete day. Salah at its heart." [level=2] [ref=e11]
      - paragraph [ref=e12]: Five daily anchors, small steps, and meaningful things to work toward.
    - generic [ref=e13]:
      - heading "Review the prototype" [level=3] [ref=e17]
      - generic [ref=e18]:
        - text: Starting point
        - combobox "Demo fixture" [ref=e19]:
          - option "Daily life · prayer, habits & family" [selected]
          - option "Full day · Fajr to bedtime"
          - option "Difficult day · one small step"
          - option "Family planning · tasks & lists"
          - option "Squad reflection · share your week"
          - option "Fajr morning · alarm simulation"
          - option "Prayer pause · private space"
          - option "Needs attention · device preview"
          - option "Balanced day · goals & habits"
          - option "Busy day · 12 habits"
          - option "Prayer due · Asr pause"
          - option "Three priorities complete"
          - option "A personal reward earned"
          - option "Ten minutes before Asr"
          - option "Fajr · wake-up"
          - option "Evening · prepare for Fajr"
          - option "All five on time"
          - option "An unconfirmed Fajr"
          - option "Fresh Start · onboarding"
          - option "Returning after a missed day"
          - option "All checked in · mixed"
          - option "Planned rest day"
          - option "Empty · set up your day"
      - button "Load selected fixture" [ref=e20] [cursor=pointer]
      - generic [ref=e24]: Replaces this browser’s saved prototype data.
      - generic [ref=e26]:
        - generic [ref=e27]: Frozen demo calendar
        - strong [ref=e28]: Oct 19, 2026
        - generic [ref=e29]: Asia/Tashkent
        - strong [ref=e30]: 14:00
        - generic [ref=e31]:
          - text: Day checkpoint
          - combobox "Day checkpoint" [ref=e32]:
            - option "Choose a moment" [disabled] [selected]
            - option "05:10 · Fajr · wake-up"
            - option "05:35 · After Fajr · record your prayer"
            - option "08:00 · Morning · reading & a walk"
            - option "12:20 · Dhuhr"
            - option "15:35 · Before Asr · save your work"
            - option "15:45 · Asr"
            - option "17:45 · Maghrib"
            - option "18:00 · After Asr’s window · return to your day"
            - option "19:05 · Isha"
            - option "20:30 · Family time & rewards"
            - option "22:00 · Bedtime · prepare for Fajr"
          - generic [ref=e33]: Moves the demo clock. Keeps your records.
        - generic [ref=e34]:
          - text: Demo clock
          - textbox "Demo clock" [ref=e35]: 14:00
      - button "Advance one local day" [ref=e36] [cursor=pointer]
      - button "Design system" [ref=e40] [cursor=pointer]
      - button "Export local data" [ref=e49] [cursor=pointer]
      - paragraph [ref=e55]: 240 XP · 8 planned days Unlimited habits · Personal prototype
    - generic [ref=e56]: Local prototype · No account needed
  - generic [ref=e58]:
    - generic [ref=e59]:
      - generic [ref=e60]: RISE / MOBILE EXPERIENCE
      - generic [ref=e61]: A BALANCED DAY
    - generic [ref=e62]:
      - generic [ref=e63]:
        - status [ref=e64]: Saved on this device
        - tabpanel "Journey" [ref=e66]:
          - generic [ref=e67]:
            - banner [ref=e68]:
              - heading "Your journey" [level=1] [ref=e69]
            - region "Your next Pip unlock" [ref=e70]:
              - generic [ref=e71]:
                - generic [ref=e72]:
                  - heading "Pip’s next unlock" [level=2] [ref=e73]
                  - paragraph [ref=e74]: Linen scarf for Pip
                  - paragraph [ref=e75]: 10 XP to go
                - img "Pip, your welcoming seed companion" [ref=e76]
              - progressbar "Lifetime habit XP toward Linen scarf for Pip" [ref=e77]
              - paragraph [ref=e79]: 240 / 250 lifetime habit XP
              - button "Preview this unlock" [ref=e80] [cursor=pointer]
            - generic [ref=e83]:
              - generic [ref=e84]:
                - heading "Personal rewards" [level=2] [ref=e85]
                - button "Add personal reward" [ref=e86] [cursor=pointer]: Add
              - button "A slow coffee at my favorite café Working toward 1/5 check-ins · Oct 19–Oct 25" [ref=e88] [cursor=pointer]:
                - strong [ref=e90]: A slow coffee at my favorite café
                - generic [ref=e93]: Working toward
                - progressbar [ref=e95]
                - generic [ref=e97]: 1/5 check-ins · Oct 19–Oct 25
              - group [ref=e98]:
                - generic "All rewards & history 2 saved · personal rewards" [ref=e99] [cursor=pointer]:
                  - generic [ref=e104]:
                    - strong [ref=e105]: All rewards & history
                    - generic [ref=e106]: 2 saved · personal rewards
            - group [ref=e109]:
              - generic "Explore Pip’s trail 1 of 5 unlocks collected" [ref=e110] [cursor=pointer]:
                - generic [ref=e115]:
                  - strong [ref=e116]: Explore Pip’s trail
                  - generic [ref=e117]: 1 of 5 unlocks collected
            - button "Pip’s collection Dress Pip and revisit your keepsakes" [ref=e121] [cursor=pointer]:
              - generic [ref=e125]:
                - strong [ref=e126]: Pip’s collection
                - generic [ref=e127]: Dress Pip and revisit your keepsakes
            - paragraph [ref=e130]: Small steps. Little celebrations. Your own pace.
        - tablist "Main navigation" [ref=e131]:
          - tab "Today" [ref=e132] [cursor=pointer]
          - tab "Journey" [active] [selected] [ref=e138] [cursor=pointer]
          - tab "Progress" [ref=e144] [cursor=pointer]
          - tab "You" [ref=e149] [cursor=pointer]
      - status
    - generic [ref=e155]: Make space for what matters.
  - complementary [ref=e160]:
    - paragraph [ref=e162]: A little focus. A fuller life.
    - generic [ref=e163]: Prayer. Progress. Room to grow.
    - img "Pip, your resting seed companion" [ref=e165]
```

# Test source

```ts
  1   | import { createHash } from "node:crypto";
  2   | import { test, expect, stored, type Page } from "../support/browser";
  3   | import { balancedFixture, localizeFixture } from "../../src/demo";
  4   | import { addLifeDemo } from "../../src/lifeModel";
  5   | import { STORAGE_KEY } from "../../src/model";
  6   | 
  7   | const viewports = [
  8   |   { width: 375, height: 852 },
  9   |   { width: 393, height: 852 },
  10  |   { width: 430, height: 852 },
  11  |   { width: 1440, height: 1000 },
  12  | ];
  13  | 
  14  | async function closeSheets(page: Page) {
  15  |   while (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  16  | }
  17  | 
  18  | for (const language of ["en", "ru", "uz"] as const) {
  19  |   for (const appearance of ["light", "dark"] as const) {
  20  |     for (const textScale of [100, 200]) {
  21  |       for (const viewport of viewports) {
  22  |         const variant = `${language}-${appearance}-${viewport.width}x${viewport.height}-${textScale}`;
  23  |         test(variant, async ({ page, browser, baseURL }, testInfo) => {
  24  |           // Never seed an origin chosen by a caller, an existing user profile, or production.
  25  |           expect(baseURL).toBe("http://127.0.0.1:4182");
  26  |           await page.setViewportSize(viewport);
  27  |           const state = localizeFixture(addLifeDemo(balancedFixture(), "daily-life"), language);
  28  |           state.prefs.appearance = appearance;
  29  |           state.prefs.reduceMotion = true;
  30  |           const fixtureJson = JSON.stringify(state);
  31  |           await page.addInitScript(({ key, value }) => {
  32  |             if (location.origin === "http://127.0.0.1:4182" && !localStorage.getItem(key)) {
  33  |               localStorage.setItem(key, value);
  34  |             }
  35  |           }, { key: STORAGE_KEY, value: fixtureJson });
  36  |           await page.goto(textScale === 200 ? "/?text=large" : "/");
  37  |           await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", appearance);
  38  |           await expect(page.locator("html")).toHaveAttribute("lang", language);
  39  |           expect(await page.locator("html").evaluate(el => getComputedStyle(el).fontSize)).toBe(textScale === 200 ? "32px" : "16px");
  40  | 
  41  |           const capture = async (name: string) => {
  42  |             await page.evaluate(async () => {
  43  |               await document.fonts.ready;
  44  |               await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => undefined)));
  45  |             });
> 46  |             await expect(page.locator(".app-shell")).toHaveScreenshot(`${variant}/${name}.png`);
      |                                                      ^ Error: expect(locator).toHaveScreenshot(expected) failed
  47  |           };
  48  | 
  49  |           for (const tab of ["today", "journey", "progress", "you"]) {
  50  |             await page.locator(`#tab-${tab}`).click();
  51  |             await expect(page.locator(`#panel-${tab}`)).toBeVisible();
  52  |             await capture(tab);
  53  |           }
  54  |           await page.locator("#tab-today").click();
  55  |           await page.locator(".today-focus .section-title button").click();
  56  |           await expect(page.getByRole("dialog")).toBeVisible();
  57  |           await capture("priorities");
  58  |           await closeSheets(page);
  59  |           await page.locator(".priority-list .habit-main").first().click();
  60  |           await expect(page.getByRole("dialog")).toBeVisible();
  61  |           await capture("habit-detail");
  62  |           await closeSheets(page);
  63  |           await page.locator("#tab-journey").click();
  64  |           await page.locator(".personal-spotlight").click();
  65  |           await expect(page.getByRole("dialog")).toBeVisible();
  66  |           await capture("personal-reward");
  67  |           await closeSheets(page);
  68  |           await page.locator("#tab-progress").click();
  69  |           await page.locator(".progress-views [role=tab]").last().click();
  70  |           await page.locator("#panel-progress .goal-row").first().click();
  71  |           await expect(page.getByRole("dialog")).toBeVisible();
  72  |           await capture("goal-detail");
  73  |           await closeSheets(page);
  74  |           await page.locator("#tab-you").click();
  75  |           await page.locator(".you-destinations button").nth(0).click();
  76  |           await capture("prayer-preferences");
  77  |           for (const [index, name] of [[0, "prayer-setup"], [2, "fajr-plan"], [4, "private-pause"]] as const) {
  78  |             await page.locator(".preferences-hub .group-row").nth(index).click();
  79  |             await capture(name);
  80  |             await page.keyboard.press("Escape");
  81  |           }
  82  |           await closeSheets(page);
  83  |           for (const [index, name] of [[1, "family"], [2, "squad"]] as const) {
  84  |             await page.locator(".you-destinations button").nth(index).click();
  85  |             await page.locator(".people-group").first().click();
  86  |             await capture(name);
  87  |             await closeSheets(page);
  88  |           }
  89  |           await page.locator(".you-destinations button").nth(3).click();
  90  |           await capture("settings");
  91  |           await closeSheets(page);
  92  | 
  93  |           const after = await stored(page);
  94  |           expect(after.days).toEqual(state.days);
  95  |           expect(after.prayers.days).toEqual(state.prayers.days);
  96  |           expect(after.goals).toEqual(state.goals);
  97  |           expect(after.personalRewards).toEqual(state.personalRewards);
  98  |           await testInfo.attach("capture-metadata", {
  99  |             contentType: "application/json",
  100 |             body: JSON.stringify({
  101 |               fixture: "daily-life", fixtureSha256: createHash("sha256").update(fixtureJson).digest("hex"),
  102 |               fixtureDate: state.demoDate, viewport, language, appearance, textScale,
  103 |               browser: browser.version(), platform: process.platform, deviceScaleFactor: 1,
  104 |               reducedMotion: true, origin: baseURL,
  105 |             }, null, 2),
  106 |           });
  107 |         });
  108 |       }
  109 |     }
  110 |   }
  111 | }
  112 | 
```