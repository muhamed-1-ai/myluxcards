import type { Metadata } from 'next';
import './globals.css';
import './landing.css';
import CookieConsent from '@/components/ui/CookieConsent';
import { FollowUpReminderModal } from '@/components/notifications/FollowUpReminderModal';

export const metadata: Metadata = {
  title: 'Zappit | One Tap. Your Digital World Connected.',
  description: 'Smart NFC cards, vehicle identification, lost & found solutions, and business tools connected through one powerful Zappit platform.',
  keywords: ['Zappit', 'Smart Tap Solutions', 'NFC business cards', 'digital identity', 'vehicle identification', 'lost and found QR', 'NFC keytags'],
  authors: [{ name: 'Zappit' }],
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0066FF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Zappit" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("zappit_theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var root=document.documentElement;root.setAttribute("data-theme",t);if(t==="light"){root.classList.add("light","light-mode");root.classList.remove("dark","dark-mode");root.style.colorScheme="light";}else{root.classList.add("dark","dark-mode");root.classList.remove("light","light-mode");root.style.colorScheme="dark";}try{localStorage.removeItem("zappit_sidebar_collapsed");sessionStorage.removeItem("zappit_session_sidebar_open");}catch(e){}var w=window.innerWidth;if(w>1024){root.classList.add("is-rail");}else{root.classList.remove("is-rail");}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <CookieConsent />
        <FollowUpReminderModal />
      </body>
    </html>
  );
}