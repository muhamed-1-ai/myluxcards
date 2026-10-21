import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAmountWithCommas,
  stripCommas,
  isValidMoneyString,
} from "../src/components/ui/FormattedMoneyInput.tsx";

test("FormattedMoneyInput: Comprehensive Behavioral & Edge-Case Verification", async (t) => {
  await t.test("1. Required prompt examples with 3-digit comma grouping", () => {
    assert.equal(formatAmountWithCommas("1000"), "1,000");
    assert.equal(formatAmountWithCommas("10000"), "10,000");
    assert.equal(formatAmountWithCommas("20000"), "20,000");
    assert.equal(formatAmountWithCommas("100000"), "100,000");
    assert.equal(formatAmountWithCommas("1000000"), "1,000,000");
    assert.equal(formatAmountWithCommas("10000.50"), "10,000.50");
  });

  await t.test("2. Exact financial precision & paise calculation (No floating point traps)", () => {
    const displayed = "10,000.50";
    const raw = stripCommas(displayed);
    assert.equal(raw, "10000.50");

    // Critical: standard parseFloat with comma fails:
    assert.equal(parseFloat(displayed), 10); // Standard JS stops at comma
    // With stripCommas raw value:
    assert.equal(parseFloat(raw), 10000.5);
    assert.equal(Math.round(parseFloat(raw) * 100), 1000050); // Exact integer paise

    // Micro amounts & large crore amounts
    const croreAmt = "10,00,00,000".replace(/,/g, ""); // 100000000
    assert.equal(formatAmountWithCommas(croreAmt), "100,000,000");
    const crorePaise = Math.round(parseFloat(stripCommas("100,000,000.75")) * 100);
    assert.equal(crorePaise, 10000000075);
  });

  await t.test("3. Preserves decimal editing states without forcing .00 or 0", () => {
    // Empty field remains empty
    assert.equal(formatAmountWithCommas(""), "");
    assert.equal(formatAmountWithCommas(null), "");
    assert.equal(formatAmountWithCommas(undefined), "");

    // Decimal in-progress states
    assert.equal(formatAmountWithCommas("0."), "0.");
    assert.equal(formatAmountWithCommas("."), "0.");
    assert.equal(formatAmountWithCommas("10000."), "10,000.");
    assert.equal(formatAmountWithCommas("10000.0"), "10,000.0");
    assert.equal(formatAmountWithCommas("10000.00"), "10,000.00");
    assert.equal(formatAmountWithCommas("10000.5"), "10,000.5");
    assert.equal(formatAmountWithCommas("10000.50"), "10,000.50");

    // Maximum 2 decimal places truncation (does not overflow)
    assert.equal(formatAmountWithCommas("10000.555"), "10,000.55");
  });

  await t.test("4. Clear rejection of malformed input strings", () => {
    // Reject letters and malicious patterns
    assert.equal(isValidMoneyString("10abc20"), false);
    assert.equal(isValidMoneyString("100.50.25"), false);
    assert.equal(isValidMoneyString("abc"), false);
    assert.equal(isValidMoneyString("1,000,00"), false); // Invalid group size
    assert.equal(isValidMoneyString("100,00"), false);

    // Accept valid monetary inputs with or without currency signs
    assert.equal(isValidMoneyString("1000"), true);
    assert.equal(isValidMoneyString("1,000"), true);
    assert.equal(isValidMoneyString("10,000.50"), true);
    assert.equal(isValidMoneyString("₹ 10,000.50"), true);
    assert.equal(isValidMoneyString("$ 5,000"), true);
    assert.equal(isValidMoneyString(""), true);
    assert.equal(isValidMoneyString("0."), true);
    assert.equal(isValidMoneyString("."), true);
    assert.equal(isValidMoneyString(".50"), true);
  });

  await t.test("5. Cursor position math for typing in the middle", () => {
    // Simulate user typing '5' at index 1 of '1,000' (between '1' and ',')
    // Resulting browser text before format: "15,000", cursor was at 2
    const currentVal = "15,000";
    const curPos = 2; // after "15"
    const nonCommaBefore = stripCommas(currentVal.slice(0, curPos)).length; // "15".length === 2
    const raw = stripCommas(currentVal); // "15000"
    const formatted = formatAmountWithCommas(raw); // "15,000"

    // Calculate new cursor:
    let newCursor = formatted.length;
    let count = 0;
    if (nonCommaBefore === 0) {
      newCursor = 0;
    } else {
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ",") count++;
        if (count === nonCommaBefore) {
          newCursor = i + 1;
          break;
        }
      }
    }

    // In "15,000", index 0 is '1', index 1 is '5', index 2 is ','
    // Cursor must be at index 2 (right after '5')
    assert.equal(newCursor, 2);
    assert.equal(formatted.slice(0, newCursor), "15");
  });

  await t.test("6. Backspace around commas math", () => {
    // In "10,000", cursor is at index 3: "10,|000" (right after the comma)
    const curVal = "10,000";
    const selectionStart = 3;
    assert.equal(curVal[selectionStart - 1], ",");

    // Backspace deletes the digit preceding the comma ('0' at index 1)
    const before = curVal.slice(0, selectionStart - 2); // "1"
    const after = curVal.slice(selectionStart); // "000"
    const newRaw = stripCommas(before + after); // "1000"
    const newFormatted = formatAmountWithCommas(newRaw); // "1,000"

    const nonCommaBefore = stripCommas(before).length; // "1".length === 1
    let newPos = newFormatted.length;
    let count = 0;
    if (nonCommaBefore === 0) {
      newPos = 0;
    } else {
      for (let i = 0; i < newFormatted.length; i++) {
        if (newFormatted[i] !== ",") count++;
        if (count === nonCommaBefore) {
          newPos = i + 1;
          break;
        }
      }
    }

    // In "1,000", index 0 is '1', index 1 is ','
    // Cursor is placed at 1 (after '1')
    assert.equal(newFormatted, "1,000");
    assert.equal(newPos, 1);
  });

  await t.test("7. Delete around commas math", () => {
    // In "10,000", cursor is at index 2: "10|,000" (right before the comma)
    const curVal = "10,000";
    const selectionStart = 2;
    assert.equal(curVal[selectionStart], ",");

    // Delete deletes the digit following the comma ('0' at index 3)
    const before = curVal.slice(0, selectionStart); // "10"
    const after = curVal.slice(selectionStart + 2); // "00"
    const newRaw = stripCommas(before + after); // "1000"
    const newFormatted = formatAmountWithCommas(newRaw); // "1,000"

    const nonCommaBefore = stripCommas(before).length; // "10".length === 2
    let newPos = newFormatted.length;
    let count = 0;
    if (nonCommaBefore === 0) {
      newPos = 0;
    } else {
      for (let i = 0; i < newFormatted.length; i++) {
        if (newFormatted[i] !== ",") count++;
        if (count === nonCommaBefore) {
          newPos = i + 1;
          break;
        }
      }
    }

    // In "1,000", index 0 is '1', index 1 is ',', index 2 is '0'
    // Cursor is placed after the second non-comma digit (index 3)
    assert.equal(newFormatted, "1,000");
    assert.equal(newPos, 3);
  });

  await t.test("8. Negative values when allowNegative is enabled vs disabled", () => {
    assert.equal(formatAmountWithCommas("-1000"), "-1,000");
    assert.equal(formatAmountWithCommas("-10000.50"), "-10,000.50");
    assert.equal(stripCommas("-10,000.50"), "-10000.50");

    // allowNegative=true
    assert.equal(isValidMoneyString("-10,000.50", true), true);
    assert.equal(isValidMoneyString("-", true), true); // transient typing state
    assert.equal(isValidMoneyString("-.5", true), true);

    // allowNegative=false
    assert.equal(isValidMoneyString("-10,000.50", false), false);
    assert.equal(isValidMoneyString("-", false), false);
  });
});
