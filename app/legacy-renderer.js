'use client';

import { useLayoutEffect } from 'react';
import Script from 'next/script';

export default function LegacyRenderer({ bodyClass, content, styles, scripts, fontStylesheet }) {
  useLayoutEffect(() => {
    document.body.className = bodyClass;
    return () => {
      document.body.className = '';
    };
  }, [bodyClass]);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={fontStylesheet} />
      {styles.map((href) => <link key={href} rel="stylesheet" href={href} />)}
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: content }} />
      {scripts.map((src) => <Script key={src} src={src} strategy="afterInteractive" />)}
    </>
  );
}
