$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Write-ProjectFile([string]$RelativePath, [string]$Content) {
  $target = Join-Path $Root $RelativePath
  $directory = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  [System.IO.File]::WriteAllText($target, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Get-Body([string]$Source) {
  $match = [regex]::Match($Source, '<body[^>]*>([\s\S]*?)</body>', 'IgnoreCase')
  if (-not $match.Success) { throw 'No body element found.' }
  return $match.Groups[1].Value
}

function Convert-Markup([string]$Markup) {
  $routes = @{ 'index.html' = '/'; 'corporate.html' = '/corporate'; 'find.html' = '/find'; 'privacy.html' = '/privacy'; 'support.html' = '/support' }
  foreach ($route in $routes.GetEnumerator()) { $Markup = $Markup.Replace($route.Key, $route.Value) }
  return $Markup.Replace('src="assets/', 'src="/assets/').Replace("src='assets/", "src='/assets/").Replace('url(assets/', 'url(/assets/')
}

$package = @'
{
  "name": "myluxcards-next",
  "version": "1.0.0",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },
  "dependencies": { "next": "^15.3.3", "react": "^19.1.0", "react-dom": "^19.1.0" },
  "devDependencies": { "@types/node": "^22.15.3", "@types/react": "^19.1.2", "@types/react-dom": "^19.1.2", "typescript": "^5.8.3" }
}
'@
Write-ProjectFile 'package.json' $package

Write-ProjectFile 'tsconfig.json' @'
{
  "compilerOptions": { "target": "ES2017", "lib": ["dom", "dom.iterable", "esnext"], "allowJs": false, "skipLibCheck": true, "strict": true, "noEmit": true, "esModuleInterop": true, "module": "esnext", "moduleResolution": "bundler", "resolveJsonModule": true, "isolatedModules": true, "jsx": "preserve", "incremental": true, "baseUrl": ".", "paths": { "@/*": ["src/*"] }, "plugins": [{ "name": "next" }] },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
'@

Write-ProjectFile 'next.config.ts' @'
import type { NextConfig } from 'next';

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
'@

Write-ProjectFile 'src/app/layout.tsx' @'
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
'@

Write-ProjectFile 'src/components/layout/LegacyPage.tsx' @'
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
'@

$pages = @(
  @{ File = 'index.html'; Route = 'page.tsx'; Key = 'index'; Title = 'MyLuxCards | One Tap. Your Entire Professional World.'; Description = 'Premium NFC business cards, digital profiles and private QR lost-and-found by MyLux.' },
  @{ File = 'corporate.html'; Route = 'corporate/page.tsx'; Key = 'corporate'; Title = 'MyLuxCards for Teams'; Description = 'Premium NFC business cards for teams.' },
  @{ File = 'find.html'; Route = 'find/page.tsx'; Key = 'find'; Title = 'MyLux Find | Private QR Recovery'; Description = 'Private QR recovery from MyLux Find.' },
  @{ File = 'privacy.html'; Route = 'privacy/page.tsx'; Key = 'privacy'; Title = 'MyLux Privacy Centre'; Description = 'MyLux privacy controls and support.' },
  @{ File = 'support.html'; Route = 'support/page.tsx'; Key = 'support'; Title = 'Technical Support | myluxcards'; Description = 'Technical support and assistance for myluxcards premium NFC business cards.' }
)

foreach ($page in $pages) {
  $source = [System.IO.File]::ReadAllText((Join-Path $Root $page.File))
  $markup = Get-Body $source
  $markup = [regex]::Replace($markup, '<script\b[^>]*>[\s\S]*?</script>', '', 'IgnoreCase')
  $markup = Convert-Markup $markup
  $inline = [regex]::Matches($source, '<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', 'IgnoreCase') | ForEach-Object { $_.Groups[1].Value.Trim() } | Where-Object { $_ }
  $inlinePath = ''
  if ($inline) { $inlinePath = "/js/inline/$($page.Key).js"; Write-ProjectFile "public/js/inline/$($page.Key).js" (($inline -join "`n") + "`n") }
  $markupJson = $markup | ConvertTo-Json -Compress
  $titleJson = $page.Title | ConvertTo-Json -Compress
  $descriptionJson = $page.Description | ConvertTo-Json -Compress
  $scriptAttribute = if ($inlinePath) { " inlineScript=`"$inlinePath`"" } else { '' }
  Write-ProjectFile "src/app/$($page.Route)" @"
import type { Metadata } from 'next';
import LegacyPage from '@/components/layout/LegacyPage';

export const metadata: Metadata = { title: $titleJson, description: $descriptionJson };

const markup = $markupJson;

export default function Page() {
  return <LegacyPage markup={markup}$scriptAttribute />;
}
"@
}

$css = [System.IO.File]::ReadAllText((Join-Path $Root 'css/styles.css')) + "`n" + [System.IO.File]::ReadAllText((Join-Path $Root 'css/animations.css'))
Write-ProjectFile 'src/app/globals.css' $css.Replace('url(assets/', 'url(/assets/')

$public = Join-Path $Root 'public'
New-Item -ItemType Directory -Force -Path $public | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root 'assets') (Join-Path $public 'assets')
New-Item -ItemType Directory -Force -Path (Join-Path $public 'js') | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root 'js\\*') (Join-Path $public 'js')
$appScriptPath = Join-Path $public 'js/app.js'
$appScript = [System.IO.File]::ReadAllText($appScriptPath)
$appScript = [regex]::Replace($appScript, 'document\.addEventListener\(''DOMContentLoaded'', \(\) => \{\s*window\.app = new LuxApp\(\);\s*\}\);', @'
const initLuxApp = () => {
  if (!window.app) window.app = new LuxApp();
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLuxApp);
} else {
  initLuxApp();
}
'@.Trim(), 'Singleline')
[System.IO.File]::WriteAllText($appScriptPath, $appScript, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Next.js migration scaffold generated.'
