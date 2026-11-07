import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Starting test suite: homepage-cart-faq-crm.test.mjs');

// 1. Check CSS rules in src/app/landing.css and src/app/globals.css
const landingCss = fs.readFileSync('src/app/landing.css', 'utf8');
const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');

// Drawer & Navbar Layering
assert(landingCss.includes('10000 !important'), 'Navbar should have z-index 10000');
assert(landingCss.includes('.drawer-overlay') && landingCss.includes('10001 !important'), 'Drawer overlay must be 10001');
assert(landingCss.includes('.drawer') && landingCss.includes('10002 !important'), 'Drawer must be 10002');
assert(globalsCss.includes('z-index: 10001'), 'globals.css drawer-overlay must be 10001');
assert(globalsCss.includes('z-index: 10002'), 'globals.css drawer must be 10002');
assert(landingCss.includes('body.drawer-open') && landingCss.includes('overflow: hidden'), 'Body must lock scroll when drawer open');

// Scroll Margins for Anchor Links
assert(landingCss.includes('scroll-margin-top: 100px !important'), 'Sections must have scroll-margin-top 100px');
assert(landingCss.includes('#materials') && landingCss.includes('#bundles') && landingCss.includes('#crm-workspace') && landingCss.includes('#faq'), 'All section IDs must be covered by scroll-margin');
assert(landingCss.includes('scroll-margin-top: 85px !important'), 'Mobile sections must have scroll-margin-top 85px');

// FAQ Accordion CSS
assert(landingCss.includes('.landing-page .faq-answer') && landingCss.includes('display: none !important'), 'Collapsed FAQ answer must be visually hidden');
assert(landingCss.includes('.landing-page .faq-item.is-open .faq-answer') && landingCss.includes('display: block !important'), 'Open FAQ item must display answer');
assert(landingCss.includes('.faq-item.is-open .faq-icon') && landingCss.includes('rotate(180deg)'), 'Open FAQ item must rotate icon');

// CRM Fullsize CSS
assert(landingCss.includes('.crm-fullsize-btn'), 'CRM fullsize button styling must exist');
assert(landingCss.includes('.crm-fullsize-modal-overlay'), 'CRM fullsize lightbox styling must exist');

// Cart Billing Badges CSS
assert(landingCss.includes('.drawer-billing-badge'), 'Cart line-item billing badge CSS must exist');
assert(landingCss.includes('.drawer-renewal-text'), 'Cart renewal text CSS must exist');
assert(landingCss.includes('.drawer-billing-note'), 'Cart footer billing terms note CSS must exist');

console.log('✅ 1. CSS styling and z-index checks passed.');

// 2. Check HTML Markup in src/app/page.tsx
const pageHtml = fs.readFileSync('src/app/page.tsx', 'utf8');

// Materials card shortcuts
assert(pageHtml.includes('Add Standard Bundle (Velvet Matte Black PVC)'), 'Black card shortcut must say Add Standard Bundle');
assert(pageHtml.includes('Add Standard Bundle (Ceramic White PVC)'), 'White card shortcut must say Add Standard Bundle');

// CRM Section Heading
assert(pageHtml.includes('Capture leads. Track follow-ups. Close more deals.'), 'CRM heading must be updated to Capture leads. Track follow-ups. Close more deals.');
assert(!pageHtml.includes('Turn conversations into tracked pipeline revenue.'), 'Old CRM heading must be gone');

// CRM Fullsize Action & Light/Dark Switch
assert(pageHtml.includes('id="crm-preview-fullsize-btn"'), 'Fullsize button ID must exist');
assert(pageHtml.includes('View full-size'), 'Button text must say View full-size');
assert(pageHtml.includes('id="crm-theme-dark-btn"') && pageHtml.includes('id="crm-theme-light-btn"'), 'Theme switcher must be preserved');
assert(pageHtml.includes('id="crm-fullsize-modal"'), 'Full-size lightbox modal markup must exist');
assert(pageHtml.includes('id="crm-fullsize-img"'), 'Full-size image element must exist');

// Cart Drawer Structure
assert(pageHtml.includes('<span>Due Today:</span>'), 'Cart footer total label must be Due Today');
assert(pageHtml.includes('id="cart-billing-terms-note"'), 'Cart billing terms note container must exist');

console.log('✅ 2. Markup and structure checks passed.');

// 3. Check JavaScript in public/js/inline/index.js and public/js/app.js
const inlineJs = fs.readFileSync('public/js/inline/index.js', 'utf8');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

// Finish to Bundle & Cart carryover
assert(inlineJs.includes('bundle-standard-${finish}'), 'Finish shortcut must use standard bundle id');
assert(inlineJs.includes('billingPeriod: \'One-time hardware\'') || inlineJs.includes('billingPeriod: "One-time hardware"'), 'Standard bundle must have billingPeriod');
assert(inlineJs.includes('renewsLater:'), 'Cart items must define renewsLater');
assert(inlineJs.includes('initCrmFullsizeModal'), 'initCrmFullsizeModal must be initialized');

// Focus Management & Accessibility in Cart Drawer
assert(appJs.includes('this.lastCartOpener = opener || document.activeElement'), 'Opener element must be captured on drawer open');
assert(appJs.includes('this.lastCartOpener.focus()'), 'Opener focus must be restored on drawer close');
assert(appJs.includes('trapFocusInDrawer'), 'Drawer must trap Tab key focus within container');
assert(appJs.includes('document.body.classList.add(\'drawer-open\')') || appJs.includes('document.body.classList.add("drawer-open")'), 'Body must receive drawer-open class');

// Line item billing rendering
assert(appJs.includes('drawer-billing-badge'), 'renderCartDrawer must render billing badges');
assert(appJs.includes('Due today:'), 'renderCartDrawer must render due today label');
assert(appJs.includes('cart-billing-terms-note'), 'renderCartDrawer must populate footer billing terms note');
assert(appJs.includes('Manual renewal upon expiry'), 'Billing terms must explicitly clarify manual renewals upon expiry');

// Checkout summary update
assert(appJs.includes('Due Today: ${this.formatCartTotal()}'), 'Checkout summary must display Due Today breakdown');

console.log('✅ 3. JavaScript and interaction checks passed.');

// 4. Verify Image Assets Exist
assert(fs.existsSync('public/assets/crm-dashboard-dark.png'), 'Dark screenshot must exist in public/assets');
assert(fs.existsSync('public/assets/crm-dashboard-light.png'), 'Light screenshot must exist in public/assets');

console.log('✅ 4. Public assets verified.');
console.log('🎉 All homepage cart, FAQ, and CRM tests passed successfully!');

