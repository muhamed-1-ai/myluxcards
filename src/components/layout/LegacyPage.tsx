'use client';

import { useEffect } from 'react';

type LegacyPageProps = { markup: string; inlineScript?: string };

function loadScript(source: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load ${source}`));
    document.body.appendChild(script);
  });
}

export default function LegacyPage({ markup, inlineScript }: LegacyPageProps) {
  useEffect(() => {
    let cancelled = false;
    document.querySelectorAll<HTMLImageElement>('.loader-logo-img, .footer-logo-img').forEach((image) => {
      image.src = '/assets/logo-premium.png';
      image.removeAttribute('onerror');
    });
    document.querySelectorAll<HTMLImageElement>('.brand-logo').forEach((image) => {
      image.src = '/assets/logo-navbar.png';
      image.removeAttribute('onerror');
    });
    (async () => {
      try {
        await loadScript('https://unpkg.com/lucide@latest');
        if (cancelled) return;
        await loadScript('/js/data.js');
        if (cancelled) return;
        await loadScript('/js/app.js');
        if (cancelled) return;
        if (inlineScript) await loadScript(inlineScript);
      } catch (error) {
        console.error(error);
      }
    })();
    return () => { cancelled = true; };
  }, [inlineScript]);

  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
