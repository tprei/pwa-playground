import { useState } from "react";
import { createSiteDatabase } from "../../platform/database";
import { createSiteStorage } from "../../platform/storage";
import type { PlaygroundAppProps } from "../../platform/types";
import { zhongwenSchema } from "./model/schema";
import { createSchedulerWith } from "./srs/scheduler";
import Library from "./screens/Library";
import Onboarding from "./screens/Onboarding";

type Screen = "onboarding" | "library";

const ONBOARDING_FLAG = "settings:firstLaunchDone";

export default function ZhongwenApp({ site }: PlaygroundAppProps) {
  const storage = createSiteStorage(site);
  const db = createSiteDatabase(site, zhongwenSchema);
  const [screen, setScreen] = useState<Screen>(() => {
    const onboarded = storage.get(ONBOARDING_FLAG) === "true";
    return onboarded ? "library" : "onboarding";
  });

  const scheduler = createSchedulerWith(site, storage, db);

  return (
    <>
      {screen === "onboarding" && (
        <Onboarding site={site} storage={storage} onComplete={() => setScreen("library")} />
      )}
      {screen === "library" && (
        <Library site={site} scheduler={scheduler} confirm={confirm} />
      )}
    </>
  );
}
