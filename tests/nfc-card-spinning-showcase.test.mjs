import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSrc = fs.readFileSync('src/app/page.tsx', 'utf8');
const cssSrc = fs.readFileSync('src/app/landing.css', 'utf8');
const jsSrc = fs.readFileSync('public/js/inline/index.js', 'utf8');

test('1. Video player, pause button, and black rectangular box are completely removed from hero', () => {
  assert.equal(pageSrc.includes('id="hero-nfc-video"'), false, 'hero-nfc-video element must be removed');
  assert.equal(pageSrc.includes('id="hero-video-toggle"'), false, 'hero-video-toggle button must be removed');
  assert.equal(pageSrc.includes('class="hero-showcase-frame"'), false, 'hero-showcase-frame rectangular box must be removed');
  assert.equal(pageSrc.includes('hero-video-wrapper'), false, 'hero-video-wrapper must be removed');
  assert.equal(pageSrc.includes('<video'), false, 'No video element in hero markup');
});

test('2. 3D perspective stage and spinning card exist directly on the white hero page', () => {
  assert.ok(pageSrc.includes('class="hero-card-showcase"'), 'hero-card-showcase container must exist');
  assert.ok(pageSrc.includes('id="hero-card-stage"'), 'hero-card-stage must exist');
  assert.ok(pageSrc.includes('id="nfc-spin-card"'), 'nfc-spin-card must exist');
  assert.ok(pageSrc.includes('class="hero-card-ground-shadow"'), 'hero-card-ground-shadow must exist');

  // Verify showcase is transparent on the page
  assert.ok(cssSrc.includes('.hero-card-showcase'), 'CSS defines .hero-card-showcase');
  assert.ok(cssSrc.includes('background: transparent'), 'Hero card showcase has transparent background');
});

test('3. Card appearance includes matte black PVC, rounded corners, thin gold edge, and gold contactless icon', () => {
  // Rounded corners and thin gold edge
  assert.ok(cssSrc.includes('border-radius: 16px'), 'Card faces have rounded corners');
  assert.ok(cssSrc.includes('rgba(212, 175, 55'), 'Card faces have thin gold edge border');
  assert.ok(cssSrc.includes('aspect-ratio: 1.586 / 1'), 'Standard landscape ISO card ratio 1.586 : 1');

  // Contactless icon
  assert.ok(pageSrc.includes('nfc-card-contactless-mark'), 'Contactless icon container exists');
  assert.ok(pageSrc.includes('gold-nfc-wave-svg'), 'Gold contactless wave SVG exists');
  assert.ok(pageSrc.includes('stroke="#E5C158"'), 'Waves use gold stroke');
});

test('4. Card appearance includes gold script lettering "Adhil Mohammed" and "Co-Founder"', () => {
  assert.ok(pageSrc.includes('Adhil Mohammed'), 'Front card includes "Adhil Mohammed"');
  assert.ok(pageSrc.includes('Co-Founder'), 'Front card includes "Co-Founder" title');
  assert.ok(pageSrc.includes('nfc-card-script-name'), 'Script signature element exists');
  assert.ok(cssSrc.includes('.nfc-card-script-name'), 'CSS defines .nfc-card-script-name');
  assert.ok(cssSrc.includes('.nfc-card-role-title'), 'CSS defines .nfc-card-role-title');
  assert.ok(cssSrc.includes('Great Vibes'), 'Uses cursive script font for name');
});

test('5. 3D Animation rotates card 360deg with CSS perspective and 7-second loop with brief front pause', () => {
  assert.ok(cssSrc.includes('perspective: 1200px'), 'Stage defines 3D perspective');
  assert.ok(cssSrc.includes('transform-style: preserve-3d'), 'Card preserves 3D transforms');
  assert.ok(cssSrc.includes('nfcCardContinuousSpin 7s'), 'Animation is 7s continuous spin');

  // Check keyframes for pause on front and seamless 360deg loop
  assert.ok(cssSrc.includes('@keyframes nfcCardContinuousSpin'), 'Defines nfcCardContinuousSpin keyframes');
  assert.ok(cssSrc.includes('transform: rotateY(0deg)'), 'Keyframes start and pause at 0deg');
  assert.ok(cssSrc.includes('transform: rotateY(360deg)'), 'Keyframes turn through 360deg');
});

test('6. Separate front and back faces with backface-visibility so lettering never appears mirrored', () => {
  assert.ok(pageSrc.includes('nfc-card-face--front'), 'Markup has separate front face');
  assert.ok(pageSrc.includes('nfc-card-face--back'), 'Markup has separate back face');
  assert.ok(cssSrc.includes('backface-visibility: hidden'), 'CSS sets backface-visibility: hidden');
  assert.ok(cssSrc.includes('-webkit-backface-visibility: hidden'), 'CSS sets -webkit-backface-visibility: hidden');
  assert.ok(cssSrc.includes('transform: rotateY(180deg)'), 'Back face is rotated 180deg');
  assert.ok(pageSrc.includes('nfc-card-back-brand-centered'), 'Back face has centered brand mark');
});

test('7. Stationary ground shadow and stationary "View demo profile" button directly below card', () => {
  assert.ok(pageSrc.includes('class="hero-card-ground-shadow"'), 'Stationary ground shadow exists');
  assert.ok(pageSrc.includes('class="hero-card-demo-wrap"'), 'Demo button wrap exists');
  assert.ok(pageSrc.includes('id="hero-demo-profile-trigger"'), 'hero-demo-profile-trigger button exists');
  assert.ok(cssSrc.includes('.hero-card-ground-shadow'), 'CSS styles stationary ground shadow');
  assert.ok(cssSrc.includes('radial-gradient(ellipse at center'), 'Ground shadow is soft radial ellipse');
});

test('8. Reduced motion shows front face in static resting pose', () => {
  assert.ok(cssSrc.includes('@media (prefers-reduced-motion: reduce)'), 'CSS includes reduced-motion media query');
  assert.ok(cssSrc.includes('animation: none !important'), 'Reduced motion disables rotation animation');
  assert.ok(cssSrc.includes('transform: rotateY(0deg) !important'), 'Reduced motion shows front resting pose');
  assert.ok(jsSrc.includes('initHeroCardShowcase'), 'JS includes initHeroCardShowcase');
});

test('9. Interactive tap card overlay and demo profile button trigger live demo modal', () => {
  assert.ok(pageSrc.includes('id="tap-card"'), 'Clickable #tap-card overlay button exists on card');
  assert.ok(pageSrc.includes('id="hero-demo-profile-trigger"'), 'hero-demo-profile-trigger exists');
  assert.ok(jsSrc.includes("heroCard?.addEventListener('click', openDemoModal)"), 'tap-card triggers openDemoModal');
  assert.ok(jsSrc.includes("heroDemoTrigger?.addEventListener('click', openDemoModal)"), 'demo trigger triggers openDemoModal');
});

test('10. Mobile responsive layout scales card and prevents corner clipping at 390px', () => {
  assert.ok(cssSrc.includes('@media (max-width: 768px)'), 'Mobile 768px query exists');
  assert.ok(cssSrc.includes('@media (max-width: 480px)'), 'Mobile 480px query exists');
  assert.ok(cssSrc.includes('overflow: visible'), 'Overflow visible ensures rotating 3D corners are not clipped');
});

