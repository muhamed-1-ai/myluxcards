import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pagePath = path.join(rootDir, 'src', 'app', 'page.tsx');
const cssPath = path.join(rootDir, 'src', 'app', 'landing.css');
const legacyPagePath = path.join(rootDir, 'src', 'components', 'layout', 'LegacyPage.tsx');
const indexPath = path.join(rootDir, 'public', 'js', 'inline', 'index.js');

const pageContent = fs.readFileSync(pagePath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const legacyPageContent = fs.readFileSync(legacyPagePath, 'utf8');
const indexContent = fs.readFileSync(indexPath, 'utf8');

test('1. Page Loader HTML structure contains all branded lightning elements', () => {
  assert.ok(pageContent.includes('id="page-loader"'), 'page-loader element must exist with id');
  assert.ok(pageContent.includes('class="loader-stage"'), 'loader-stage container must exist');
  assert.ok(pageContent.includes('class="loader-ripple"'), 'loader-ripple element must exist');
  assert.ok(pageContent.includes('class="loader-logo-glow"'), 'loader-logo-glow element must exist');
  assert.ok(pageContent.includes('class="loader-lightning-svg"'), 'loader-lightning-svg must exist');
  assert.ok(pageContent.includes('class="lightning-bolt-main"'), 'lightning-bolt-main SVG path must exist');
  assert.ok(pageContent.includes('class="lightning-bolt-branch"'), 'lightning-bolt-branch SVG path must exist');
  assert.ok(pageContent.includes('class="loader-logo"'), 'loader-logo container must exist');
  assert.ok(pageContent.includes('src="/brand/zappit-logo-transparent.png"'), 'loader logo must use canonical brand asset');
  assert.ok(pageContent.includes('id="loader-status-label"'), 'loader-status-label must exist with id');
  assert.ok(pageContent.includes('Loading Zappit…'), 'loader-status-label must display Loading Zappit…');
});

test('2. CSS contains Dark Mode tokens: near-black background and electric-blue accent', () => {
  assert.ok(cssContent.includes('html[data-theme="dark"] .landing-page #page-loader'), 'Dark mode loader rule must exist');
  assert.ok(cssContent.includes('#07090E'), 'Dark mode near-black background #07090E must be defined');
  assert.ok(cssContent.includes('#00E5FF'), 'Electric-blue stroke #00E5FF must be defined in dark mode');
  assert.ok(cssContent.includes('rgba(0, 229, 255'), 'Electric-blue ripple rgba(0, 229, 255) must be defined');
});

test('3. CSS contains Light Mode tokens: pale blue-white background and deeper blue accent', () => {
  assert.ok(cssContent.includes('html[data-theme="light"] .landing-page #page-loader'), 'Light mode loader rule must exist');
  assert.ok(cssContent.includes('#F8FAFC'), 'Light mode pale blue-white background #F8FAFC must be defined');
  assert.ok(cssContent.includes('#0066FF'), 'Deeper blue stroke #0066FF must be defined in light mode');
});

test('4. CSS defines the single strike sequence and soft blue ripple', () => {
  assert.ok(cssContent.includes('@keyframes lightningDraw'), 'lightningDraw keyframes must exist');
  assert.ok(cssContent.includes('@keyframes zappitRipple'), 'zappitRipple keyframes must exist');
  assert.ok(cssContent.includes('@keyframes logoStrikeReveal'), 'logoStrikeReveal keyframes must exist');
  assert.ok(cssContent.includes('@keyframes statusFadeIn'), 'statusFadeIn keyframes must exist');
  assert.ok(cssContent.includes('zappitRipple 0.55s'), 'Ripple animation must have ~550ms ease duration');
  assert.ok(cssContent.includes('0.22s 1 forwards'), 'Ripple must execute as a single strike (1 forwards)');
  assert.ok(cssContent.includes('statusFadeIn 0.35s ease-out 0.6s'), 'Status label must appear smoothly after 600ms');
});

test('5. Reduced motion accessibility rules are defined', () => {
  assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced motion query must exist');
  assert.ok(cssContent.includes('.landing-page .loader-lightning-svg') && cssContent.includes('display: none !important'), 'SVG lightning must be hidden on reduced motion');
  assert.ok(cssContent.includes('.landing-page .loader-logo') && cssContent.includes('opacity: 1 !important'), 'Logo must be static and full opacity on reduced motion');
  assert.ok(cssContent.includes('.landing-page .loader-status-label') && cssContent.includes('display: block !important'), 'Status label must be immediately visible on reduced motion');
});

test('6. Recovery and safety net UI remain intact', () => {
  assert.ok(legacyPageContent.includes('Zappit is taking longer than expected'), '12-second safety net title must be preserved');
  assert.ok(legacyPageContent.includes('Try Again'), 'Recovery Try Again action must be preserved');
  assert.ok(legacyPageContent.includes('Proceed Anyway'), 'Recovery Proceed Anyway action must be preserved');
});

test('7. Content-already-available detection allows instant transition', () => {
  assert.ok(legacyPageContent.includes('__zappit_page_ready'), 'LegacyPage must track page readiness');
  assert.ok(indexContent.includes('__zappit_page_ready'), 'Inline index script must inspect page readiness');
  assert.ok(indexContent.includes('hideLoader(true)'), 'Immediate dismissal pathway must be present');
});

