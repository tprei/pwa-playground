import { useState } from "react";
import { createSiteStorage } from "../../platform/storage";
import type { PlaygroundAppProps } from "../../platform/types";
import Library from "./screens/Library";
import Onboarding from "./screens/Onboarding";

type Screen = "onboarding" | "library";

const ONBOARDING_FLAG = "settings:firstLaunchDone";

export default function ZhongwenApp({ site }: PlaygroundAppProps) {
  const storage = createSiteStorage(site);
  const [screen, setScreen] = useState<Screen>(() => {
    const onboarded = storage.get(ONBOARDING_FLAG) === "true";
    return onboarded ? "library" : "onboarding";
  });

  return (
    <>
      {screen === "onboarding" && (
        <Onboarding site={site} storage={storage} onComplete={() => setScreen("library")} />
      )}
      {screen === "library" && <Library site={site} confirm={confirm} />}
    </>
  );
}
