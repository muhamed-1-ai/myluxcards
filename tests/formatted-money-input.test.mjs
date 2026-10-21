import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAmountWithCommas,
  stripCommas,
  isValidMoneyString,
} from "../src/components/ui/FormattedMoneyInput.tsx";

test("FormattedMoneyInput: Formatting & Parsing Specification Verification", async (t) => {
  await t.test("1. Required prompt examples format with 3-digit comma grouping", () => {
    assert.equal(formatAmountWithCommas("1000"), "1,000");
    assert.equal(formatAmountWithCommas("10000"), "10,000");
    assert.equal(formatAmountWithCommas("20000"), "20,000");
    assert.equal(formatAmountWithCommas("100000"), "100,000");
    assert.equal(formatAmountWithCommas("1000000"), "1,000,000");
    assert.equal(formatAmountWithCommas("10000.50"), "10,000.50");
  });

  await t.test("2. Numerical inputs format identically to string inputs", () => {
    assert.equal(formatAmountWithCommas(1000), "1,000");
    assert.equal(formatAmountWithCommas(10000), "10,000");
    assert.equal(formatAmountWithCommas(1000000), "1,000,000");
    assert.equal(formatAmountWithCommas(10000.5), "10,000.5");
  });

  await t.test("3. Preserves empty states without forcing 0 or 0.00", () => {
    assert.equal(formatAmountWithCommas(""), "");
    assert.equal(formatAmountWithCommas(null), "");
    assert.equal(formatAmountWithCommas(undefined), "");
    assert.equal(stripCommas(""), "");
  });

  await t.test("4. Preserves decimal editing states (trailing dot and zeroes)", () => {
    assert.equal(formatAmountWithCommas("0."), "0.");
    assert.equal(formatAmountWithCommas("10000."), "10,000.");
    assert.equal(formatAmountWithCommas("10000.0"), "10,000.0");
    assert.equal(formatAmountWithCommas("10000.00"), "10,000.00");
    assert.equal(formatAmountWithCommas("10000.5"), "10,000.5");
    assert.equal(formatAmountWithCommas("10000.50"), "10,000.50");
  });

  await t.test("5. Large amounts formatted accurately without rounding or floating point errors", () => {
    assert.equal(formatAmountWithCommas("50000000"), "50,000,000");
    assert.equal(formatAmountWithCommas("1000000000.99"), "1,000,000,000.99");
    assert.equal(stripCommas("1,000,000,000.99"), "1000000000.99");
    assert.equal(parseFloat(stripCommas("1,000,000,000.99")), 1000000000.99);
  });

  await t.test("6. stripCommas returns clean numeric representation without commas", () => {
    assert.equal(stripCommas("1,000"), "1000");
    assert.equal(stripCommas("10,000"), "10000");
    assert.equal(stripCommas("100,000"), "100000");
    assert.equal(stripCommas("1,000,000"), "1000000");
    assert.equal(stripCommas("10,000.50"), "10000.50");
    assert.equal(parseFloat(stripCommas("10,000.50")), 10000.5);
  });

  await t.test("7. Reject malformed input strings and validate clean/grouped amounts", () => {
    // Valid formats
    assert.equal(isValidMoneyString("1000"), true);
    assert.equal(isValidMoneyString("1,000"), true);
    assert.equal(isValidMoneyString("10,000.50"), true);
    assert.equal(isValidMoneyString("1,000,000"), true);
    assert.equal(isValidMoneyString("₹ 1,000,000"), true);
    assert.equal(isValidMoneyString("$ 500.00"), true);
    assert.equal(isValidMoneyString("0."), true);
    assert.equal(isValidMoneyString(".50"), true);

    // Invalid / malformed formats (must be rejected!)
    assert.equal(isValidMoneyString("10abc20"), false);
    assert.equal(isValidMoneyString("10.20.30"), false);
    assert.equal(isValidMoneyString("foo"), false);
    assert.equal(isValidMoneyString("100,00"), false);
  });
});
