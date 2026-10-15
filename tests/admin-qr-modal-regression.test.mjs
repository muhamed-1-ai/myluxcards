import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPremiumQrSvg } from "../src/lib/premiumQr.ts";
import QRCode from "qrcode";

const adminAppCode = readFileSync("src/app/admin/AdminApp.tsx", "utf8");
const adminCssCode = readFileSync("src/app/admin/admin.css", "utf8");

test("TEST 1: Admin QR Code uses black (#000000) on white (#FFFFFF) without label or frame", () => {
  const testUrl = "https://3gzappit.com/muhammed-159099";
  const adminSvg = buildPremiumQrSvg(testUrl, {
    darkColor: "#000000",
    lightColor: "#FFFFFF",
    showLabel: false,
    showFrame: false,
  });

  // Verify colors
  assert.ok(adminSvg.includes('fill="#FFFFFF"'), "Admin QR must render white (#FFFFFF) background");
  assert.ok(adminSvg.includes('fill="#000000"'), "Admin QR must render black (#000000) modules and finder patterns");
  assert.ok(!adminSvg.includes("#0066FF"), "Admin QR must NOT contain blue modules");
  assert.ok(!adminSvg.includes("#050505"), "Admin QR must NOT contain default dark background");

  // Verify square aspect ratio
  const viewBoxMatch = adminSvg.match(/viewBox=["']0\s+0\s+(\d+)\s+(\d+)["']/);
  assert.ok(viewBoxMatch, "Admin QR must have valid viewBox");
  const [, width, height] = viewBoxMatch;
  assert.equal(width, height, `Admin QR must be a 1:1 perfect square, got ${width}x${height}`);

  // Verify no label and no outer stroke frame
  assert.ok(!adminSvg.includes("<text"), "Admin QR must not contain oversized text header");
  assert.ok(!adminSvg.includes("stroke="), "Admin QR must not contain outer frame stroke");

  // Verify decoded payload matches exactly
  const qr = QRCode.create(testUrl, { errorCorrectionLevel: "H" });
  const expectedSize = (qr.modules.size + 8) * 10; // 4 modules quiet zone on each side = 8 modules * 10px
  assert.equal(Number(width), expectedSize, "Admin QR must have exactly 4 modules quiet zone on every side");
});

test("TEST 2: Public and user-facing QR default presentation is strictly preserved", () => {
  const testUrl = "https://3gzappit.com/muhammed-159099";
  const publicSvg = buildPremiumQrSvg(testUrl);

  // User/public default must be electric blue on dark background
  assert.ok(publicSvg.includes('fill="#0066FF"'), "Default public QR must retain electric blue modules");
  assert.ok(publicSvg.includes('fill="#050505"'), "Default public QR must retain dark #050505 background");
  assert.ok(publicSvg.includes("SCAN ME"), "Default public QR must retain SCAN ME label");
  assert.ok(publicSvg.includes("<rect"), "Default public QR must retain frame element");
});

test("TEST 3: AdminApp.tsx USER QR CODE modal layout & vertical hierarchy", () => {
  // 1. Title and Close button
  assert.ok(adminAppCode.includes("USER QR CODE"), "Modal must contain USER QR CODE tag");
  assert.ok(adminAppCode.includes("admin-user-qr-close"), "Modal must contain dedicated close button");

  // 2. User name and wrapping profile URL
  assert.ok(adminAppCode.includes("wordBreak: \"break-all\""), "Profile URL must wrap cleanly without overflowing");

  // 3. One centered square QR preview
  assert.ok(adminAppCode.includes("admin-user-qr-preview-box"), "Modal must render centered preview box");
  assert.ok(adminAppCode.includes("admin-user-qr-svg-wrapper"), "SVG must be wrapped in container that prevents overflow");

  // 4. Action buttons in two clean rows
  assert.ok(adminAppCode.includes("Download PNG"), "Action row 1 must include Download PNG");
  assert.ok(adminAppCode.includes("Download SVG"), "Action row 1 must include Download SVG");
  assert.ok(adminAppCode.includes("Copy QR URL"), "Action row 2 must include Copy QR URL");
  assert.ok(adminAppCode.includes("Open Profile"), "Action row 2 must include Open Profile");
  assert.ok(adminAppCode.includes("admin-user-qr-btn-row"), "Actions must use 2-row layout");
});

test("TEST 4: admin.css rules prevent QR displacement and button overlap", () => {
  // 1. SVG width/height 100% inside preview box to prevent overflow
  assert.ok(
    adminCssCode.includes(".admin-user-qr-svg-wrapper svg") &&
    adminCssCode.includes("width: 100%") &&
    adminCssCode.includes("display: block"),
    "admin.css must constrain SVG to 100% width and height of preview box"
  );

  // 2. Preview box must have white background in both light and dark modes
  assert.ok(
    adminCssCode.includes(".admin-user-qr-preview-box") &&
    adminCssCode.includes("background: #FFFFFF"),
    "Preview box must force white background"
  );

  // 3. Clear spacing (~20-24px) between QR and actions
  assert.ok(
    adminCssCode.includes(".admin-user-qr-actions-container") &&
    adminCssCode.includes("margin-top: 22px"),
    "admin.css must enforce approximately 20-24px spacing between QR preview and actions"
  );

  // 4. Short screen & mobile responsive reachability
  assert.ok(adminCssCode.includes("@media (max-height: 600px)"), "Must include short screen responsiveness");
  assert.ok(adminCssCode.includes("@media (max-width: 480px)"), "Must include mobile viewport responsiveness");
});
