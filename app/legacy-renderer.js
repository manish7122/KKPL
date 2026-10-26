'use client';

import { useEffect, useLayoutEffect } from 'react';

const legacyScriptLoads = new Map();

function loadLegacyScript(src) {
  const existingLoad = legacyScriptLoads.get(src);
  if (existingLoad) return existingLoad;

  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  const load = new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}.`));
  });

  legacyScriptLoads.set(src, load);
  document.body.appendChild(script);
  load.catch(() => legacyScriptLoads.delete(src));
  return load;
}

export default function LegacyRenderer({ bodyClass, content, styles, scripts, fontStylesheet }) {
  useLayoutEffect(() => {
    document.body.className = bodyClass;
    return () => {
      document.body.className = '';
    };
  }, [bodyClass]);

  useEffect(() => {
    let cancelled = false;
    scripts.reduce(
      (load, src) => load.then(() => loadLegacyScript(src)),
      Promise.resolve()
    ).catch((error) => {
      if (!cancelled) console.error('Could not initialize the page scripts:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [scripts]);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={fontStylesheet} />
      {styles.map((href) => <link key={href} rel="stylesheet" href={href} />)}
      <div
        style={{ display: 'contents' }}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </>
  );
}
