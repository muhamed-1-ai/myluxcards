import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildVCardString } from "../src/lib/vcard.ts";

const contactExportCode = readFileSync("src/lib/contactExport.ts", "utf8");
const drawerCode = readFileSync("src/components/leads/LeadContactCardDrawer.tsx", "utf8");
const workspaceCode = readFileSync("src/components/leads/LeadsWorkspace.tsx", "utf8");
const leadVcardRoute = readFileSync("src/app/api/leads/[id]/vcard/route.ts", "utf8");
const publicVcardRoute = readFileSync("src/app/api/cards/public/[slug]/vcard/route.ts", "utf8");

test("TEST 1: Elimination of Web Share API and Unwanted System Share Sheet", () => {
  // 1. Verify navigator.share is NOT invoked anywhere in contactExport.ts
  assert.equal(
    contactExportCode.includes("navigator.share"),
    false,
    "executeNativeContactHandoff must NOT invoke navigator.share (which opens the unwanted iPhone share sheet)"
  );

  // 2. Verify navigator.canShare is NOT checked with files in contactExport.ts
  assert.equal(
    contactExportCode.includes("navigator.canShare"),
    false,
    "executeNativeContactHandoff must NOT branch on navigator.canShare with files"
  );

  // 3. Verify normal user-initiated navigation to the authorized HTTPS .vcf resource is used for iOS
  assert.ok(
    contactExportCode.includes("window.location.href = endpointUrl"),
    "iOS handoff must navigate directly to the authorized HTTPS .vcf resource on same origin"
  );
});

test("TEST 2: Direct HTTPS vCard Navigation & Pre-Verification", () => {
  // 1. Endpoint resolution for leads
  assert.ok(
    contactExportCode.includes("/api/leads/${encodeURIComponent(contact.id)}/vcard"),
    "Must target the authorized /api/leads/[id]/vcard endpoint for leads"
  );

  // 2. Pre-verification check prevents navigation to 401/403/404/500 error pages
  assert.ok(
    contactExportCode.includes("res.status === 401") &&
    contactExportCode.includes("res.status === 403") &&
    contactExportCode.includes("res.status === 404"),
    "Must check HTTP status codes before navigation to prevent navigating into error screens"
  );

  // 3. Body verification ensures valid vCard bytes (not HTML error or JSON)
  assert.ok(
    contactExportCode.includes('bodyText.startsWith("BEGIN:VCARD")'),
    "Must verify that response starts with BEGIN:VCARD before handing off"
  );
});

test("TEST 3: Endpoint Headers & Compliance in /api/leads/[id]/vcard/route.ts", () => {
  // 1. MIME type must be text/vcard; charset=utf-8
  assert.ok(
    leadVcardRoute.includes('"Content-Type": "text/vcard; charset=utf-8"'),
    "MIME type must be text/vcard; charset=utf-8"
  );

  // 2. Content-Disposition: inline by default, attachment for ?download=1
  assert.ok(
    leadVcardRoute.includes("const isExplicitDownload =") &&
    leadVcardRoute.includes('url.searchParams.get("download") === "1"'),
    "Must support ?download=1 query parameter"
  );
  assert.ok(
    leadVcardRoute.includes("inline"),
    "Default disposition must be inline for native contact preview"
  );
  assert.ok(
    leadVcardRoute.includes("attachment"),
    "Explicit download disposition must be attachment"
  );

  // 3. Cache-Control: private, no-store, must-revalidate
  assert.ok(
    leadVcardRoute.includes("no-store") &&
    leadVcardRoute.includes("must-revalidate"),
    "Response must exclude shared caching"
  );

  // 4. Authorization & multi-tenant isolation
  assert.ok(
    leadVcardRoute.includes("currentIdentity(request)"),
    "Must check server session identity"
  );
  assert.ok(
    leadVcardRoute.includes("SUPER_ADMIN") &&
    leadVcardRoute.includes("ADMIN"),
    "Must enforce role-based access control and tenant isolation"
  );

  // 5. Includes address, custom field title/designation, and exact phone format
  assert.ok(
    leadVcardRoute.includes("l.address"),
    "Must query lead address"
  );
  assert.ok(
    leadVcardRoute.includes("designation"),
    "Must lookup designation/title"
  );
});

test("TEST 4: Contact Sheet Drawer Flow & Preservation (Screenshot 1)", () => {
  // 1. Screenshot 1 UI elements preserved
  assert.ok(drawerCode.includes("Save to Contacts"), "Save to Contacts primary button exists");
  assert.ok(drawerCode.includes("Download Contact File (.vcf)"), "Explicit download button exists");
  assert.ok(drawerCode.includes("Call"), "Call action exists");
  assert.ok(drawerCode.includes("Message"), "Message action exists");
  assert.ok(drawerCode.includes("WhatsApp"), "WhatsApp action exists");
  assert.ok(drawerCode.includes("Email"), "Email action exists");

  // 2. Unverified confirmation prevented
  assert.equal(
    drawerCode.includes("Saved to your phone"),
    false,
    "Must not claim contact is saved without phone confirmation"
  );

  // 3. LeadsWorkspace table & cards flow routes through contact drawer
  assert.ok(
    workspaceCode.includes("setContactSheetLead(lead)") &&
    workspaceCode.includes("setContactSheetLead(targetLead)"),
    "Both card tap and action menu tap must open LeadContactCardDrawer"
  );
});

test("TEST 5: Single-Contact RFC 6350 Serialization & Phone Preservation", () => {
  // Preserves country codes and leading zeros exactly
  const vcardResult = buildVCardString({
    profileName: "Sinan mm",
    companyName: "Seeakk",
    title: "Founder & Chairman",
    phone: "+91 8606300137",
    email: "sinan@gmail.com",
    address: "Kerala, India",
  });

  const vcard = vcardResult.vcard;

  assert.ok(vcard.startsWith("BEGIN:VCARD\r\n"), "Must start with BEGIN:VCARD");
  assert.ok(vcard.includes("VERSION:3.0\r\n"), "Version must be 3.0");
  assert.ok(vcard.includes("FN:Sinan mm\r\n"), "FN must match name");
  assert.ok(vcard.includes("ORG:Seeakk\r\n"), "ORG must match company");
  assert.ok(vcard.includes("TITLE:Founder & Chairman\r\n"), "TITLE must match designation");
  assert.ok(vcard.includes("TEL;TYPE=CELL:+91 8606300137\r\n"), "TEL must preserve +91 8606300137");
  assert.ok(vcard.includes("EMAIL;TYPE=INTERNET:sinan@gmail.com\r\n"), "EMAIL must match email");
  assert.ok(vcard.includes("ADR;TYPE=WORK:;;Kerala\\, India;;;;\r\n"), "ADR must format address");
  assert.ok(vcard.endsWith("END:VCARD"), "Must end with END:VCARD");

  // Exactly one contact
  const beginMatches = vcard.match(/BEGIN:VCARD/g) || [];
  const endMatches = vcard.match(/END:VCARD/g) || [];
  assert.strictEqual(beginMatches.length, 1, "Must contain exactly one contact BEGIN");
  assert.strictEqual(endMatches.length, 1, "Must contain exactly one contact END");

  // Leading zeros preservation check
  const vcardWithZero = buildVCardString({
    profileName: "Test Lead",
    phone: "0484 2345678",
  }).vcard;
  assert.ok(vcardWithZero.includes("TEL;TYPE=CELL:0484 2345678"), "Leading zeros must be preserved");
});
