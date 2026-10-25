import { checkIn, ensureDays, suggestions, type State, type Check } from "../model";
import { createEmptyState } from "../data/initialState";
import { makePrayerState } from "../prayerModel";

function base(mode: State["mode"]): State {
  const empty = createEmptyState();
  if (mode === "fresh") return { ...empty, demoDate: "2026-10-19" };
  return { ...empty, mode: "demo", demoDate: "2026-10-19", timezone: "Asia/Tashkent",
    name: "Mamur", onboarded: true, prayers: makePrayerState("demo", "2026-10-19", "Asia/Tashkent") };
}
export function makeFixture(
  mode: "demo" | "fresh" | "return" | "complete" | "rest" = "demo",
): State {
  if (mode === "fresh") return base("fresh");
  let s = base("demo");
  s.habits = suggestions
    .slice(0, 3)
    .map((d, i) => ({
      id: ["read", "walk", "english"][i],
      name: d.name,
      icon: d.icon,
      area: d.area,
      reason: d.reason,
      type: d.type,
      unit: d.unit,
      created: "2026-10-12",
      versions: [
        {
          effective: "2026-10-12",
          full: d.full,
          tiny: d.tiny,
          days: d.days,
          cue: d.cue,
          reminder: "",
        },
      ],
    }));
  s = ensureDays(s);
  const fixture: Record<string, Record<string, Check>> = {
    "2026-10-12": { read: "full", walk: "tiny", english: "full" },
    "2026-10-13": { read: "tiny", english: "full" },
    "2026-10-14": { read: "full", walk: "full" },
    "2026-10-15": { read: "tiny", english: "full" },
    "2026-10-16": { read: "full", english: "tiny" },
    "2026-10-17": { read: "full" },
    "2026-10-18": { read: "full", walk: "full" },
  };
  for (const [d, checks] of Object.entries(fixture))
    for (const o of s.days[d]) o.check = checks[o.habitId];
  s.claimed = [100];
  if (mode === "return") {
    s.demoDate = "2026-10-20";
    s = ensureDays(s);
  }
  if (mode === "complete") {
    s = checkIn(s, "read", "tiny");
    s = checkIn(s, "walk", "full");
    s = checkIn(s, "english", "full");
  }
  if (mode === "rest") {
    s.habits.forEach((h) =>
      h.versions.push({
        ...h.versions[0],
        effective: "2026-10-19",
        days: [2, 3, 4, 5, 6, 0],
      }),
    );
    s.days["2026-10-19"] = [];
  }
  return s;
}
