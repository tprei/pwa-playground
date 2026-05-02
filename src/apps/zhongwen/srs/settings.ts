import type { SiteStorage } from "../../../platform/types";

export interface SrsSettings {
  newPerDay: number;
  reviewsPerDay: number;
}

export interface DailyCounters {
  newCount: number;
  reviewCount: number;
}

export const defaultSettings: SrsSettings = {
  newPerDay: 10,
  reviewsPerDay: 50,
};

const SETTINGS_KEY = "srs:settings";
const COUNTERS_PREFIX = "srs:counters:";

export function readSettings(storage: SiteStorage): SrsSettings {
  const raw = storage.get(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  try {
    const parsed = JSON.parse(raw) as Partial<SrsSettings>;
    return {
      newPerDay: typeof parsed.newPerDay === "number" ? parsed.newPerDay : defaultSettings.newPerDay,
      reviewsPerDay:
        typeof parsed.reviewsPerDay === "number"
          ? parsed.reviewsPerDay
          : defaultSettings.reviewsPerDay,
    };
  } catch {
    return defaultSettings;
  }
}

export function writeSettings(storage: SiteStorage, settings: SrsSettings): void {
  storage.set(SETTINGS_KEY, JSON.stringify(settings));
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function readCounters(storage: SiteStorage, now: number): DailyCounters {
  const raw = storage.get(COUNTERS_PREFIX + dayKey(now));
  if (!raw) return { newCount: 0, reviewCount: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<DailyCounters>;
    return {
      newCount: typeof parsed.newCount === "number" ? parsed.newCount : 0,
      reviewCount: typeof parsed.reviewCount === "number" ? parsed.reviewCount : 0,
    };
  } catch {
    return { newCount: 0, reviewCount: 0 };
  }
}

export function writeCounters(storage: SiteStorage, now: number, counters: DailyCounters): void {
  storage.set(COUNTERS_PREFIX + dayKey(now), JSON.stringify(counters));
}
