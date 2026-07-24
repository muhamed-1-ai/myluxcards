import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyLuxCards | One Tap. Your Entire Professional World.',
  description: 'Premium NFC business cards, digital profiles and private QR lost-and-found by MyLux.',
  keywords: ['NFC business cards', 'digital business profile', 'smart QR tags', 'NFC keytags', 'MyLuxCards India'],
  authors: [{ name: 'Antigravity Team' }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}