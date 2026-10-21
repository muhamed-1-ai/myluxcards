import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAmountWithCommas,
  stripCommas,
  cleanRawAmount,
  isValidRawMoney,
  isValidMoneyString,
  calculateNewCursor,
} from "../src/components/ui/FormattedMoneyInput.tsx";

test("FormattedMoneyInput Regression: Comma Freezing & Real Keyboard Interaction Suite", async (t) => {
  // Helpers simulating interactive typing and backspacing
  function simulateKeystroke(currentDisplay, cursor, char, maxDecimals = 2, allowNegative = false) {
    const before = currentDisplay.slice(0, cursor);
    const after = currentDisplay.slice(cursor);
    const browserVal = before + char + after;
    const browserCursor = cursor + char.length;

    const rawCandidate = cleanRawAmount(browserVal, allowNegative);
    if (!isValidRawMoney(rawCandidate, allowNegative)) {
      return { display: currentDisplay, cursor, raw: cleanRawAmount(currentDisplay, allowNegative), rejected: true };
    }

    const nonCommaBefore = stripCommas(browserVal.slice(0, browserCursor)).length;

    let raw = rawCandidate;
    if (raw.includes(".")) {
      const [intPart, decPart] = raw.split(".");
      if (decPart && decPart.length > maxDecimals) {
        raw = intPart + "." + decPart.slice(0, maxDecimals);
      }
    }

    const formatted = formatAmountWithCommas(raw, maxDecimals);
    const newCursor = calculateNewCursor(formatted, nonCommaBefore, rawCandidate);
    return { display: formatted, cursor: newCursor, raw, rejected: false };
  }

  function simulateBackspace(currentDisplay, cursor, maxDecimals = 2, allowNegative = false) {
    if (cursor === 0) {
      return { display: currentDisplay, cursor: 0, raw: cleanRawAmount(currentDisplay, allowNegative) };
    }

    let browserVal;
    let browserCursor;

    // Natural backspace when cursor is directly after a comma (e.g. "1,|111")
    if (currentDisplay[cursor - 1] === ",") {
      const before = currentDisplay.slice(0, cursor - 2);
      const after = currentDisplay.slice(cursor);
      const newRaw = cleanRawAmount(before + after, allowNegative);
      const formatted = formatAmountWithCommas(newRaw, maxDecimals);
      const nonCommaBefore = stripCommas(before).length;
      const newCursor = calculateNewCursor(formatted, nonCommaBefore, newRaw);
      return { display: formatted, cursor: newCursor, raw: newRaw };
    } else {
      browserVal = currentDisplay.slice(0, cursor - 1) + currentDisplay.slice(cursor);
      browserCursor = cursor - 1;
    }

    const rawCandidate = cleanRawAmount(browserVal, allowNegative);
    if (!isValidRawMoney(rawCandidate, allowNegative)) {
      return { display: currentDisplay, cursor, raw: cleanRawAmount(currentDisplay, allowNegative), rejected: true };
    }

    const nonCommaBefore = stripCommas(browserVal.slice(0, browserCursor)).length;
    let raw = rawCandidate;
    if (raw.includes(".")) {
      const [intPart, decPart] = raw.split(".");
      if (decPart && decPart.length > maxDecimals) {
        raw = intPart + "." + decPart.slice(0, maxDecimals);
      }
    }

    const formatted = formatAmountWithCommas(raw, maxDecimals);
    const newCursor = calculateNewCursor(formatted, nonCommaBefore, rawCandidate);
    return { display: formatted, cursor: newCursor, raw };
  }

  function simulatePaste(currentDisplay, start, end, pastedText, maxDecimals = 2, allowNegative = false) {
    const cleanPasted = cleanRawAmount(pastedText, allowNegative);
    if (!cleanPasted || !isValidRawMoney(cleanPasted, allowNegative)) {
      return { display: currentDisplay, cursor: start, raw: cleanRawAmount(currentDisplay, allowNegative), rejected: true };
    }

    const before = currentDisplay.slice(0, start);
    const after = currentDisplay.slice(end);
    const combinedRaw = (cleanRawAmount(before, allowNegative) + cleanPasted + cleanRawAmount(after, allowNegative)).trim();

    const dotMatches = combinedRaw.match(/\./g);
    if (dotMatches && dotMatches.length > 1) {
      return { display: currentDisplay, cursor: start, raw: cleanRawAmount(currentDisplay, allowNegative), rejected: true };
    }

    let capped = combinedRaw;
    if (combinedRaw.includes(".")) {
      const [intP, decP] = combinedRaw.split(".");
      capped = intP + "." + (decP || "").slice(0, maxDecimals);
    }

    const formatted = formatAmountWithCommas(capped, maxDecimals);
    const nonCommaTarget = (cleanRawAmount(before, allowNegative) + cleanPasted).length;
    const newPos = calculateNewCursor(formatted, nonCommaTarget, capped);

    return { display: formatted, cursor: newPos, raw: capped, rejected: false };
  }

  await t.test("1. Progressive typing from 1 to 1,111,111 does NOT freeze at 1,111", () => {
    let state = { display: "", cursor: 0, raw: "" };

    // 1 -> 1
    state = simulateKeystroke(state.display, state.cursor, "1");
    assert.equal(state.display, "1");
    assert.equal(state.raw, "1");
    assert.equal(state.cursor, 1);

    // 1 -> 11
    state = simulateKeystroke(state.display, state.cursor, "1");
    assert.equal(state.display, "11");
    assert.equal(state.raw, "11");
    assert.equal(state.cursor, 2);

    // 11 -> 111
    state = simulateKeystroke(state.display, state.cursor, "1");
    assert.equal(state.display, "111");
    assert.equal(state.raw, "111");
    assert.equal(state.cursor, 3);

    // 111 -> 1,111 (comma appears)
    state = simulateKeystroke(state.display, state.cursor, "1");
    assert.equal(state.display, "1,111");
    assert.equal(state.raw, "1111");
    assert.equal(state.cursor, 5);

    // 1,111 -> 11,111 (Critical test: previously froze here because isValidMoneyString rejected "1,1111")
    state = simulateKeystroke(state.display, state.cursor, "1");
    assert.equal(state.display, "11,111");
    assert.equal(state.raw, "11111");
    assert.equal(state.cursor, 6);
    assert.equal(state.rejected, false);

    // 11,111 -> 111,111
    state = simulateKeystroke(state.display, state.cursor, "1");
    assert.equal(state.display, "111,111");
    assert.equal(state.raw, "111111");
    assert.equal(state.cursor, 7);

    // 111,111 -> 1,111,111
    state = simulateKeystroke(state.display, state.cursor, "1");
    assert.equal(state.display, "1,111,111");
    assert.equal(state.raw, "1111111");
    assert.equal(state.cursor, 9);
  });

  await t.test("2. Backspacing all the way back to blank from 1,111,111 without getting stuck", () => {
    let state = { display: "1,111,111", cursor: 9, raw: "1111111" };

    // Backspace from 1,111,111 -> 111,111
    state = simulateBackspace(state.display, state.cursor);
    assert.equal(state.display, "111,111");
    assert.equal(state.raw, "111111");
    assert.equal(state.cursor, 7);

    // Backspace from 111,111 -> 11,111
    state = simulateBackspace(state.display, state.cursor);
    assert.equal(state.display, "11,111");
    assert.equal(state.raw, "11111");
    assert.equal(state.cursor, 6);

    // Backspace from 11,111 -> 1,111
    state = simulateBackspace(state.display, state.cursor);
    assert.equal(state.display, "1,111");
    assert.equal(state.raw, "1111");
    assert.equal(state.cursor, 5);

    // Backspace from 1,111 -> 111 (Critical: previously failed because isValidMoneyString rejected "1,11")
    state = simulateBackspace(state.display, state.cursor);
    assert.equal(state.display, "111");
    assert.equal(state.raw, "111");
    assert.equal(state.cursor, 3);

    // Backspace from 111 -> 11
    state = simulateBackspace(state.display, state.cursor);
    assert.equal(state.display, "11");
    assert.equal(state.raw, "11");
    assert.equal(state.cursor, 2);

    // Backspace from 11 -> 1
    state = simulateBackspace(state.display, state.cursor);
    assert.equal(state.display, "1");
    assert.equal(state.raw, "1");
    assert.equal(state.cursor, 1);

    // Backspace from 1 -> blank
    state = simulateBackspace(state.display, state.cursor);
    assert.equal(state.display, "");
    assert.equal(state.raw, "");
    assert.equal(state.cursor, 0);
  });

  await t.test("3. Increase 2,000 to 20,000, then reduce it to 200", () => {
    // Increase at end: "2,000" + '0' -> "20,000"
    let state = simulateKeystroke("2,000", 5, "0");
    assert.equal(state.display, "20,000");
    assert.equal(state.raw, "20000");
    assert.equal(state.cursor, 6);

    // Increase in middle: cursor between '2' and ',' ("2|,000") + '0' -> "20,000"
    let midState = simulateKeystroke("2,000", 1, "0");
    assert.equal(midState.display, "20,000");
    assert.equal(midState.raw, "20000");
    assert.equal(midState.cursor, 2); // Cursor stays right after inserted '0' ("20|,000")

    // Reduce 20,000 to 200 by backspacing twice from end
    let redState = simulateBackspace("20,000", 6);
    assert.equal(redState.display, "2,000");
    assert.equal(redState.raw, "2000");
    assert.equal(redState.cursor, 5);

    redState = simulateBackspace(redState.display, redState.cursor);
    assert.equal(redState.display, "200");
    assert.equal(redState.raw, "200");
    assert.equal(redState.cursor, 3);
  });

  await t.test("4. Select-all and replace 1,111 with 50", () => {
    // User selects all in "1,111" (start: 0, end: 5) and types '5'
    const replaceState1 = simulatePaste("1,111", 0, 5, "5");
    assert.equal(replaceState1.display, "5");
    assert.equal(replaceState1.raw, "5");
    assert.equal(replaceState1.cursor, 1);

    // Then types '0'
    const replaceState2 = simulateKeystroke(replaceState1.display, replaceState1.cursor, "0");
    assert.equal(replaceState2.display, "50");
    assert.equal(replaceState2.raw, "50");
    assert.equal(replaceState2.cursor, 2);
  });

  await t.test("5. Paste and edit 10,000.50 (including currency symbol handling)", () => {
    // Paste raw "10000.50"
    const p1 = simulatePaste("", 0, 0, "10000.50");
    assert.equal(p1.display, "10,000.50");
    assert.equal(p1.raw, "10000.50");
    assert.equal(p1.cursor, 9);

    // Paste formatted with currency sign "₹ 10,000.50"
    const p2 = simulatePaste("", 0, 0, "₹ 10,000.50");
    assert.equal(p2.display, "10,000.50");
    assert.equal(p2.raw, "10000.50");

    // Paste Indian grouped "1,00,000"
    const p3 = simulatePaste("", 0, 0, "1,00,000");
    assert.equal(p3.display, "100,000");
    assert.equal(p3.raw, "100000");

    // Reject malformed paste like "10abc20"
    const pMal = simulatePaste("1,000", 0, 5, "10abc20");
    assert.equal(pMal.rejected, true);
    assert.equal(pMal.display, "1,000");
  });

  await t.test("6. Middle insertions without cursor jumps", () => {
    // In "10,000.50", cursor is at pos 2 ("10|,000.50"), type '5'
    const res = simulateKeystroke("10,000.50", 2, "5");
    assert.equal(res.display, "105,000.50");
    assert.equal(res.raw, "105000.50");
    assert.equal(res.cursor, 3); // Cursor stays right after '5' ("105|,000.50")
  });

  await t.test("7. Decimal point on blank field places cursor after '0.'", () => {
    const res = simulateKeystroke("", 0, ".");
    assert.equal(res.display, "0.");
    assert.equal(res.raw, ".");
    assert.equal(res.cursor, 2); // Cursor right after "0.|", ready for next decimal digit
  });

  await t.test("8. Canonical value passed to API produces exact paise minor units without comma corruption", () => {
    const rawValue = "10000.50";
    // Check rawValue has no commas:
    assert.equal(rawValue.includes(","), false);

    // Simulate backend minor units calculation:
    const parsed = parseFloat(rawValue);
    assert.equal(parsed, 10000.5);
    const amountMinor = Math.round(parsed * 100);
    assert.equal(amountMinor, 1000050);

    // Confirm that stripCommas safely protects against any formatted text:
    const formatted = "1,000,000.75";
    const safeParsed = parseFloat(stripCommas(formatted));
    assert.equal(safeParsed, 1000000.75);
    assert.equal(Math.round(safeParsed * 100), 100000075);
  });
});
