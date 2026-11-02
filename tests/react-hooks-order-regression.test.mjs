import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("1. PublicCardClient has NO React hooks placed after early return statements (prevents React Error #310)", () => {
  const filePath = path.join(rootDir, "src/app/card/[slug]/PublicCardClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");

  // Find the first early return in PublicCardClient
  const firstEarlyReturnIdx = lines.findIndex((line) =>
    /if\s*\(!loaded\)\s*return/.test(line)
  );

  assert.ok(firstEarlyReturnIdx > 0, "Must locate 'if (!loaded) return' in PublicCardClient");

  // Scan all lines after the first early return for any hook invocation: useState, useEffect, useRef, useMemo, useCallback, useId, etc.
  const hookRegex = /\b(useEffect|useState|useRef|useMemo|useCallback|useId|useContext|useReducer)\s*\(/;
  const violations = [];

  for (let i = firstEarlyReturnIdx; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith("//") || line.trim().startsWith("/*")) continue;

    if (hookRegex.test(line)) {
      violations.push({ line: i + 1, text: line.trim() });
    }
  }

  assert.equal(
    violations.length,
    0,
    `React Hooks must NEVER be called after early returns! Found violations: ${JSON.stringify(violations)}`
  );
});

test("2. Background synchronization effect is placed at top level with null guard", () => {
  const filePath = path.join(rootDir, "src/app/card/[slug]/PublicCardClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  // The body background effect must exist before early return
  const earlyReturnIdx = source.indexOf("if (!loaded) return");
  const bodyEffectIdx = source.indexOf("document.body.style.backgroundColor");

  assert.ok(earlyReturnIdx > 0, "early return exists");
  assert.ok(bodyEffectIdx > 0, "body background effect exists");
  assert.ok(
    bodyEffectIdx < earlyReturnIdx,
    "Body background synchronization effect must be defined BEFORE any early returns"
  );

  // Must guard against !card
  const effectSnippet = source.slice(bodyEffectIdx - 300, bodyEffectIdx + 300);
  assert.ok(
    effectSnippet.includes("if (!card) return;"),
    "Body background effect must safely guard against !card on initial render"
  );
});

test("3. All card components in src/components/card adhere to top-level hooks rule", () => {
  const cardComponentsDir = path.join(rootDir, "src/components/card");
  const files = fs.readdirSync(cardComponentsDir).filter((f) => f.endsWith(".tsx"));

  const hookRegex = /\b(useEffect|useState|useRef|useMemo|useCallback|useId|useContext|useReducer)\s*\(/;

  for (const file of files) {
    const source = fs.readFileSync(path.join(cardComponentsDir, file), "utf8");
    const lines = source.split("\n");

    let insideComponent = false;
    let hasSeenEarlyReturn = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("//") || line.trim().startsWith("/*")) continue;

      // Track component entry
      if (/export\s+(default\s+)?function\s+[A-Z]/.test(line) || /function\s+[A-Z]/.test(line) || /const\s+[A-Z]\w*\s*=\s*(React\.)?(memo|forwardRef)?\(?\(?/.test(line)) {
        insideComponent = true;
        hasSeenEarlyReturn = false;
      }

      if (insideComponent) {
        if (/^\s*if\s*\(.+\)\s*return\b/.test(line)) {
          hasSeenEarlyReturn = true;
        }

        if (hasSeenEarlyReturn && hookRegex.test(line)) {
          assert.fail(
            `${file} line ${i + 1} calls a React hook after an early return: "${line.trim()}"`
          );
        }
      }
    }
  }
});
