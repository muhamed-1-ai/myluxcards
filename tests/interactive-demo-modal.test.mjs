import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildVCardString } from '../src/lib/vcard.ts';
import { resolveThemeTokens } from '../src/lib/themeTokens.ts';

test('1. Architectural Reuse: InteractiveDemoModal imports and renders ModernProfileLayout and CompactProfileThemeSwitcher', () => {
  const componentPath = path.resolve('src/components/demo/InteractiveDemoModal.tsx');
  assert.ok(fs.existsSync(componentPath), 'InteractiveDemoModal.tsx must exist');
  
  const content = fs.readFileSync(componentPath, 'utf8');
  assert.match(content, /import\s+.*ModernProfileLayout.*from\s+["']@\/components\/card\/ModernProfileLayout["']/, 'Must reuse ModernProfileLayout');
  assert.match(content, /import\s+.*CompactProfileThemeSwitcher.*from\s+["']@\/components\/card\/CompactProfileThemeSwitcher["']/, 'Must reuse CompactProfileThemeSwitcher');
  assert.match(content, /<ModernProfileLayout/, 'Must render ModernProfileLayout');
  assert.match(content, /<CompactProfileThemeSwitcher/, 'Must render CompactProfileThemeSwitcher');
  assert.match(content, /profileProducts=\{\[\]\}/, 'Must provide empty profileProducts to prevent remote fetching');
});

test('2. Deprecation Elimination: Old phone mockup and hardcoded demo card removed from redesignedMarkup in page.tsx', () => {
  const pagePath = path.resolve('src/app/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  assert.doesNotMatch(pageContent, /class="phone-mockup-wrapper"/, 'phone-mockup-wrapper must be removed from page.tsx');
  assert.doesNotMatch(pageContent, /class="phone-mockup-speaker"/, 'phone-mockup-speaker must be removed from page.tsx');
  assert.doesNotMatch(pageContent, /class="phone-mockup-screen"/, 'phone-mockup-screen must be removed from page.tsx');
  assert.doesNotMatch(pageContent, /modal-demo-vcard/, 'Old modal-demo-vcard button must be removed from page.tsx');
  assert.match(pageContent, /<InteractiveDemoModal\s*\/>/, 'InteractiveDemoModal component must be rendered in Page()');
});

test('3. Modal Contrast: High title and subtitle contrast in both light and dark themes', () => {
  const cssPath = path.resolve('src/app/landing.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Must define crisp dark text for light mode and bright text for dark mode
  assert.match(cssContent, /\.zappit-demo-modal-title[\s\S]*?color:\s*#0F172A/i, 'Title must be dark (#0F172A) in light mode');
  assert.match(cssContent, /html\.dark\s+\.zappit-demo-modal-title[\s\S]*?color:\s*#F8FAFC/i, 'Title must be bright (#F8FAFC) in dark mode');
  assert.match(cssContent, /\.zappit-demo-modal-eyebrow[\s\S]*?var\(--apple-blue/i, 'Eyebrow must use prominent blue');
});

test('4. Digital Profile Assets: Demo cover banner and professional avatar assets exist and are valid', () => {
  const coverPath = path.resolve('public/assets/demo-cover.jpg');
  const avatarPath = path.resolve('public/assets/demo-avatar.png');

  assert.ok(fs.existsSync(coverPath), 'public/assets/demo-cover.jpg must exist');
  assert.ok(fs.existsSync(avatarPath), 'public/assets/demo-avatar.png must exist');

  const coverStat = fs.statSync(coverPath);
  const avatarStat = fs.statSync(avatarPath);

  assert.ok(coverStat.size > 500, 'Cover banner must have valid file content');
  assert.ok(avatarStat.size > 500, 'Avatar must have valid file content');
});

test('5. Theme Token Resolution: Dynamic preview supports Carbon Platinum default and other themes', () => {
  const testCard = {
    name: 'Alex Morgan',
    title: 'Founder & Managing Director',
    business: 'Apex Studio',
    profileThemePreference: 'carbon_platinum',
  };

  const carbonTokens = resolveThemeTokens(testCard);
  assert.equal(carbonTokens.bgIsLight, false, 'Carbon Platinum must resolve to dark background');
  assert.equal(carbonTokens.tokens.background, '#101214', 'Carbon Platinum background must match preset');

  // Verify dashboard, black_white, and white_black
  const bwTokens = resolveThemeTokens({ ...testCard, profileThemePreference: 'black_white' });
  assert.equal(bwTokens.tokens.background, '#000000', 'Black & White must resolve to pure black background');

  const wbTokens = resolveThemeTokens({ ...testCard, profileThemePreference: 'white_black' });
  assert.equal(wbTokens.tokens.background, '#FFFFFF', 'White & Black must resolve to pure white background');
});

test('6. Safe vCard Generation: RFC 6350 / vCard 3.0 generation produces valid contact payload', () => {
  const vcardBuild = buildVCardString({
    profileName: 'Alex Morgan',
    cardName: 'Alex Morgan',
    companyName: 'Apex Studio',
    title: 'Founder & Managing Director',
    phone: '+91 98765 00123',
    email: 'alex@apexcreative.studio',
    website: 'https://apexcreative.studio',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
  });

  assert.ok(vcardBuild.vcard.includes('BEGIN:VCARD'), 'vCard must contain BEGIN:VCARD');
  assert.ok(vcardBuild.vcard.includes('FN:Alex Morgan'), 'vCard must contain FN:Alex Morgan');
  assert.ok(vcardBuild.vcard.includes('ORG:Apex Studio'), 'vCard must contain ORG:Apex Studio');
  assert.ok(vcardBuild.vcard.includes('TEL;TYPE=CELL:+91 98765 00123'), 'vCard must contain cell phone');
  assert.ok(vcardBuild.vcard.includes('EMAIL;TYPE=INTERNET:alex@apexcreative.studio'), 'vCard must contain email');
  assert.ok(vcardBuild.vcard.includes('END:VCARD'), 'vCard must end with END:VCARD');
});

test('7. Modal Dialog Structure & Accessibility: aria attributes and CTA link to materials', () => {
  const componentPath = path.resolve('src/components/demo/InteractiveDemoModal.tsx');
  const content = fs.readFileSync(componentPath, 'utf8');

  assert.match(content, /id="live-demo-modal"/, 'Modal element must have id="live-demo-modal"');
  assert.match(content, /role="dialog"/, 'Modal must have role="dialog"');
  assert.match(content, /aria-modal="true"/, 'Modal must have aria-modal="true"');
  assert.match(content, /aria-labelledby="live-demo-title"/, 'Modal must have aria-labelledby');
  assert.match(content, /id="close-live-demo-btn"/, 'Close button must have id="close-live-demo-btn"');
  assert.match(content, /id="demo-modal-cta-btn"/, 'CTA button must have id="demo-modal-cta-btn"');
  assert.match(content, /Choose Your Card Now/, 'CTA button text must match');
  assert.match(content, /scrollIntoView/, 'CTA button must scroll to materials');
});
