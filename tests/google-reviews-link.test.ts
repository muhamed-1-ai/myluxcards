import assert from "node:assert/strict";
import { cleanCardProfile, completeCardProfile, safePublicCard } from "../src/lib/cards";
import { normalizeBrandKey } from "../src/components/card/BrandLogo";

async function runTests() {
  console.log("=== RUNNING GOOGLE REVIEWS INTEGRATION TESTS ===");

  // 1. normalizeBrandKey tests
  console.log("Test 1: Brand normalization...");
  assert.equal(normalizeBrandKey("reviews"), "reviews");
  assert.equal(normalizeBrandKey("Google Reviews"), "reviews");
  assert.equal(normalizeBrandKey("googlereviews"), "reviews");
  assert.equal(normalizeBrandKey("google-reviews"), "reviews");
  assert.equal(normalizeBrandKey("google_reviews"), "reviews");
  assert.equal(normalizeBrandKey("star"), "reviews");
  assert.equal(normalizeBrandKey("Google Maps"), "maps");
  assert.equal(normalizeBrandKey("Google Business"), "google");
  assert.equal(normalizeBrandKey("Instagram"), "instagram");
  console.log("✔ Brand normalization passed");

  // 2. cleanCardProfile with Google Reviews URL and query params
  console.log("Test 2: URL sanitization and preservation...");
  const longReviewUrl = "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4&hl=en&gl=US";
  const shortReviewUrl = "https://g.page/r/Cb123456789/review";
  const mapsUrl = "https://maps.google.com/?cid=123456789";
  const businessUrl = "https://business.google.com/b/123";

  const cleaned = cleanCardProfile({
    name: "Test Business",
    social: {
      "Google Business": businessUrl,
      "Google Maps": mapsUrl,
      "Google Reviews": longReviewUrl,
      "Instagram": "https://instagram.com/testbiz",
      "Unsafe": "javascript:alert('pwned')",
    },
  });

  const social = cleaned.social as Record<string, string>;
  assert.equal(social["Google Reviews"], longReviewUrl, "Query parameters must be preserved in Google Reviews URL");
  assert.equal(social["Google Maps"], mapsUrl, "Google Maps URL must be preserved independently");
  assert.equal(social["Google Business"], businessUrl, "Google Business URL must be preserved independently");
  assert.equal(social["Instagram"], "https://instagram.com/testbiz");
  assert.equal(social["Unsafe"], "", "Unsafe javascript: protocol must be stripped to empty string");
  console.log("✔ URL sanitization and query param preservation passed");

  // 3. Shortened review link support
  console.log("Test 3: Shortened review link support...");
  const cleanedShort = cleanCardProfile({
    social: {
      "Google Reviews": shortReviewUrl,
    },
  });
  assert.equal((cleanedShort.social as any)["Google Reviews"], shortReviewUrl);
  console.log("✔ Shortened review link passed");

  // 4. completeCardProfile and safePublicCard data flow
  console.log("Test 4: completeCardProfile & safePublicCard data flow...");
  const completed = completeCardProfile({
    name: "Safe Business",
    social: {
      "Google Reviews": longReviewUrl,
      "Google Maps": mapsUrl,
    },
  });
  assert.equal((completed.social as any)["Google Reviews"], longReviewUrl);

  const safeCard = safePublicCard({
    id: "test-card-1",
    slug: "safe-biz",
    active: true,
    profile: completed,
  });
  assert.equal((safeCard.social as any)["Google Reviews"], longReviewUrl);
  console.log("✔ Safe public card output passed");

  // 5. Empty field removal
  console.log("Test 5: Empty field removal...");
  const cleanedEmpty = cleanCardProfile({
    social: {
      "Google Reviews": "",
      "Google Maps": mapsUrl,
    },
  });
  assert.equal((cleanedEmpty.social as any)["Google Reviews"], "");
  console.log("✔ Empty field removal passed");

  // 6. Independence verification
  console.log("Test 6: Independent Google Business, Maps, and Reviews values...");
  const cardWithAllThree = {
    social: {
      "Google Business": "https://business.google.com/test",
      "Google Maps": "https://maps.google.com/test",
      "Google Reviews": "https://g.page/r/test/review",
    },
  };

  // Simulate ModernProfileLayout / SimpleProfileLayout socialLinks extraction
  const extractModernLinks = (card: any) => [
    { key: "google-business", name: "Google Business", url: card.social?.["Google Business"] || card.social?.googlebusiness, brand: "google" },
    { key: "google-maps", name: "Google Maps", url: card.social?.["Google Maps"] || card.social?.googlemaps || (!card.social?.["Google Business"] && !card.social?.googlebusiness ? card.social?.google : undefined), brand: "maps" },
    { key: "google-reviews", name: "Google Reviews", url: card.social?.["Google Reviews"] || card.social?.["google-reviews"] || card.social?.["google_reviews"] || card.social?.googlereviews || card.social?.reviews, brand: "reviews" },
  ].filter((item) => item.url && item.url.trim().length > 0);

  const linksAll = extractModernLinks(cardWithAllThree);
  assert.equal(linksAll.length, 3);
  assert.equal(linksAll[0].name, "Google Business");
  assert.equal(linksAll[0].url, "https://business.google.com/test");
  assert.equal(linksAll[1].name, "Google Maps");
  assert.equal(linksAll[1].url, "https://maps.google.com/test");
  assert.equal(linksAll[2].name, "Google Reviews");
  assert.equal(linksAll[2].url, "https://g.page/r/test/review");

  // Card with only Google Reviews
  const cardOnlyReviews = {
    social: {
      "Google Reviews": "https://g.page/r/test/review",
    },
  };
  const linksOnlyReviews = extractModernLinks(cardOnlyReviews);
  assert.equal(linksOnlyReviews.length, 1);
  assert.equal(linksOnlyReviews[0].name, "Google Reviews");
  assert.equal(linksOnlyReviews[0].url, "https://g.page/r/test/review");

  // Card with no Google Reviews (empty)
  const cardNoReviews = {
    social: {
      "Google Maps": "https://maps.google.com/test",
      "Google Reviews": "",
    },
  };
  const linksNoReviews = extractModernLinks(cardNoReviews);
  assert.equal(linksNoReviews.length, 1);
  assert.equal(linksNoReviews[0].name, "Google Maps");
  assert.ok(!linksNoReviews.some((l) => l.name === "Google Reviews"));
  console.log("✔ Layout independence and conditional rendering passed");

  console.log("=== ALL UNIT & DATA FLOW TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
