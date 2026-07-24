const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const copy = (from, to) => {
  const target = path.join(root, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(root, from), target, { recursive: true });
};

const routeMap = {
  'index.html': '/',
  'corporate.html': '/corporate',
  'find.html': '/find',
  'privacy.html': '/privacy',
  'support.html': '/support',
};

const escapeTemplate = (value) => value.replace(/`/g, '\\`').replace(/\\\$\\{/g, '\\\\${');
const extract = (source, expression) => {
  const match = source.match(expression);
  return match ? match[1].trim() : '';
};
const rewriteMarkup = (markup) => {
  let result = markup;
  for (const [from, to] of Object.entries(routeMap)) result = result.replaceAll(from, to);
  return result
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll("src='assets/", "src='/assets/")
    .replaceAll('url(assets/', 'url(/assets/');
};

const pages = [
  ['index.html', 'page.tsx', 'MyLuxCards | One Tap. Your Entire Professional World.', 'Premium NFC business cards, digital profiles and private QR lost-and-found by MyLux.'],
  ['corporate.html', 'corporate/page.tsx', 'MyLuxCards for Teams', 'Premium NFC business cards for teams.'],
  ['find.html', 'find/page.tsx', 'MyLux Find | Private QR Recovery', 'Private QR recovery from MyLux Find.'],
  ['privacy.html', 'privacy/page.tsx', 'MyLux Privacy Centre', 'MyLux privacy controls and support.'],
  ['support.html', 'support/page.tsx', 'Technical Support | myluxcards', 'Technical support and assistance for myluxcards premium NFC business cards.'],
];

write('package.json', JSON.stringify({
  name: 'myluxcards-next',
  version: '1.0.0',
  private: true,
  scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
  dependencies: { next: '^15.3.3', react: '^19.1.0', 'react-dom': '^19.1.0' },
  devDependencies: { '@types/node': '^22.15.3', '@types/react': '^19.1.2', '@types/react-dom': '^19.1.2', typescript: '^5.8.3' }
}, null, 2) + '\n');

write('tsconfig.json', JSON.stringify({
  compilerOptions: { target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'], allowJs: false, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, isolatedModules: true, jsx: 'preserve', incremental: true, plugins: [{ name: 'next' }] },
  include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
  exclude: ['node_modules']
}, null, 2) + '\n');

write('next.config.ts', `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/corporate.html', destination: '/corporate', permanent: true },
      { source: '/find.html', destination: '/find', permanent: true },
      { source: '/privacy.html', destination: '/privacy', permanent: true },
      { source: '/support.html', destination: '/support', permanent: true },
    ];
  },
};

export default nextConfig;
`);

write('src/app/layout.tsx', `import type { Metadata } from 'next';
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
`);

write('src/components/layout/LegacyPage.tsx', `'use client';

import { useEffect } from 'react';

type LegacyPageProps = { markup: string; inlineScript?: string };

function loadScript(source: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(\`Unable to load \${source}\`));
    document.body.appendChild(script);
  });
}

export default function LegacyPage({ markup, inlineScript }: LegacyPageProps) {
  useEffect(() => {
    let cancelled = false;
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
`);

for (const [htmlFile, pageFile, title, description] of pages) {
  const source = read(htmlFile);
  const body = rewriteMarkup(extract(source, /<body[^>]*>([\\s\\S]*?)<\\/body>/i).replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, ''));
  const inlineScripts = [...source.matchAll(/<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map((match) => match[1].trim()).filter(Boolean).join('\n');
  const routeKey = htmlFile.replace('.html', '');
  if (inlineScripts) write(`public/js/inline/${routeKey}.js`, inlineScripts + '\n');
  write(`src/app/${pageFile}`, `import type { Metadata } from 'next';
import LegacyPage from '@/components/layout/LegacyPage';

export const metadata: Metadata = { title: ${JSON.stringify(title)}, description: ${JSON.stringify(description)} };

const markup = String.raw\`${escapeTemplate(body)}\`;

export default function Page() {
  return <LegacyPage markup={markup}${inlineScripts ? ` inlineScript="/js/inline/${routeKey}.js"` : ''} />;
}
`);
}

let css = read('css/styles.css') + '\n' + read('css/animations.css');
css = css.replaceAll('url(assets/', 'url(/assets/');
write('src/app/globals.css', css);
copy('assets', 'public/assets');
copy('js', 'public/js');
console.log('Next.js migration scaffold generated.');
