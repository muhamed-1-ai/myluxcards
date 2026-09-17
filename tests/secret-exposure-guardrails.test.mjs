import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ----------------------------------------------------
// SERVER-ONLY SECRETS vs CLIENT-SAFE CLASSIFICATION
// ----------------------------------------------------
const SERVER_ONLY_SECRETS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_GOOGLE_SECRET",
  "WASABI_ACCESS_KEY",
  "WASABI_ACCESS_KEY_ID",
  "WASABI_SECRET_KEY",
  "WASABI_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AFFILIATE_COOKIE_SECRET",
  "AFFILIATE_PAYOUT_ENCRYPTION_KEY",
  "CRON_SECRET",
  "AFFILIATE_CRON_SECRET"
];

const CLIENT_SAFE_VARIABLES = [
  "GOOGLE_CLIENT_ID",
  "RAZORPAY_KEY_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL"
];

const SERVER_ONLY_MODULE_PATTERNS = [
  "lib/db",
  "lib/storage/wasabi",
  "lib/authSecret",
  "lib/customerEmails",
  "lib/orderNotifications",
  "server-only"
];

// Helper function to recursively find source files
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(file)) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const allSourceFiles = getAllFiles("src");

// Helper to determine if a file is a Client Component
function isClientComponent(fileContent) {
  const trimmed = fileContent.trim();
  return (
    trimmed.startsWith('"use client"') ||
    trimmed.startsWith("'use client'") ||
    trimmed.includes('\n"use client"') ||
    trimmed.includes("\n'use client'")
  );
}

// ====================================================
// GUARDRAIL 1: CLIENT COMPONENTS SECRET EXPOSURE AUDIT
// ====================================================
test("Guardrail 1: Server-only secrets are NEVER referenced in Client Components", () => {
  const violations = [];

  allSourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    if (isClientComponent(content)) {
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        SERVER_ONLY_SECRETS.forEach((secret) => {
          // Look for process.env.SECRET_NAME or env references
          if (line.includes(`process.env.${secret}`)) {
            violations.push({
              variable: secret,
              file: filePath,
              line: index + 1,
              reason: "Server-only secret referenced in a Client Component ('use client')"
            });
          }
        });
      });
    }
  });

  if (violations.length > 0) {
    console.error("VIOLATION SUMMARY:", violations);
  }
  assert.equal(violations.length, 0, "No server-only secrets may be referenced in Client Components");
});

// ====================================================
// GUARDRAIL 2: CLIENT COMPONENTS MODULE IMPORT AUDIT
// ====================================================
test("Guardrail 2: Server-only modules are NEVER imported into Client Components", () => {
  const violations = [];

  allSourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    if (isClientComponent(content)) {
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (/import\s+.*from\s+['"]/.test(line)) {
          SERVER_ONLY_MODULE_PATTERNS.forEach((mod) => {
            if (line.includes(`/${mod}`) || line.includes(`"${mod}"`) || line.includes(`'${mod}'`)) {
              violations.push({
                file: filePath,
                line: index + 1,
                reason: `Client Component imports server-only module pattern '${mod}'`
              });
            }
          });
        }
      });
    }
  });

  if (violations.length > 0) {
    console.error("VIOLATION SUMMARY:", violations);
  }
  assert.equal(violations.length, 0, "No server-only modules may be imported into Client Components");
});

// ====================================================
// GUARDRAIL 3: NEXT_PUBLIC_ PREFIXED SECRET AUDIT
// ====================================================
test("Guardrail 3: Server secrets are NEVER prefixed with NEXT_PUBLIC_", () => {
  const violations = [];

  allSourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      SERVER_ONLY_SECRETS.forEach((secret) => {
        if (line.includes(`NEXT_PUBLIC_${secret}`)) {
          violations.push({
            variable: secret,
            file: filePath,
            line: index + 1,
            reason: `Server secret '${secret}' is incorrectly exposed via NEXT_PUBLIC_${secret}`
          });
        }
      });
    });
  });

  if (violations.length > 0) {
    console.error("VIOLATION SUMMARY:", violations);
  }
  assert.equal(violations.length, 0, "No server secrets may use NEXT_PUBLIC_ prefix");
});

// ====================================================
// GUARDRAIL 4: CONSOLE.LOG SECRET AUDIT
// ====================================================
test("Guardrail 4: Server secrets are NEVER passed to console.log", () => {
  const violations = [];

  allSourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      if (line.includes("console.log") || line.includes("console.error") || line.includes("console.warn")) {
        SERVER_ONLY_SECRETS.forEach((secret) => {
          // Matches console.log(...secret...) where secret is referenced directly
          const regex = new RegExp(`console\\.(log|error|warn)\\(.*\\b${secret}\\b`, "g");
          if (regex.test(line)) {
            violations.push({
              variable: secret,
              file: filePath,
              line: index + 1,
              reason: `Server secret '${secret}' referenced in console log statement`
            });
          }
        });
      }
    });
  });

  if (violations.length > 0) {
    console.error("VIOLATION SUMMARY:", violations);
  }
  assert.equal(violations.length, 0, "No server secrets may be printed to console log statements");
});

// ====================================================
// GUARDRAIL 5: HARDCODED PRODUCTION SECRET FALLBACK AUDIT
// ====================================================
test("Guardrail 5: Production fallback static secrets do NOT exist in repository", () => {
  const violations = [];
  const BANNED_HARDCODED_STRINGS = [
    "myluxcards-auth-secret-session-key-2026"
  ];

  allSourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      BANNED_HARDCODED_STRINGS.forEach((banned) => {
        if (line.includes(banned)) {
          violations.push({
            file: filePath,
            line: index + 1,
            reason: "Hardcoded production secret fallback detected"
          });
        }
      });
    });
  });

  if (violations.length > 0) {
    console.error("VIOLATION SUMMARY:", violations);
  }
  assert.equal(violations.length, 0, "No hardcoded production fallbacks allowed");
});

// ====================================================
// GUARDRAIL 6: GIT IGNORANCE & ENV FILE TRACKING
// ====================================================
test("Guardrail 6: Environment files (.env*) are strictly excluded from Git", () => {
  const gitignoreContent = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf8") : "";
  assert.match(gitignoreContent, /\.env/, ".gitignore must exclude .env files");

  let trackedEnvFiles = "";
  try {
    trackedEnvFiles = execSync("git ls-files *.env*", { encoding: "utf8" }).trim();
  } catch {}

  assert.equal(trackedEnvFiles, "", "No .env files may be tracked by Git");
});

// ====================================================
// GUARDRAIL 7: CLIENT-SAFE VARIABLE PRESERVATION
// ====================================================
test("Guardrail 7: Client-safe variables are properly categorized", () => {
  CLIENT_SAFE_VARIABLES.forEach((clientVar) => {
    assert.equal(
      SERVER_ONLY_SECRETS.includes(clientVar),
      false,
      `Client safe variable ${clientVar} must not be classified as a server-only secret`
    );
  });
});
