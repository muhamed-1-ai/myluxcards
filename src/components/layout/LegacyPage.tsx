'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { createIcons, icons } from 'lucide';

type LegacyPageProps = { markup: string; inlineScript?: string };
type LucideWindow = Window & { lucide?: { createIcons: () => void } };

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

function NavbarLogoPortal() {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const el = document.querySelector('.logo-img-link');
    if (el) {
      el.innerHTML = '';
      setTarget(el);
    }
  }, []);

  if (!target) return null;

  return createPortal(
    <Image
      src="/assets/logo.svg"
      alt="Zappit logo"
      width={240}
      height={120}
      priority
      style={{
        width: 'auto',
        height: 'auto',
      }}
      className="brand-logo"
    />,
    target
  );
}

export default function LegacyPage({ markup, inlineScript }: LegacyPageProps) {
  useEffect(() => {
    let cancelled = false;
    document.querySelectorAll<HTMLImageElement>('.loader-logo-img, .footer-logo-img').forEach((image) => {
      image.src = '/assets/logo-premium.png';
      image.removeAttribute('onerror');
    });
    const renderIcons = () => createIcons({ icons });
    (window as LucideWindow).lucide = { createIcons: renderIcons };
    renderIcons();

    const dismissLoader = () => {
      const loader = document.getElementById('page-loader');
      if (loader) {
        loader.classList.add('is-hidden');
        loader.style.opacity = '0';
        setTimeout(() => {
          if (loader) loader.style.display = 'none';
        }, 300);
      }
    };
    dismissLoader();

    (async () => {
      try {
        await Promise.all([
          loadScript('/js/data.js').catch(() => {}),
          loadScript('/js/app.js').catch(() => {})
        ]);
        if (cancelled) return;
        if (inlineScript) await loadScript(inlineScript).catch(() => {});
        if (!cancelled) {
          renderIcons();
          dismissLoader();
        }
      } catch (error) {
        console.error(error);
      }
    })();
    return () => { cancelled = true; };
  }, [inlineScript]);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <NavbarLogoPortal />
    </>
  );
}
