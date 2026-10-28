import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Bundle 2 (NFC Card + Lead Management) billing presentation in src/app/page.tsx', () => {
  const pageContent = fs.readFileSync(path.join(projectRoot, 'src/app/page.tsx'), 'utf8');

  // Verify prominent ₹1,999/year with onwards as supporting text
  assert.match(
    pageContent,
    /<span class="bundle-currency">₹<\/span>\s*<span class="bundle-price">1,999<\/span>\s*<span class="bundle-period">\/year<\/span>\s*<span class="bundle-price-term">onwards<\/span>/,
    'Bundle 2 should display ₹ 1,999 /year onwards in bundle-price-row'
  );

  // Verify billing type replacement to Yearly Plan · Billed Annually
  assert.match(
    pageContent,
    /<div class="bundle-billing-type">Yearly Plan · Billed Annually<\/div>/,
    'Billing kicker must be "Yearly Plan · Billed Annually"'
  );
  assert.doesNotMatch(
    pageContent,
    /Hardware \+ Lead Management SaaS/i,
    'Old "Hardware + Lead Management SaaS" kicker must be completely removed'
  );

  // Verify updated supporting description stating NFC card and 1 year CRM access
  assert.match(
    pageContent,
    /<p class="bundle-billing-detail">Includes smart NFC card \+ 1 year of Lead Management CRM access\. No app required\.<\/p>/,
    'Supporting detail must state NFC card + 1 year of Lead Management CRM access without implying annual card replacement'
  );

  // Verify features, package name, button and card design preserved
  assert.match(pageContent, /<h3 class="bundle-title">NFC Card \+ Lead Management<\/h3>/);
  assert.match(pageContent, /<span class="bundle-badge">Includes Lead Management<\/span>/);
  assert.match(pageContent, /id="btn-bundle-leads"/);
  assert.match(pageContent, />Get Lead Management Bundle<\/a>/);
  assert.match(pageContent, /Centralized Leads CRM workspace with custom pipeline stages/);
  assert.match(pageContent, /Lead acquisition source attribution &amp; performance tracking/);
  assert.match(pageContent, /Loss of Business \(LOB\) reason analytics &amp; pipeline reporting/);
});

test('Bundle 1 (NFC Card + Software) pricing terms are preserved intact', () => {
  const pageContent = fs.readFileSync(path.join(projectRoot, 'src/app/page.tsx'), 'utf8');

  // Verify Bundle 1 remains untouched
  assert.match(pageContent, /<h3 class="bundle-title">NFC Card \+ Software<\/h3>/);
  assert.match(
    pageContent,
    /<span class="bundle-currency">₹<\/span>\s*<span class="bundle-price">999<\/span>\s*<span class="bundle-price-term">onwards<\/span>/
  );
  assert.match(pageContent, /<div class="bundle-billing-type">One-time hardware purchase<\/div>/);
  assert.match(
    pageContent,
    /<p class="bundle-billing-detail">Includes 1-year digital profile hosting\. Annual renewal at ₹499\/year\. No app required\.<\/p>/
  );
  assert.match(pageContent, /id="btn-bundle-standard"/);
  assert.match(pageContent, />Get NFC Bundle<\/a>/);
});

test('CSS responsive presentation for .bundle-period in src/app/landing.css', () => {
  const cssContent = fs.readFileSync(path.join(projectRoot, 'src/app/landing.css'), 'utf8');

  // Verify .bundle-period styling
  assert.match(cssContent, /\.landing-page \.bundle-period\s*\{[^}]*font-size:\s*1\.25rem/);
  assert.match(cssContent, /\.landing-page \.bundle-period\s*\{[^}]*font-weight:\s*700/);
  assert.match(cssContent, /\.landing-page \.bundle-price-row\s*\{[^}]*align-items:\s*baseline/);
  assert.match(cssContent, /\.landing-page \.bundle-price-row\s*\{[^}]*flex-wrap:\s*wrap/);

  // Verify mobile responsive adjustments
  const mobileMediaMatch = cssContent.match(/@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(mobileMediaMatch, 'Should contain max-width: 480px media query');
  assert.match(mobileMediaMatch[1], /\.landing-page \.bundle-period\s*\{[^}]*font-size:\s*1\.1rem/);
  assert.match(mobileMediaMatch[1], /\.landing-page \.bundle-price-term\s*\{[^}]*font-size:\s*0\.875rem/);
});

test('Package selection consistency across client controllers (public/js/app.js & js/app.js)', () => {
  const publicApp = fs.readFileSync(path.join(projectRoot, 'public/js/app.js'), 'utf8');
  const jsApp = fs.readFileSync(path.join(projectRoot, 'js/app.js'), 'utf8');

  assert.equal(publicApp, jsApp, 'public/js/app.js and js/app.js must be identical');

  assert.match(
    publicApp,
    /if \(queryBundle === 'lead-management'\) \{\s*messageField\.value = 'I would like to get the NFC Card \+ Lead Management bundle \(Yearly Plan · Billed Annually at ₹1,999\/year onwards\)\.';/
  );
  assert.match(
    publicApp,
    /if \(queryTopic && supportTopicSelect\) \{\s*supportTopicSelect\.value = queryTopic;/
  );
});
