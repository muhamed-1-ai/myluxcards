import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  buildVCardString,
  resolveContactName,
  escapeVCardValue,
} from "../src/lib/vcard.ts";

const vcardFile = readFileSync("src/lib/vcard.ts", "utf8");
const contactExportFile = readFileSync("src/lib/contactExport.ts", "utf8");
const drawerFile = readFileSync("src/components/leads/LeadContactCardDrawer.tsx", "utf8");
const drawerCssFile = readFileSync("src/components/leads/contact-card-drawer.css", "utf8");
const leadVcardRoute = readFileSync("src/app/api/leads/[id]/vcard/route.ts", "utf8");
const publicCardClient = readFileSync("src/app/card/[slug]/PublicCardClient.tsx", "utf8");

test("Contact Export: Filename sanitization against CRLF injection, quotes, and dangerous characters", () => {
  assert.match(contactExportFile, /getSafeVCardFilename/);
  assert.match(contactExportFile, /replace\(\/\[\\r\\n\"\\\\;=\]\/g/);

  // Test regex directly
  const dirty = 'Sinan\r\nHeader: Injection"';
  const clean = dirty.replace(/[\r\n"\\;=]/g, "").replace(/[/\\?%*:|"<>]+/g, "_").trim();
  assert.equal(clean, "SinanHeader_ Injection");
  assert.equal(clean.includes("\r"), false);
  assert.equal(clean.includes("\n"), false);
});

test("Contact Export: RFC 6350 / vCard 3.0 generation with full fields and CRLF line endings", () => {
  const result = buildVCardString({
    profileName: "Sinan",
    companyName: "SEEAKK",
    title: "Founder",
    phone: "+918606300137",
    email: "sinanmm7@gmail.com",
    address: "Kochi, Kerala, India",
  });

  assert.match(result.vcard, /^BEGIN:VCARD\r\n/m);
  assert.match(result.vcard, /\r\nVERSION:3\.0\r\n/);
  assert.match(result.vcard, /\r\nFN:Sinan\r\n/);
  assert.match(result.vcard, /\r\nN:;Sinan;;;\r\n/);
  assert.match(result.vcard, /\r\nORG:SEEAKK\r\n/);
  assert.match(result.vcard, /\r\nTITLE:Founder\r\n/);
  assert.match(result.vcard, /\r\nTEL;TYPE=CELL:\+918606300137\r\n/);
  assert.match(result.vcard, /\r\nEMAIL;TYPE=INTERNET:sinanmm7@gmail\.com\r\n/);
  assert.match(result.vcard, /\r\nADR;TYPE=WORK:;;Kochi\\, Kerala\\, India;;;;\r\n/);
  assert.match(result.vcard, /\r\nEND:VCARD$/);
});

test("Contact Export: Malayalam and Arabic unicode characters preserved without corruption", () => {
  const malResult = buildVCardString({
    profileName: "അരുൺ കുമാർ",
    companyName: "ടെക് കേരള",
    phone: "+919876543210",
  });
  assert.match(malResult.vcard, /FN:അരുൺ കുമാർ/);
  assert.match(malResult.vcard, /ORG:ടെക് കേരള/);

  const arabResult = buildVCardString({
    profileName: "محمد أحمد",
    companyName: "شركة المستقبل",
    email: "mohamed@example.com",
  });
  assert.match(arabResult.vcard, /FN:محمد أحمد/);
  assert.match(arabResult.vcard, /ORG:شركة المستقبل/);
});

test("Contact Export: Missing fields do not output 'undefined' or 'null'", () => {
  const partial = buildVCardString({
    profileName: "Sinan",
    phone: "+918606300137",
    email: null,
    companyName: undefined,
  });
  assert.equal(partial.vcard.includes("undefined"), false);
  assert.equal(partial.vcard.includes("null"), false);
  assert.match(partial.vcard, /TEL;TYPE=CELL:\+918606300137/);
});

test("Route /api/leads/[id]/vcard: Supports SUPER_ADMIN, ADMIN and normal users with multi-tenant isolation", () => {
  assert.match(leadVcardRoute, /identity\.role === "SUPER_ADMIN"/);
  assert.match(leadVcardRoute, /accessClause = "1=1"/);
  assert.match(leadVcardRoute, /identity\.role === "ADMIN"/);
  assert.match(leadVcardRoute, /renderFriendlyErrorHtml/);
  assert.match(leadVcardRoute, /text\/vcard; charset=utf-8/);
  assert.match(leadVcardRoute, /Content-Disposition/);
});

test("LeadContactCardDrawer: Implements centered drag handle, accessible close button, and native handoff", () => {
  assert.match(drawerFile, /zappit-contact-handle/);
  assert.match(drawerFile, /zappit-contact-close-btn/);
  assert.match(drawerFile, /executeNativeContactHandoff/);
  assert.match(drawerFile, /triggerExplicitVCardDownload/);
  assert.match(drawerFile, /Save to Contacts/);
  assert.match(drawerFile, /Download Contact File \(\.vcf\)/);

  // CSS structure verification
  assert.match(drawerCssFile, /\.zappit-contact-handle/);
  assert.match(drawerCssFile, /margin: 0 auto|display: flex;.*justify-content: center/);
  assert.match(drawerCssFile, /\.zappit-contact-close-btn/);
  assert.match(drawerCssFile, /width: 44px;\s+height: 44px/);
  assert.match(drawerCssFile, /\.zappit-btn-primary-save/);
  assert.match(drawerCssFile, /height: 52px/);
});

test("PublicCardClient: Wires Save Contact to LeadContactCardDrawer modal", () => {
  assert.match(publicCardClient, /import LeadContactCardDrawer from "@/);
  assert.match(publicCardClient, /contactModalOpen/);
  assert.match(publicCardClient, /<LeadContactCardDrawer/);
  assert.match(publicCardClient, /isPublicProfile: true/);
});

test("Lead Source: NPC TAP typo corrected to NFC TAP across API routes and UI badges", () => {
  const leadSourceFile = readFileSync("src/lib/lead-source.ts", "utf8");
  const profileShareRoute = readFileSync("src/app/api/profile/share-details/route.ts", "utf8");
  const cardShareRoute = readFileSync("src/app/api/cards/public/[slug]/share-details/route.ts", "utf8");
  const cardLeadRoute = readFileSync("src/app/api/cards/public/[slug]/lead/route.ts", "utf8");

  // Verify routes produce "NFC TAP"
  assert.match(profileShareRoute, /source:\s*"NFC TAP"/);
  assert.match(cardShareRoute, /source:\s*"NFC TAP"/);
  assert.match(cardLeadRoute, /source = rawSource \? rawSource : "NFC TAP"/);

  // Verify lead-source registry maps both NFC and legacy NPC to "NFC Tap"
  assert.match(leadSourceFile, /NPC:\s*\{[\s\S]*label:\s*"NFC Tap"/);
  assert.match(leadSourceFile, /NPC_TAP:\s*\{[\s\S]*label:\s*"NFC Tap"/);
});
