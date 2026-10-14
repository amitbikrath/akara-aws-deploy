import type { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import './globals.css';

// The real akara.studio UI is the React bundle at public/akara/*.jsx, compiled
// to public/akara/js/*.js by scripts/build-jsx.mjs (no Babel in the browser).
// This layout is ONLY the shell that loads it — keep the script list below in
// lockstep with public/akara/akara.html and index.html (scripts/check-site.mjs).
// Missing a script here renders a blank page: app.jsx references components
// defined by the earlier files.
const AKARA_SCRIPTS = [
  '/akara/js/tweaks-panel.js',
  '/akara/js/lib.js',
  '/akara/js/protected-image.js',
  '/akara/js/auth.js',
  '/akara/js/panchang.js',
  '/akara/js/nav-hero.js',
  '/akara/js/lightbox.js',
  '/akara/js/wallpapers.js',
  '/akara/js/gallery.js',
  '/akara/js/shop.js',
  '/akara/js/shop-page.js',
  '/akara/js/music-story.js',
  '/akara/js/socials.js',
  '/akara/js/footer.js',
  '/akara/js/app.js',
];

// Site CSS inlined at build time — mirrors the live prerendered head. Classes
// used by the jsx bundle must exist here even if akara/index.html also
// declares them: these are two different documents at runtime.
const siteCss = fs.readFileSync(
  path.join(process.cwd(), 'src/app/akara-site.css'),
  'utf8'
);

// Re-loads app scripts that came back empty from a broken cache. Inlined (never
// a file of its own) and placed before every script it watches.
const BOOT_RESCUE = fs.readFileSync(
  path.join(process.cwd(), 'src/app/boot-rescue.js'),
  'utf8'
);

// Read by auth.jsx and lib.jsx. Copied from the live prerender (2026-07-04).
const AUTH_CONFIG =
  'window.__AKARA_API_BASE = "";window.__AKARA_AUTH = {"hostedUI":"https://auth.akara.studio","clientId":"tdvllhi43hnfi1ibn21an410d","redirectUri":"https://www.akara.studio/auth/callback","logoutUri":"https://www.akara.studio/","scope":"openid email profile"};';

export const metadata: Metadata = {
  title: 'Akara — Awaken the Inner Sanatani',
  description: 'Sacred art for your screen — calm, cinematic, and rooted in dharma.',
  icons: { icon: '/akara/assets/akara-icon-round.png' },
  openGraph: {
    title: 'Akara — Awaken the Inner Sanatani',
    description: 'Sacred art for your screen — calm, cinematic, and rooted in dharma.',
    images: ['https://www.akara.studio/akara/assets/akara-banner.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Akara — Awaken the Inner Sanatani',
    description: 'Sacred art for your screen — calm, cinematic, and rooted in dharma.',
    images: ['https://www.akara.studio/akara/assets/akara-banner.png'],
  },
  other: { 'p:domain_verify': '8d0c230707a61a448c9ac709ac1f6ada' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: siteCss }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_RESCUE }} />
        <script dangerouslySetInnerHTML={{ __html: AUTH_CONFIG }} />
      </head>
      <body>
        {children}
        <div className="grain" />
        <script src="/akara/vendor/react-18.3.1.production.min.js" />
        <script src="/akara/vendor/react-dom-18.3.1.production.min.js" />
        <script src="/akara/vendor/astronomy-engine-2.1.19.min.js" />
        {AKARA_SCRIPTS.map(src => (
          <script key={src} src={src} />
        ))}
      </body>
    </html>
  );
}
