import test from "node:test";
import assert from "node:assert/strict";
import {
  STANDARD_IMPORT_FIELDS,
  sanitizeFormulaInjection,
  parseDateToIsoString,
  validateImportRow,
  normalizeHeader,
} from "../src/lib/leads-import.ts";

test("TEST 1: Standard import fields catalog structure & headers", () => {
  assert.ok(STANDARD_IMPORT_FIELDS.length >= 15, "Should have all standard lead import fields");
  const headers = STANDARD_IMPORT_FIELDS.map((f) => f.header);
  assert.ok(headers.includes("Lead Name"));
  assert.ok(headers.includes("Mobile Number"));
  assert.ok(headers.includes("Email Address"));
  assert.ok(headers.includes("Follow-up Date"));
  assert.ok(headers.includes("Total Amount"));
});

test("TEST 2: Formula injection sanitization for Excel/CSV security", () => {
  assert.equal(sanitizeFormulaInjection("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.equal(sanitizeFormulaInjection("+12345"), "'+12345");
  assert.equal(sanitizeFormulaInjection("-CMD"), "'-CMD");
  assert.equal(sanitizeFormulaInjection("@EXCEL"), "'@EXCEL");
  assert.equal(sanitizeFormulaInjection("John Doe"), "John Doe");
});

test("TEST 3: Date parser handles YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY", () => {
  assert.deepEqual(parseDateToIsoString("2026-10-15"), { dateStr: "2026-10-15", isValid: true });
  assert.deepEqual(parseDateToIsoString("15/10/2026"), { dateStr: "2026-10-15", isValid: true });
  assert.equal(parseDateToIsoString("invalid-date").isValid, false);
});

test("TEST 4: ALL FIELDS ARE OPTIONAL - Name only row is VALID", () => {
  const mockContext = {
    ownerUserId: "user-123",
    cardId: "card-123",
    users: [],
    dynamicFields: [],
    allowedStages: ["NEW", "CONTACTED", "WON", "LOST"],
    allowedSources: ["MANUAL", "NFC"],
  };

  const headerMapping = {
    "Lead Name": { type: "standard", key: "name" },
  };

  const res = validateImportRow({ "Lead Name": "John Acme" }, 2, headerMapping, mockContext);
  assert.equal(res.isEmpty, false);
  assert.equal(res.isValid, true);
  assert.equal(res.data.name, "John Acme");
  assert.equal(res.errors.length, 0);
});

test("TEST 5: ALL FIELDS ARE OPTIONAL - Mobile only row is VALID", () => {
  const mockContext = {
    ownerUserId: "user-123",
    cardId: "card-123",
    users: [],
    dynamicFields: [],
    allowedStages: ["NEW"],
    allowedSources: ["MANUAL"],
  };

  const headerMapping = {
    "Mobile Number": { type: "standard", key: "contactNumber" },
  };

  const res = validateImportRow({ "Mobile Number": "+919876543210" }, 3, headerMapping, mockContext);
  assert.equal(res.isEmpty, false);
  assert.equal(res.isValid, true);
  assert.equal(res.data.contactNumber, "+919876543210");
  assert.equal(res.errors.length, 0);
});

test("TEST 6: ALL FIELDS ARE OPTIONAL - Dynamic field only row is VALID", () => {
  const mockContext = {
    ownerUserId: "user-123",
    cardId: "card-123",
    users: [],
    dynamicFields: [{ id: "def-univ", name: "University", inputType: "TEXT" }],
    allowedStages: ["NEW"],
    allowedSources: ["MANUAL"],
  };

  const headerMapping = {
    University: { type: "dynamic", key: "def-univ", def: mockContext.dynamicFields[0] },
  };

  const res = validateImportRow({ University: "Harvard University" }, 4, headerMapping, mockContext);
  assert.equal(res.isEmpty, false);
  assert.equal(res.isValid, true);
  assert.equal(res.data.dynamicValues["def-univ"], "Harvard University");
});

test("TEST 7: Completely empty rows are flagged as isEmpty", () => {
  const mockContext = {
    ownerUserId: "user-123",
    cardId: "card-123",
    users: [],
    dynamicFields: [],
    allowedStages: ["NEW"],
    allowedSources: ["MANUAL"],
  };

  const headerMapping = {
    "Lead Name": { type: "standard", key: "name" },
    "Mobile Number": { type: "standard", key: "contactNumber" },
  };

  const res = validateImportRow({ "Lead Name": "   ", "Mobile Number": "" }, 5, headerMapping, mockContext);
  assert.equal(res.isEmpty, true);
  assert.equal(res.isValid, false);
});

test("TEST 8: Invalid Current Lead Stage flags row-level error", () => {
  const mockContext = {
    ownerUserId: "user-123",
    cardId: "card-123",
    users: [],
    dynamicFields: [],
    allowedStages: ["NEW", "CONTACTED", "WON"],
    allowedSources: ["MANUAL"],
  };

  const headerMapping = {
    "Lead Name": { type: "standard", key: "name" },
    "Current Lead Stage": { type: "standard", key: "stage" },
  };

  const res = validateImportRow({ "Lead Name": "John", "Current Lead Stage": "StageX" }, 6, headerMapping, mockContext);
  assert.equal(res.isValid, false);
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0].message, /Stage "StageX" does not exist/);
});

test("TEST 9: Follow-up fields correctly validated and parsed", () => {
  const mockContext = {
    ownerUserId: "user-123",
    cardId: "card-123",
    users: [],
    dynamicFields: [],
    allowedStages: ["NEW"],
    allowedSources: ["MANUAL"],
  };

  const headerMapping = {
    "Lead Name": { type: "standard", key: "name" },
    "Follow-up Date": { type: "standard", key: "nextFollowUpAt" },
    "Follow-up Type": { type: "standard", key: "nextFollowUpType" },
    "Follow-up Note": { type: "standard", key: "nextFollowUpNote" },
  };

  const res = validateImportRow(
    {
      "Lead Name": "Jane",
      "Follow-up Date": "2026-10-15",
      "Follow-up Type": "Meeting",
      "Follow-up Note": "Discuss pricing proposal",
    },
    7,
    headerMapping,
    mockContext
  );

  assert.equal(res.isValid, true);
  assert.equal(res.data.nextFollowUpAt, "2026-10-15");
  assert.equal(res.data.nextFollowUpType, "MEETING");
  assert.equal(res.data.nextFollowUpNote, "Discuss pricing proposal");
});
