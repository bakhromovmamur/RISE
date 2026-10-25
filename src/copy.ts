/** Shared product language. Single-use screen copy is grouped in its screen module.
 * Date/number formatting is centralized in model.ts; this module is the first
 * locale boundary for recurring states, navigation and feedback. */
export const copy = {
  tabs: {
    today: "Today",
    journey: "Journey",
    progress: "Progress",
    you: "You",
  },
  check: {
    full: "Full target completed.",
    tiny: "Tiny version completed.",
    upgrade: "Upgrade to full target",
    undo: "Undo check-in",
  },
  feedback: {
    tiny: "You showed up. +10 XP",
    full: "That’s your full target. +20 XP",
    upgrade: "Full target reached. +10 XP",
    undo: "Check-in undone. XP and rewards recalculated.",
  },
  promise: "Small actions. A stronger you.",
};
