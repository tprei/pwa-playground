import { lazy, Suspense, useEffect, useMemo } from "react";
import { appLoaders } from "./appLoaders";
import { createSiteStorage } from "./storage";
import { getCurrentSite, listSites } from "./siteRegistry";
import { configurePwaForSite } from "./pwa";
import type { PlaygroundAppProps } from "./types";

const listedSites = listSites();

export function PlaygroundRouter() {
  const site = getCurrentSite(window.location.pathname);
  const App = useMemo(() => {
    if (!site) return null;
    const loader = appLoaders[`../apps/${site.slug}/entry.tsx`];
    if (!loader) return null;
    return lazy(async () => {
      const mod = await loader();
      return { default: mod.default };
    });
  }, [site]);

  useEffect(() => {
    if (!site) return;
    configurePwaForSite(site);
  }, [site]);

  if (!site || !App) {
    return <Directory />;
  }

  const props: PlaygroundAppProps = {
    site,
    storage: createSiteStorage(site),
  };

  return (
    <Suspense fallback={<Loading title={site.title} />}>
      <App {...props} />
    </Suspense>
  );
}

function Directory() {
  return (
    <main className="directory">
      <section className="directory__content">
        <p className="eyebrow">PWA playground</p>
        <h1>Choose a route</h1>
        <div className="directory__grid">
          {listedSites.map((site) => (
            <a className="directory__item" href={`/${site.slug}/`} key={site.slug}>
              <span>{site.title}</span>
              <small>/{site.slug}/</small>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function Loading({ title }: { title: string }) {
  return (
    <main className="loading">
      <span>{title}</span>
    </main>
  );
}
