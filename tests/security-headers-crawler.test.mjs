import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("Headers 1: next.config.ts has poweredByHeader: false", () => {
  const content = readFileSync("next.config.ts", "utf8");
  assert.match(content, /poweredByHeader:\s*false/);
});

test("Headers 2: CSP configured in report-only mode with required resources", () => {
  const content = readFileSync("next.config.ts", "utf8");
  assert.match(content, /Content-Security-Policy-Report-Only/);
  assert.match(content, /https:\/\/accounts\.google\.com/);
  assert.match(content, /https:\/\/\*\.wasabisys\.com/);
  assert.match(content, /https:\/\/checkout\.razorpay\.com/);
  assert.match(content, /https:\/\/fonts\.googleapis\.com/);
  assert.match(content, /https:\/\/lh3\.googleusercontent\.com/);
});

test("Crawler 3: robots.ts blocks private areas and indexes public areas", () => {
  assert.equal(existsSync("src/app/robots.ts"), true);
  const content = readFileSync("src/app/robots.ts", "utf8");
  assert.match(content, /\/dashboard\//);
  assert.match(content, /\/admin\//);
  assert.match(content, /\/super-admin\//);
  assert.match(content, /\/orders\//);
  assert.match(content, /\/api\//);
  assert.match(content, /\/reset-password/);
  assert.match(content, /sitemap\.xml/);
});

test("Errors 4: not-found and error pages exist with user recovery actions", () => {
  assert.equal(existsSync("src/app/not-found.tsx"), true);
  assert.equal(existsSync("src/app/error.tsx"), true);
  assert.equal(existsSync("src/app/global-error.tsx"), true);

  const notFoundContent = readFileSync("src/app/not-found.tsx", "utf8");
  assert.match(notFoundContent, /Return to Homepage/);
  assert.match(notFoundContent, /Open Dashboard/);

  const errorContent = readFileSync("src/app/error.tsx", "utf8");
  assert.match(errorContent, /Try Again/);
  assert.match(errorContent, /console\.error/);
  // Ensure stack trace is not dumped to the JSX UI
  assert.equal(errorContent.includes("{error.stack}"), false);
  assert.equal(errorContent.includes("{error?.stack}"), false);
});
