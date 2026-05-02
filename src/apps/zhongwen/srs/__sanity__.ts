import { applyGrade, initialFsrsState } from "./fsrs";
import type { FsrsCardState } from "../model/types";

const DAY_MS = 86_400_000;

let now = Date.parse("2026-01-01T00:00:00Z");
let state: FsrsCardState = initialFsrsState(now);

console.log("initial:", format(state, now));

for (let i = 1; i <= 4; i += 1) {
  now += DAY_MS;
  const result = applyGrade(state, "good", now);
  state = result.next;
  console.log(`good #${i}:`, format(state, now));
}

function format(s: FsrsCardState, reviewedAt: number) {
  const dueOffsetDays = (s.due - reviewedAt) / DAY_MS;
  return {
    state: s.state,
    reps: s.reps,
    lapses: s.lapses,
    stability: round(s.stability, 3),
    difficulty: round(s.difficulty, 3),
    scheduledDays: s.scheduledDays,
    dueOffsetDays: round(dueOffsetDays, 3),
    due: new Date(s.due).toISOString(),
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
