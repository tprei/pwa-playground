import {
  Rating,
  State,
  createEmptyCard,
  fsrs as createFsrs,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";
import type { FsrsCardState, FsrsState, ReviewGrade } from "../model/types";

const fsrsInstance = createFsrs({});

export function fsrs() {
  return fsrsInstance;
}

const stateToDomain: Record<State, FsrsState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const domainToState: Record<FsrsState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const gradeToRating: Record<ReviewGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function initialFsrsState(now: number): FsrsCardState {
  return toDomainState(createEmptyCard(new Date(now)));
}

export function applyGrade(
  state: FsrsCardState,
  grade: ReviewGrade,
  now: number,
): { next: FsrsCardState; log: RecordLogItem["log"] } {
  const card = toFsrsCard(state);
  const result = fsrsInstance.next(card, new Date(now), gradeToRating[grade]);
  return { next: toDomainState(result.card), log: result.log };
}

function toFsrsCard(state: FsrsCardState): FsrsCard {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: 0,
    reps: state.reps,
    lapses: state.lapses,
    state: domainToState[state.state],
    last_review: state.lastReview === undefined ? undefined : new Date(state.lastReview),
  };
}

function toDomainState(card: FsrsCard): FsrsCardState {
  return {
    state: stateToDomain[card.state],
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ? card.last_review.getTime() : undefined,
  };
}
