import {mkdirSync} from "node:fs";
mkdirSync("/tmp/rise-quality02-final-captures",{recursive:true});
import { createHash } from "node:crypto";
import { test, expect, stored, type Page } from "../support/browser";
import { balancedFixture, localizeFixture } from "../../src/demo";
import { addLifeDemo } from "../../src/lifeModel";
import { STORAGE_KEY } from "../../src/model";

const viewports = [
  { width: 375, height: 852 },
  { width: 393, height: 852 },
  { width: 430, height: 852 },
  { width: 1440, height: 1000 },
];

async function closeSheets(page: Page) {
  while (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
}

for (const language of ["en", "ru", "uz"] as const) {
  for (const appearance of ["light", "dark"] as const) {
    for (const textScale of [100, 200]) {
      for (const viewport of viewports) {
        const variant = `${language}-${appearance}-${viewport.width}x${viewport.height}-${textScale}`;
        test(variant, async ({ page, browser, baseURL }, testInfo) => {
          // Never seed an origin chosen by a caller, an existing user profile, or production.
          expect(baseURL).toBe("http://127.0.0.1:4182");
          await page.setViewportSize(viewport);
          const state = localizeFixture(addLifeDemo(balancedFixture(), "daily-life"), language);
          state.prefs.appearance = appearance;
          state.prefs.reduceMotion = true;
          const fixtureJson = JSON.stringify(state);
          await page.addInitScript(({ key, value }) => {
            if (location.origin === "http://127.0.0.1:4182" && !localStorage.getItem(key)) {
              localStorage.setItem(key, value);
            }
          }, { key: STORAGE_KEY, value: fixtureJson });
          await page.goto(textScale === 200 ? "/?text=large" : "/");
          await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", appearance);
          await expect(page.locator("html")).toHaveAttribute("lang", language);
          expect(await page.locator("html").evaluate(el => getComputedStyle(el).fontSize)).toBe(textScale === 200 ? "32px" : "16px");

          const capture = async (name: string) => {
            await page.evaluate(async () => {
              await document.fonts.ready;
              await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => undefined)));
            });
            await page.locator(".app-shell").screenshot({path:`/tmp/rise-quality02-final-captures/${variant}-${name}.png`,animations:"disabled",caret:"hide",scale:"css"});
          };

          for (const tab of ["today", "journey", "progress", "you"]) {
            await page.locator(`#tab-${tab}`).click();
            await expect(page.locator(`#panel-${tab}`)).toBeVisible();
            await capture(tab);
          }
          await page.locator("#tab-today").click();
          await page.locator(".today-focus .section-title button").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("priorities");
          await closeSheets(page);
          await page.locator(".priority-list .habit-main").first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("habit-detail");
          await closeSheets(page);
          await page.locator("#tab-journey").click();
          await page.locator(".personal-spotlight").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("personal-reward");
          await closeSheets(page);
          await page.locator("#tab-progress").click();
          await page.locator(".progress-views [role=tab]").last().click();
          await page.locator("#panel-progress .goal-row").first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("goal-detail");
          await closeSheets(page);
          await page.locator("#tab-you").click();
          await page.locator(".you-destinations button").nth(0).click();
          await capture("prayer-preferences");
          for (const [index, name] of [[0, "prayer-setup"], [2, "fajr-plan"], [4, "private-pause"]] as const) {
            await page.locator(".preferences-hub .group-row").nth(index).click();
            await capture(name);
            await page.keyboard.press("Escape");
          }
          await closeSheets(page);
          for (const [index, name] of [[1, "family"], [2, "squad"]] as const) {
            await page.locator(".you-destinations button").nth(index).click();
            await page.locator(".people-group").first().click();
            await capture(name);
            await closeSheets(page);
          }
          await page.locator(".you-destinations button").nth(3).click();
          await capture("settings");
          await closeSheets(page);

          const after = await stored(page);
          expect(after.days).toEqual(state.days);
          expect(after.prayers.days).toEqual(state.prayers.days);
          expect(after.goals).toEqual(state.goals);
          expect(after.personalRewards).toEqual(state.personalRewards);
          await testInfo.attach("capture-metadata", {
            contentType: "application/json",
            body: JSON.stringify({
              fixture: "daily-life", fixtureSha256: createHash("sha256").update(fixtureJson).digest("hex"),
              fixtureDate: state.demoDate, viewport, language, appearance, textScale,
              browser: browser.version(), platform: process.platform, deviceScaleFactor: 1,
              reducedMotion: true, origin: baseURL,
            }, null, 2),
          });
        });
      }
    }
  }
}
