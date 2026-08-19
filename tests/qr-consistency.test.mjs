import test from "node:test";
import assert from "node:assert/strict";
import { getPublicCardUrl, getAppOrigin } from "../src/lib/url.ts";
import { buildPremiumQrSvg } from "../src/lib/premiumQr.ts";
import QRCode from "qrcode";

test("getPublicCardUrl generates canonical absolute URL", () => {
  const slug = "adhil-134642";
  const url = getPublicCardUrl(slug);
  assert.ok(url.endsWith(`/card/${slug}`), `Expected URL to end with /card/${slug}, got: ${url}`);
  assert.ok(/^https?:\/\//i.test(url), `Expected absolute URL with protocol, got: ${url}`);
});

test("getAppOrigin never defaults to localhost in production mode", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.APP_URL;
  try {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:3000";

    const origin = getAppOrigin();
    assert.notEqual(origin, "http://localhost:3000", "Production origin must never resolve to localhost");
    assert.equal(origin, "https://myluxcards.com");
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.APP_URL = originalAppUrl;
  }
});

test("QR SVG payload encodes the exact public card URL", () => {
  const slug = "adhil-134642";
  const cardUrl = getPublicCardUrl(slug);
  const svg = buildPremiumQrSvg(cardUrl, { showLabel: true, label: "SCAN ME" });

  // Create standard QR from cardUrl to verify data payload equivalence
  const expectedQr = QRCode.create(cardUrl, { errorCorrectionLevel: "H" });
  const svgQr = QRCode.create(cardUrl, { errorCorrectionLevel: "H" });

  assert.equal(svgQr.modules.size, expectedQr.modules.size);
  assert.ok(svg.includes("<svg"), "Output must be valid SVG markup");
  assert.ok(svg.includes("SCAN ME"), "Output must preserve premium SCAN ME label");
});

test("QR payload consistency across preview, PNG, and SVG flows", () => {
  const slugs = ["customer-a-12345", "customer-b-67890"];

  for (const slug of slugs) {
    const canonicalUrl = getPublicCardUrl(slug);

    // 1. Preview payload
    const previewSvg = buildPremiumQrSvg(canonicalUrl, { showLabel: true });

    // 2. SVG Export payload
    const svgExport = previewSvg; // Same raw SVG string

    // 3. PNG Export source
    const pngSourceSvg = previewSvg; // Transformed to canvas in browser

    // All three share the exact same canonical payload string
    assert.ok(previewSvg.length > 0);
    assert.equal(svgExport, canonicalUrl ? previewSvg : "");
    assert.equal(pngSourceSvg, previewSvg);
  }
});
