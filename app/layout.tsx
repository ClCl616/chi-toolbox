import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/shell.css';
import '@/styles/collections.css';
import '@/styles/desktop.css';
import '@/styles/mobile.css';
import '@/styles/editors.css';
import '@/styles/interaction.css';
import { PwaRegister } from '@/shell/pwa-register';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Chi Toolbox', template: '%s · Chi Toolbox' },
  description: '개인 도구 대시보드',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Chi Toolbox',
    description: '개인 도구 대시보드',
    images: [
      { url: '/og-toolbox.png', width: 1731, height: 909, alt: 'Chi Toolbox' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chi Toolbox',
    description: '개인 도구 대시보드',
    images: ['/og-toolbox.png'],
  },
};
export const viewport: Viewport = {
  themeColor: '#171916',
  width: 'device-width',
  initialScale: 1,
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
