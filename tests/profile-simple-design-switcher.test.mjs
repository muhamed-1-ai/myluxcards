import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanCardProfile,
  completeCardProfile,
  safePublicCard,
  SUPPORTED_PROFILE_DESIGNS,
  isSupportedProfileDesign,
} from "../src/lib/cards.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("1. Profile Design Registry: Modern and Simple are the supported designs", () => {
  assert.equal(SUPPORTED_PROFILE_DESIGNS.length, 2);
  const ids = SUPPORTED_PROFILE_DESIGNS.map((d) => d.id);
  assert.deepEqual(ids, ["modern", "simple"]);

  assert.equal(isSupportedProfileDesign("modern"), true);
  assert.equal(isSupportedProfileDesign("simple"), true);
  assert.equal(isSupportedProfileDesign("MODERN"), true);
  assert.equal(isSupportedProfileDesign("SIMPLE"), true);
  assert.equal(isSupportedProfileDesign("unknown_theme"), false);
  assert.equal(isSupportedProfileDesign(null), false);
  assert.equal(isSupportedProfileDesign(undefined), false);
});

test("2. Canonical Profile Normalization: 'simple' is preserved, invalid/retired formats fall back to 'modern'", () => {
  // Simple format is recognized and preserved
  const cleanedSimple = cleanCardProfile({
    name: "Ahmad Razak",
    profileFormat: "simple",
    title: "Lead Architect",
    business: "Hexa Systems",
    about: "Senior full stack designer & engineer building high performance tools.",
    mobile: "+91 98765 43210",
    email: "ahmad@example.com",
    website: "https://hexa.example.com",
  });
  assert.equal(cleanedSimple.profileFormat, "simple");
  assert.equal(cleanedSimple.name, "Ahmad Razak");
  assert.equal(cleanedSimple.title, "Lead Architect");
  assert.equal(cleanedSimple.business, "Hexa Systems");

  // Modern format is preserved
  const cleanedModern = cleanCardProfile({
    name: "Ahmad Razak",
    profileFormat: "modern",
  });
  assert.equal(cleanedModern.profileFormat, "modern");

  // Missing or empty falls back to 'modern'
  const cleanedEmpty = cleanCardProfile({});
  assert.equal(cleanedEmpty.profileFormat, "modern");

  // Retired 'standard' or invalid string falls back to 'modern'
  const cleanedRetired = cleanCardProfile({ profileFormat: "standard" });
  assert.equal(cleanedRetired.profileFormat, "modern");

  const cleanedInvalid = cleanCardProfile({ profileFormat: "retro_gold" });
  assert.equal(cleanedInvalid.profileFormat, "modern");
});

test("3. completeCardProfile & safePublicCard: Preserves all canonical profile details across design switching", () => {
  const fullProfile = {
    name: "Sarah Jenkins",
    title: "Chief Product Officer",
    business: "Aura Dynamics",
    about: "Dedicated to designing frictionless digital experiences for modern enterprises.",
    countryCode: "+1",
    countryIso: "US",
    mobile: "2025550192",
    whatsapp: "2025550192",
    email: "sarah.j@auradynamics.com",
    website: "https://auradynamics.com",
    logo: "https://storage.zappit.com/profiles/avatar.png",
    profileBackground: "#0F141C",
    profileAccent: "#2563EB",
    profileText: "#F9FAFB",
    social: {
      LinkedIn: "https://linkedin.com/in/sarahjenkins",
      Instagram: "https://instagram.com/sarahdesigns",
      Twitter: "https://x.com/sarah_cpo",
    },
    services: ["Product Strategy", "Design Systems", "User Research"],
    profileFormat: "simple",
  };

  // Complete profile preserves 'simple'
  const completed = completeCardProfile(fullProfile);
  assert.equal(completed.profileFormat, "simple");
  assert.equal(completed.name, "Sarah Jenkins");
  assert.equal(completed.title, "Chief Product Officer");
  assert.equal(completed.business, "Aura Dynamics");
  assert.equal(completed.about, fullProfile.about);
  assert.equal(completed.mobile, "2025550192");
  assert.equal(completed.email, "sarah.j@auradynamics.com");
  assert.equal(completed.website, "https://auradynamics.com");
  assert.equal(completed.logo, fullProfile.logo);
  assert.deepEqual(completed.social, fullProfile.social);
  assert.deepEqual(completed.services, fullProfile.services);

  // safePublicCard preserves 'simple' and returns canonical details
  const cardRow = {
    id: "card-987654",
    slug: "sarah-jenkins",
    owner_id: "user-987654",
    active: true,
    profile: fullProfile,
  };

  const safe = safePublicCard(cardRow);
  assert.equal(safe.profileFormat, "simple");
  assert.equal(safe.slug, "sarah-jenkins");
  assert.equal(safe.name, "Sarah Jenkins");
  assert.equal(safe.title, "Chief Product Officer");
  assert.equal(safe.business, "Aura Dynamics");
  assert.equal(safe.about, fullProfile.about);
  assert.equal(safe.website, "https://auradynamics.com");
  assert.deepEqual(safe.social, fullProfile.social);

  // Switching back to modern preserves all details without data loss
  const switchedToModern = completeCardProfile({
    ...fullProfile,
    profileFormat: "modern",
  });
  assert.equal(switchedToModern.profileFormat, "modern");
  assert.equal(switchedToModern.name, "Sarah Jenkins");
  assert.equal(switchedToModern.title, "Chief Product Officer");
  assert.equal(switchedToModern.business, "Aura Dynamics");
  assert.equal(switchedToModern.about, fullProfile.about);
  assert.deepEqual(switchedToModern.social, fullProfile.social);
  assert.deepEqual(switchedToModern.services, fullProfile.services);
});

