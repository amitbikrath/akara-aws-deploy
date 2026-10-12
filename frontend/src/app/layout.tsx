import type { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import './globals.css';

// The real akara.studio UI is the Babel/React bundle at public/akara/*.jsx.
// This layout is ONLY the shell that loads it — keep the script list below in
// lockstep with public/akara/akara.html (see CLAUDE.md at the repo root).
// Missing a script here renders a blank page: app.jsx references components
// defined by the earlier files.
const AKARA_SCRIPTS = [
  '/akara/tweaks-panel.jsx',
  '/akara/lib.jsx',
  '/akara/protected-image.jsx',
  '/akara/auth.jsx',
  '/akara/panchang.jsx',
  '/akara/nav-hero.jsx',
  '/akara/lightbox.jsx',
  '/akara/wallpapers.jsx',
  '/akara/gallery.jsx',
  '/akara/shop.jsx',
  '/akara/shop-page.jsx',
  '/akara/music-story.jsx',
  '/akara/socials.jsx',
  '/akara/footer.jsx',
  '/akara/app.jsx',
];

// Site CSS inlined at build time — mirrors the live prerendered head. Classes
// used by the jsx bundle must exist here even if akara/index.html also
// declares them: these are two different documents at runtime.
const siteCss = fs.readFileSync(
  path.join(process.cwd(), 'src/app/akara-site.css'),
  'utf8'
);

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
      </head>
      <body>
        {children}
        <div className="grain" />
        <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossOrigin="anonymous" />
        <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossOrigin="anonymous" />
        <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossOrigin="anonymous" />
        <script src="https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js" crossOrigin="anonymous" />
        {AKARA_SCRIPTS.map(src => (
          <script key={src} type="text/babel" src={src} />
        ))}
      </body>
    </html>
  );
}
