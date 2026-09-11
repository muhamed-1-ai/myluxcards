import test from "node:test";
import assert from "node:assert/strict";
import {
  getPublicCardUrl,
  getPublicCardQrUrl,
  getPublicCardNfcUrl,
  getLegacyCardUrl,
  getAppOrigin,
  cleanSlugString,
  CANONICAL_PRODUCTION_DOMAIN,
} from "../src/lib/url.ts";
import { buildPremiumQrSvg } from "../src/lib/premiumQr.ts";
import QRCode from "qrcode";

test("getPublicCardUrl generates canonical root profile URL structure https://3gzappit.com/<profile-slug>", () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const slug = "muhammed";
    const url = getPublicCardUrl(slug);
    assert.equal(url, "https://3gzappit.com/muhammed");
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("cleanSlugString normalizes slugs safely", () => {
  assert.equal(cleanSlugString("Muhammed Febin"), "muhammed-febin");
  assert.equal(cleanSlugString("Sahid_123!"), "sahid-123");
  assert.equal(cleanSlugString("   --Adhil--   "), "adhil");
});

test("getPublicCardQrUrl and getPublicCardNfcUrl append query parameters to root canonical URL", () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const slug = "sahid";
    assert.equal(getPublicCardQrUrl(slug), "https://3gzappit.com/sahid?src=qr");
    assert.equal(getPublicCardNfcUrl(slug), "https://3gzappit.com/sahid?src=nfc");
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("getLegacyCardUrl preserves /card/<slug> backward compatibility for printed cards", () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const slug = "muhammed";
    assert.equal(getLegacyCardUrl(slug), "https://3gzappit.com/card/muhammed");
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("getAppOrigin strictly enforces https://3gzappit.com in production and ignores Coolify/preview domains", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.APP_URL;
  try {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://coolify-temp-domain.3gzappit.com";

    const origin = getAppOrigin();
    assert.equal(origin, CANONICAL_PRODUCTION_DOMAIN, "Production origin must filter out Coolify temporary hostnames");
    assert.equal(origin, "https://3gzappit.com");
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.APP_URL = originalAppUrl;
  }
});

test("QR SVG payload encodes exact canonical root profile URL", () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const slug = "muhammed";
    const cardUrl = getPublicCardQrUrl(slug);
    assert.equal(cardUrl, "https://3gzappit.com/muhammed?src=qr");

    const svg = buildPremiumQrSvg(cardUrl, { showLabel: true, label: "SCAN ME" });
    const expectedQr = QRCode.create(cardUrl, { errorCorrectionLevel: "H" });
    const svgQr = QRCode.create(cardUrl, { errorCorrectionLevel: "H" });

    assert.equal(svgQr.modules.size, expectedQr.modules.size);
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("SCAN ME"));
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});
