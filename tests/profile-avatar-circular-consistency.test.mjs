import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const globalsCssPath = path.join(rootDir, "src/app/globals.css");
const simpleProfileCssPath = path.join(rootDir, "src/app/simple-profile.css");
const publicCardCssPath = path.join(rootDir, "src/app/card/[slug]/public-card.css");
const modernLayoutPath = path.join(rootDir, "src/components/card/ModernProfileLayout.tsx");
const simpleLayoutPath = path.join(rootDir, "src/components/card/SimpleProfileLayout.tsx");

test("Profile Avatar Circular Consistency Verification Suite", async (t) => {
  const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
  const simpleCss = fs.readFileSync(simpleProfileCssPath, "utf8");
  const publicCardCss = fs.readFileSync(publicCardCssPath, "utf8");
  const modernLayout = fs.readFileSync(modernLayoutPath, "utf8");
  const simpleLayout = fs.readFileSync(simpleLayoutPath, "utf8");

  await t.test("1. No asymmetric max-width: calc(100% - 32px) on avatar circles", () => {
    assert.doesNotMatch(
      globalsCss,
      /\.zappit-modern-avatar-circle[\s\S]*?max-width:\s*calc\(100%\s*-\s*32px\)/,
      "globals.css must not squeeze avatar width with calc(100% - 32px)"
    );
    assert.doesNotMatch(
      simpleCss,
      /\.zappit-simple-photo-ring[\s\S]*?max-width:\s*calc\(100%\s*-\s*32px\)/,
      "simple-profile.css must not squeeze avatar width with calc(100% - 32px)"
    );
  });

  await t.test("2. Avatar containers enforce aspect-ratio: 1 / 1, border-radius: 50%, and flex-shrink: 0", () => {
    assert.match(
      globalsCss,
      /\.zappit-modern-avatar-circle,[\s\S]*?\.zappit-modern-avatar-ring\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/i,
      "globals.css modern avatar circle enforces aspect-ratio: 1 / 1"
    );
    assert.match(
      globalsCss,
      /\.zappit-modern-avatar-circle,[\s\S]*?\.zappit-modern-avatar-ring\s*\{[\s\S]*?border-radius:\s*50%/i,
      "globals.css modern avatar circle enforces border-radius: 50%"
    );
    assert.match(
      globalsCss,
      /\.zappit-modern-avatar-circle,[\s\S]*?\.zappit-modern-avatar-ring\s*\{[\s\S]*?flex-shrink:\s*0/i,
      "globals.css modern avatar circle enforces flex-shrink: 0"
    );
    assert.match(
      globalsCss,
      /\.zappit-modern-avatar-anchor,[\s\S]*?\.zappit-simple-avatar-anchor\s*\{[\s\S]*?flex-shrink:\s*0/i,
      "globals.css avatar anchors enforce flex-shrink: 0"
    );

    assert.match(
      simpleCss,
      /\.zappit-simple-photo-ring\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/i,
      "simple-profile.css photo ring enforces aspect-ratio: 1 / 1"
    );
    assert.match(
      simpleCss,
      /\.zappit-simple-photo-ring\s*\{[\s\S]*?border-radius:\s*50%/i,
      "simple-profile.css photo ring enforces border-radius: 50%"
    );
  });

  await t.test("3. Avatar images fill container with object-fit: cover without stretching", () => {
    assert.match(
      globalsCss,
      /\.zappit-modern-avatar-img\s*\{[\s\S]*?object-fit:\s*cover/i,
      "globals.css modern avatar image uses object-fit: cover"
    );
    assert.match(
      globalsCss,
      /\.zappit-modern-avatar-img\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/i,
      "globals.css modern avatar image uses aspect-ratio: 1 / 1"
    );
    assert.match(
      simpleCss,
      /\.zappit-simple-photo-img\s*\{[\s\S]*?object-fit:\s*cover/i,
      "simple-profile.css photo image uses object-fit: cover"
    );
    assert.match(
      simpleCss,
      /\.zappit-simple-photo-img\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/i,
      "simple-profile.css photo image uses aspect-ratio: 1 / 1"
    );
  });

  await t.test("4. public-card.css includes scoped circular avatar constraints", () => {
    assert.match(
      publicCardCss,
      /\.zappit-modern-avatar-circle,[\s\S]*?\.zappit-simple-photo-ring\s*\{[\s\S]*?border-radius:\s*50%/i,
      "public-card.css enforces border-radius: 50%"
    );
    assert.match(
      publicCardCss,
      /\.zappit-modern-avatar-circle,[\s\S]*?\.zappit-simple-photo-ring\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/i,
      "public-card.css enforces aspect-ratio: 1 / 1"
    );
    assert.match(
      publicCardCss,
      /\.zappit-modern-avatar-circle,[\s\S]*?\.zappit-simple-photo-ring\s*\{[\s\S]*?overflow:\s*hidden/i,
      "public-card.css enforces overflow: hidden"
    );
    assert.match(
      publicCardCss,
      /\.zappit-modern-avatar-img,[\s\S]*?\.zappit-simple-photo-img\s*\{[\s\S]*?object-fit:\s*cover/i,
      "public-card.css enforces object-fit: cover"
    );
  });

  await t.test("5. ModernProfileLayout and SimpleProfileLayout inline styles reinforce 1:1 aspect ratio", () => {
    assert.match(
      modernLayout,
      /aspectRatio:\s*"1 \/ 1"/,
      "ModernProfileLayout specifies aspectRatio: '1 / 1'"
    );
    assert.match(
      modernLayout,
      /flexShrink:\s*0/,
      "ModernProfileLayout specifies flexShrink: 0"
    );
    assert.match(
      simpleLayout,
      /aspectRatio:\s*"1 \/ 1"/,
      "SimpleProfileLayout specifies aspectRatio: '1 / 1'"
    );
    assert.match(
      simpleLayout,
      /flexShrink:\s*0/,
      "SimpleProfileLayout specifies flexShrink: 0"
    );
  });
});

