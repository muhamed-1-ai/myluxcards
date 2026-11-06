import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pagePath = path.resolve('src/app/page.tsx');
const cssPath = path.resolve('src/app/landing.css');
const jsPath = path.resolve('public/js/inline/index.js');

const pageContent = fs.readFileSync(pagePath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');

test('1. "Tap or click to preview live profile" and sparkle are removed from the front card', () => {
  assert.equal(
    pageContent.includes('Tap or click to preview live profile'),
    false,
    'The hint "Tap or click to preview live profile" should be completely removed from the front card'
  );
  assert.equal(
    pageContent.includes('card-tap-hint'),
    false,
    'The card-tap-hint span should be removed'
  );
});

test('2. Centered "View demo profile ↗" button is placed below the card stack and connected', () => {
  assert.match(
    pageContent,
    /hero-card-demo-btn[\s\S]*View demo profile[\s\S]*hero-demo-arrow/,
    'Dedicated View demo profile button exists below the stack'
  );
  assert.match(
    pageContent,
    /id="hero-demo-profile-trigger"/,
    'Button has id="hero-demo-profile-trigger"'
  );
  assert.match(
    jsContent,
    /heroDemoTrigger\?\.addEventListener\('click',\s*openDemoModal\)/,
    'Button is bound to openDemoModal'
  );
});

test('3. Card stack shadow replaces heavy black blur with soft contact shadow', () => {
  // Check that the old 70px/80px heavy black blur is replaced
  assert.equal(
    cssContent.includes('0 28px 70px -10px rgba(0, 0, 0, 0.42)'),
    false,
    'Heavy black blur should be removed'
  );
  assert.match(
    cssContent,
    /\.landing-page \.nfc-card-front[\s\S]*?box-shadow:\s*0 20px 42px -10px rgba\(15, 23, 42, 0\.24\)/,
    'Front card uses a soft realistic contact shadow'
  );
});

test('4. Rear card has lighter finish and edge highlight for contrast separation', () => {
  assert.match(
    cssContent,
    /\.landing-page \.nfc-card-back[\s\S]*?background:\s*linear-gradient\(135deg,\s*#131E33/,
    'Rear card has a slightly lighter finish than the front card'
  );
  assert.match(
    cssContent,
    /\.landing-page \.nfc-card-back[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, 0\.16\)/,
    'Rear card has subtle specular edge highlight'
  );
});

test('5. Front card typography is crisp with breathing room', () => {
  assert.match(
    cssContent,
    /\.landing-page \.nfc-card-name[\s\S]*?text-shadow:\s*none/,
    'No blurry glow on name text for crisp rendering'
  );
  assert.match(
    cssContent,
    /\.landing-page \.nfc-card-subtitle[\s\S]*?margin-top:\s*6px/,
    'Subtitle has breathing room'
  );
});

test('6. QR matrix is secondary without misleading "Scan to Connect" label', () => {
  assert.equal(
    pageContent.includes('Scan to Connect'),
    false,
    '"Scan to Connect" label should be removed so visitors are not misled to scan the screen'
  );
  assert.match(
    cssContent,
    /\.landing-page \.nfc-qr-area[\s\S]*?opacity:\s*0\.85/,
    'QR matrix is styled as visually secondary'
  );
});

test('7. Keyboard focus and accessibility are supported', () => {
  assert.match(
    cssContent,
    /\.hero-card-demo-btn:focus-visible/,
    'Demo button has visible focus state'
  );
  assert.match(
    cssContent,
    /\.tap-card:focus-visible/,
    'Card button has visible focus state'
  );
});

test('8. Mobile responsive rules keep stack centered and prevent overflow', () => {
  assert.match(
    cssContent,
    /@media\s*\(max-width:\s*768px\)[\s\S]*?\.hero-card-demo-wrap/,
    'Mobile styling exists for demo button below stack'
  );
  assert.match(
    cssContent,
    /@media\s*\(max-width:\s*768px\)[\s\S]*?\.nfc-card-scene[\s\S]*?max-width:\s*330px/,
    'Mobile max-width prevents horizontal overflow'
  );
});

