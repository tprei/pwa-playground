import { useState } from "react";
import type { PlaygroundAppProps } from "../../platform/types";
import Reader from "./reader/Reader";
import Onboarding from "./screens/Onboarding";

type Screen = "onboarding" | "reader";

const ONBOARDING_FLAG = "settings:firstLaunchDone";

export default function ZhongwenApp({ site, storage }: PlaygroundAppProps) {
  const [screen, setScreen] = useState<Screen>(() => {
    const onboarded = storage.get(ONBOARDING_FLAG) === "true";
    return onboarded ? "reader" : "onboarding";
  });

  return (
    <>
      {screen === "onboarding" && (
        <Onboarding
          site={site}
          storage={storage}
          onComplete={() => setScreen("reader")}
        />
      )}
      {screen === "reader" && (
        <Reader
          site={site}
          storage={storage}
        />
      )}
    </>
  );
}