test("4. SimpleProfileLayout Code Integrity: Contained photo, clear typography, primary action, restrained styling", () => {
  const simpleProfileTsx = fs.readFileSync(
    path.join(rootDir, "src/components/card/SimpleProfileLayout.tsx"),
    "utf-8"
  );

  // Plain background and properly contained photo
  assert.match(
    simpleProfileTsx,
    /className="zappit-simple-photo-wrap"/,
    "SimpleProfileLayout must have contained profile photo container"
  );
  assert.match(
    simpleProfileTsx,
    /className="zappit-simple-photo-ring"/,
    "SimpleProfileLayout must contain the photo in a ring"
  );
  assert.match(
    simpleProfileTsx,
    /className="zappit-simple-photo-fallback"/,
    "SimpleProfileLayout must have monogram initials fallback for missing photo"
  );

  // Clear name heading (h1), subtitle, bio
  assert.match(
    simpleProfileTsx,
    /<h1 className="zappit-simple-name">\{name\}<\/h1>/,
    "SimpleProfileLayout must render owner name inside h1.zappit-simple-name"
  );
  assert.match(
    simpleProfileTsx,
    /className="zappit-simple-subtitle"/,
    "SimpleProfileLayout must render title and company in zappit-simple-subtitle"
  );
  assert.match(
    simpleProfileTsx,
    /\{about && \(\s*<p className="zappit-simple-bio">\{about\}<\/p>\s*\)\}/,
    "SimpleProfileLayout must conditionally render short bio when provided"
  );

  // One clear primary contact action (Save Contact)
  assert.match(
    simpleProfileTsx,
    /className="zappit-simple-btn-primary"/,
    "SimpleProfileLayout must render prominent primary Save Contact action"
  );
  assert.match(
    simpleProfileTsx,
    /<span>Save Contact<\/span>/,
    "SimpleProfileLayout must label the primary action 'Save Contact'"
  );

  // Neatly grouped secondary contact actions
  assert.match(
    simpleProfileTsx,
    /className="zappit-simple-actions-group"/,
    "SimpleProfileLayout must group secondary actions"
  );
  assert.match(
    simpleProfileTsx,
    /<span>Call<\/span>/,
    "Secondary actions must include Call"
  );
  assert.match(
    simpleProfileTsx,
    /<span>WhatsApp<\/span>/,
    "Secondary actions must include WhatsApp"
  );
  assert.match(
    simpleProfileTsx,
    /<span>Email<\/span>/,
    "Secondary actions must include Email"
  );
  assert.match(
    simpleProfileTsx,
    /<span>Website<\/span>/,
    "Secondary actions must include Website"
  );

  // Social links section
  assert.match(
    simpleProfileTsx,
    /className="zappit-simple-social-section"/,
    "SimpleProfileLayout must render social links section"
  );
});

test("5. PublicCardClient & Dashboard Preview: Switcher and conditional layout routing", () => {
  const publicCardClientTsx = fs.readFileSync(
    path.join(rootDir, "src/app/card/[slug]/PublicCardClient.tsx"),
    "utf-8"
  );
  const dashboardTsx = fs.readFileSync(
    path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx"),
    "utf-8"
  );

  // PublicCardClient conditionally renders SimpleProfileLayout or ModernProfileLayout
  assert.match(
    publicCardClientTsx,
    /card\.profileFormat === "simple"\s*\?\s*\(\s*<SimpleProfileLayout/,
    "PublicCardClient must route card.profileFormat === 'simple' to SimpleProfileLayout"
  );
  assert.match(
    publicCardClientTsx,
    /<ModernProfileLayout/,
    "PublicCardClient must fallback to ModernProfileLayout"
  );

  // Dashboard preview conditionally renders SimpleProfileLayout or ModernProfileLayout
  assert.match(
    dashboardTsx,
    /card\.profileFormat === "simple"\s*\?\s*\(\s*<SimpleProfileLayout/,
    "Dashboard Preview must render SimpleProfileLayout for simple format"
  );

  // Dashboard AppearanceForm has Profile Design selector with thumbnails and Apply Design button
  assert.match(
    dashboardTsx,
    /id="profile-design-section"/,
    "Dashboard AppearanceForm must include profile-design-section"
  );
  assert.match(
    dashboardTsx,
    /className="profile-design-apply-btn"/,
    "Dashboard AppearanceForm must include profile-design-apply-btn ('Apply Design')"
  );
  assert.match(
    dashboardTsx,
    /ACTIVE DESIGN/,
    "Dashboard AppearanceForm must show ACTIVE DESIGN badge on currently applied design"
  );
});
