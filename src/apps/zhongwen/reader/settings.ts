import type { SiteStorage } from "../../../platform/types";

const READER_ALWAYS_SHOW_PINYIN_KEY = "reader:alwaysShowPinyin";

export interface ReaderSettings {
  alwaysShowPinyin: boolean;
}

export function readReaderSettings(storage: SiteStorage): ReaderSettings {
  return {
    alwaysShowPinyin: storage.get(READER_ALWAYS_SHOW_PINYIN_KEY) === "true",
  };
}

export function writeAlwaysShowPinyin(storage: SiteStorage, value: boolean): void {
  storage.set(READER_ALWAYS_SHOW_PINYIN_KEY, value ? "true" : "false");
}
