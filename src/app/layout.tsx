import type { Metadata } from 'next';
import './globals.css';
import CookieConsent from '@/components/ui/CookieConsent';

export const metadata: Metadata = {
  title: 'Zappit | One Tap. Your Digital World Connected.',
  description: 'Smart NFC cards, vehicle identification, lost & found solutions, and business tools connected through one powerful Zappit platform.',
  keywords: ['Zappit', 'Smart Tap Solutions', 'NFC business cards', 'digital identity', 'vehicle identification', 'lost and found QR', 'NFC keytags'],
  authors: [{ name: 'Antigravity Team' }],
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("zappit_theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var root=document.documentElement;root.setAttribute("data-theme",t);if(t==="light"){root.classList.add("light","light-mode");root.classList.remove("dark","dark-mode");root.style.colorScheme="light";}else{root.classList.add("dark","dark-mode");root.classList.remove("light","light-mode");root.style.colorScheme="dark";}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}