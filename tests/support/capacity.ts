import { createEmptyState } from "../../src/data/initialState";
import { addDays, occurrence, type State } from "../../src/model";

/** Dense synthetic NFR workload; never derived from an exported user profile. */
export function capacityProfile(date: string, habitCount = 100, dayCount = 730): State {
  const started = addDays(date, 1 - dayCount), state = createEmptyState();
  state.name = "Synthetic capacity profile";
  state.timezone = "UTC"; state.demoDate = date; state.onboarded = true;
  state.prayers.started = started;
  state.habits = Array.from({ length: habitCount }, (_, i) => ({
    id: `capacity-habit-${i}`, name: `Synthetic habit ${i}`, icon: "book", area: "personal",
    reason: "", type: "count", unit: "pages", created: started,
    versions: [{ effective: started, full: 20, tiny: 2, days: [0, 1, 2, 3, 4, 5, 6], cue: "", reminder: "" }],
  }));
  for (let d = started; d <= date; d = addDays(d, 1)) {
    state.days[d] = state.habits.map((habit, i) => ({ ...occurrence(habit, d),
      ...(d === date && i === 0 ? {} : { check: i % 5 === 0 ? "tiny" as const : "full" as const }),
    }));
  }
  return state;
}
