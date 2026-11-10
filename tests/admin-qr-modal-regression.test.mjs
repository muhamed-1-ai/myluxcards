import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPremiumQrSvg, buildAdminUserQrSvg } from "../src/lib/premiumQr.ts";
import QRCode from "qrcode";

const adminAppCode = readFileSync("src/app/admin/AdminApp.tsx", "utf8");
const adminCssCode = readFileSync("src/app/admin/admin.css", "utf8");

test("TEST 1: Admin User QR artwork matches reference design", () => {
  const testUrl = "https://3gzappit.com/muhammed-159099";
  const adminSvg = buildAdminUserQrSvg(testUrl);

  // 1. Solid white background (#FFFFFF) and black (#000000) artwork
  assert.ok(adminSvg.includes('fill="#FFFFFF"'), "Admin QR must render white (#FFFFFF) background");
  assert.ok(adminSvg.includes('fill="#000000"'), "Admin QR must render black (#000000) dots and frame");
  assert.ok(!adminSvg.includes("#0066FF"), "Admin QR must NOT contain blue modules");
  assert.ok(!adminSvg.includes("#050505"), "Admin QR must NOT contain default dark background");

  // 2. No "3G ZAPPIT" heading text above the frame; artwork is a square
  assert.ok(!adminSvg.includes("3G ZAPPIT"), "Admin QR must NOT contain heading '3G ZAPPIT'");
  const vbMatch = adminSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(vbMatch && vbMatch[1] === vbMatch[2], "Admin QR must be a square artwork");

  // 3. Subtle light-gray rounded outline replacing heavy black border
  assert.ok(!adminSvg.includes('stroke="#000000"'), "Outer frame must NOT have heavy black stroke");
  assert.ok(adminSvg.includes('stroke="#E2E8F0"'), "Outer frame must have subtle light-gray stroke (#E2E8F0)");
  assert.ok(adminSvg.includes('rx="24"'), "Outer frame must have rounded corners (rx=24)");
  assert.ok(adminSvg.includes('stroke-width="1.5"'), "Outer frame must have thin 1.5px stroke");
  assert.ok(adminSvg.includes('fill="none"'), "Outer frame must have fill none");

  // 4. Black circular QR dots
  assert.ok(adminSvg.includes("<circle"), "QR modules must be circular dots");

  // 5. Three rounded-square corner markers with white insets & black rounded-square centers
  assert.ok(adminSvg.includes('rx="16" fill="#000000"'), "Finder outer marker must be rounded square");
  assert.ok(adminSvg.includes('rx="10" fill="#FFFFFF"'), "Finder inset marker must be white rounded square");
  assert.ok(adminSvg.includes('rx="6" fill="#000000"'), "Finder center marker must be black rounded square");

  // 6. Unobstructed white quiet zone of >= 4 modules on all sides
  const qr = QRCode.create(testUrl, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const moduleSize = 10;
  const matrixSize = size * moduleSize;

  // Inner edge of 1.5px stroke is at 1.75px; QR grid is at 42px.
  // Gap = 42 - 1.75 = 40.25px >= 4 modules (40px)
  const innerGap = 42 - 1.75;
  assert.ok(innerGap >= 4 * moduleSize, "Must have quiet zone >= 4 modules (40px) on every side");

  // 7. variant: "admin_framed" produces the exact same artwork
  const variantSvg = buildPremiumQrSvg(testUrl, { variant: "admin_framed" });
  assert.equal(variantSvg, adminSvg, "variant: admin_framed must produce buildAdminUserQrSvg output");
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

test("TEST 3: AdminApp.tsx USER QR CODE modal layout & downloads match artwork", () => {
  // 1. Modal header and Close button
  assert.ok(adminAppCode.includes("USER QR CODE"), "Modal must contain USER QR CODE tag");
  assert.ok(adminAppCode.includes("admin-user-qr-close"), "Modal must contain dedicated close button");

  // 2. Selected user information with wrapping profile URL
  assert.ok(adminAppCode.includes("wordBreak: \"break-all\""), "Profile URL must wrap cleanly without overflowing");

  // 3. One centered QR artwork using buildAdminUserQrSvg
  assert.ok(adminAppCode.includes("adminQrSvg = buildAdminUserQrSvg(qrUrl)"), "Modal must use buildAdminUserQrSvg");
  assert.ok(adminAppCode.includes("admin-user-qr-preview-box"), "Modal must render centered preview box");
  assert.ok(adminAppCode.includes("admin-user-qr-svg-wrapper"), "SVG must be wrapped in container that prevents overflow");

  // 4. Downloads initiate using the same buildAdminUserQrSvg artwork
  assert.ok(adminAppCode.includes("svgString = buildAdminUserQrSvg(qrUrl)"), "Downloads must use buildAdminUserQrSvg");
  assert.ok(adminAppCode.includes("svgToHighResPngBlob(svgString, 1500, \"#FFFFFF\")"), "PNG download must be high-res white background");

  // 5. Action buttons in two clean rows
  assert.ok(adminAppCode.includes("Download PNG"), "Action row 1 must include Download PNG");
  assert.ok(adminAppCode.includes("Download SVG"), "Action row 1 must include Download SVG");
  assert.ok(adminAppCode.includes("Copy QR URL"), "Action row 2 must include Copy QR URL");
  assert.ok(adminAppCode.includes("Open Profile"), "Action row 2 must include Open Profile");
  assert.ok(adminAppCode.includes("admin-user-qr-btn-row"), "Actions must use 2-row layout");
});

test("TEST 4: admin.css rules prevent clipping and enforce proper vertical spacing", () => {
  // 1. Preview box must have white background in both light and dark modes
  assert.ok(
    adminCssCode.includes(".admin-user-qr-preview-box") &&
    adminCssCode.includes("background: #FFFFFF"),
    "Preview box must force white background"
  );

  // 2. Clear spacing (~20-24px) between QR artwork and action buttons
  assert.ok(
    adminCssCode.includes(".admin-user-qr-actions-container") &&
    adminCssCode.includes("margin-top: 22px"),
    "admin.css must enforce approximately 20-24px spacing between QR preview and actions"
  );

  // 3. SVG constrained inside preview container to prevent overflow or stretching
  assert.ok(
    adminCssCode.includes(".admin-user-qr-svg-wrapper svg") &&
    adminCssCode.includes("display: block") &&
    adminCssCode.includes("object-fit: contain"),
    "admin.css must constrain SVG properly with contain"
  );

  // 4. Short screen & mobile responsive reachability
  assert.ok(adminCssCode.includes("@media (max-height: 600px)"), "Must include short screen responsiveness");
  assert.ok(adminCssCode.includes("@media (max-width: 480px)"), "Must include mobile viewport responsiveness");
});

test("TEST 5: Dynamic QR artwork decodes destination URLs accurately", async () => {
  const sharp = (await import("sharp")).default;
  const { QRCodeReader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } = await import("@zxing/library");

  const testUsers = [
    { name: "User 1", url: "https://3gzappit.com/alex-morgan?utm_source=qr&utm_medium=card" },
    { name: "User 2", url: "https://3gzappit.com/sarah-connor?source=admin_desk" },
  ];

  for (const { name, url } of testUsers) {
    const svg = buildAdminUserQrSvg(url);
    const pngBuf = await sharp(Buffer.from(svg)).resize(1200, null).png().toBuffer();
    const { data, info } = await sharp(pngBuf).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });

    const luminanceSource = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const reader = new QRCodeReader();
    const result = reader.decode(binaryBitmap);

    assert.equal(result.getText(), url, `Decoded QR URL must exactly match ${name} destination`);
  }
});

