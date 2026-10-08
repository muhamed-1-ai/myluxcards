'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { createIcons, icons } from 'lucide';
import BrandLogo from '@/components/BrandLogo';

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
    <BrandLogo size="lg" priority />,
    target
  );
}

export default function LegacyPage({ markup, inlineScript }: LegacyPageProps) {
  useEffect(() => {
    let cancelled = false;
    document.querySelectorAll<HTMLImageElement>('.loader-logo-img, .footer-logo-img').forEach((image) => {
      image.src = '/brand/zappit-logo-transparent.png';
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

    // Immediate attempt to dismiss loader if DOM ready
    dismissLoader();

    // 12-second Safe Initialization Timeout Safety Net
    const safetyTimeout = setTimeout(() => {
      if (cancelled) return;
      const loader = document.getElementById('page-loader');
      if (loader && !loader.classList.contains('is-hidden') && loader.style.display !== 'none') {
        console.warn('[APP_INIT] Startup taking longer than expected (>12s). Rendering recovery UI.');
        loader.innerHTML = `
          <div style="max-width: 480px; text-align: center; padding: 2rem; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 16px; backdrop-filter: blur(12px); color: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div style="margin-bottom: 1rem;">
              <img src="/brand/zappit-logo-transparent.png" alt="Zappit" style="height: 48px; object-fit: contain;" />
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.5rem;">Zappit is taking longer than expected</h3>
            <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 1.5rem; line-height: 1.5;">Something went wrong while initializing your session or application resources.</p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button onclick="window.location.reload()" style="background: linear-gradient(135deg, #0066FF, #00E5FF); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">Try Again</button>
              <button onclick="document.getElementById('page-loader')?.classList.add('is-hidden')" style="background: rgba(255,255,255,0.1); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">Proceed Anyway</button>
            </div>
          </div>
        `;
      }
    }, 12000);

    (async () => {
      try {
        await Promise.all([
          loadScript('/js/data.js').catch((err) => console.warn('[APP_INIT] data.js load warning:', err)),
          loadScript('/js/app.js').catch((err) => console.warn('[APP_INIT] app.js load warning:', err))
        ]);
        if (cancelled) return;
        if (inlineScript) await loadScript(inlineScript).catch((err) => console.warn('[APP_INIT] inline script warning:', err));
        if (!cancelled) {
          renderIcons();
        }
      } catch (error) {
        console.error('[APP_INIT] LegacyPage initialization error:', error);
      } finally {
        if (!cancelled) {
          clearTimeout(safetyTimeout);
          dismissLoader();
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
    };
  }, [inlineScript]);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <NavbarLogoPortal />
    </>
  );
}
