import type { PlaygroundAppModule } from "./types";

export const appLoaders = import.meta.glob<PlaygroundAppModule>("../apps/*/entry.tsx");
