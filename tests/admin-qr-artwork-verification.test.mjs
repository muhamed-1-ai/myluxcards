import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { QRCodeReader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } from "@zxing/library";
import { buildAdminUserQrSvg, buildPremiumQrSvg } from "../src/lib/premiumQr.ts";

async function decodeImageBuffer(buf) {
  const { data, info } = await sharp(buf)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminanceSource = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
  const reader = new QRCodeReader();
  return reader.decode(binaryBitmap).getText();
}

test("Verification: Two different users scan accurately from preview and exported PNG/SVG", async () => {
  const users = [
    {
      name: "Shamseena Sahid",
      url: "https://3gzappit.com/shamseena-sahid-10841?src=qr"
    },
    {
      name: "Nihas K",
      url: "https://3gzappit.com/nihas-k-154395?src=qr"
    }
  ];

  for (const user of users) {
    const svg = buildAdminUserQrSvg(user.url);

    // 1. Check no 3G ZAPPIT text
    assert.ok(!svg.includes("3G ZAPPIT"), `SVG for ${user.name} must not contain '3G ZAPPIT'`);

    // 2. Check 1:1 square aspect ratio
    const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    assert.ok(match, "ViewBox must be present");
    assert.equal(match[1], match[2], `SVG for ${user.name} must be square (${match[1]}x${match[2]})`);

    // 3. Check solid pure-black rounded border
    assert.ok(svg.includes('stroke="#000000"'), "Outer frame must have solid pure-black stroke");
    assert.ok(!svg.includes('stroke="#E2E8F0"'), "Outer frame must NOT have faint gray stroke");
    assert.ok(svg.includes('rx="28"'), "Outer frame must have rx=28 rounded corners");
    const swMatch = svg.match(/stroke-width="([^"]+)"/);
    assert.ok(swMatch, "Stroke width must be defined");
    const strokeWidth = parseFloat(swMatch[1]);
    const totalW = parseFloat(match[1]);
    const scaledAt680 = strokeWidth * (680 / totalW);
    assert.ok(scaledAt680 >= 6.8 && scaledAt680 <= 8.5, `Border thickness at 680px must be roughly 7-8px (got ${scaledAt680.toFixed(2)}px)`);

    // 4. Check circular dots
    assert.ok(svg.includes('<circle'), "QR modules must be circular dots");

    // 5. Check 3 rounded corner markers
    assert.ok(svg.includes('rx="16" fill="#000000"'), "Outer finder eye must be rounded");
    assert.ok(svg.includes('rx="10" fill="#FFFFFF"'), "Finder gap must be rounded");
    assert.ok(svg.includes('rx="6" fill="#000000"'), "Inner finder eye must be rounded");

    // 6. Test SVG preview decode (browser rendering simulation at 260px and 600px)
    const previewPngBuf = await sharp(Buffer.from(svg)).resize(260, 260).png().toBuffer();
    const decodedPreview = await decodeImageBuffer(previewPngBuf);
    assert.equal(decodedPreview, user.url, `Preview decode for ${user.name} must match exact URL`);

    // 7. Test Exported High-Res PNG decode (1500x1500px download simulation)
    const downloadPngBuf = await sharp(Buffer.from(svg)).resize(1500, 1500).png().toBuffer();
    const decodedDownload = await decodeImageBuffer(downloadPngBuf);
    assert.equal(decodedDownload, user.url, `Download PNG decode for ${user.name} must match exact URL`);

    // 8. Test SVG download decode (vector rendered at native size)
    const nativePngBuf = await sharp(Buffer.from(svg)).png().toBuffer();
    const decodedNative = await decodeImageBuffer(nativePngBuf);
    assert.equal(decodedNative, user.url, `Download SVG decode for ${user.name} must match exact URL`);
  }
});

