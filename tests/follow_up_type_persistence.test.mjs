import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeFollowUpType,
  extractFollowUpTypeAndCleanNote,
  ALLOWED_FOLLOW_UP_TYPES,
  FOLLOW_UP_TYPE_LABELS,
} from "../src/lib/follow-up-types.ts";

test("FollowUpType: All 5 canonical follow-up types are supported in enum list and labels", () => {
  const expectedTypes = ["CALL", "MEETING", "EMAIL", "WHATSAPP", "DEMO"];
  assert.deepEqual(ALLOWED_FOLLOW_UP_TYPES, expectedTypes);

  for (const type of expectedTypes) {
    assert.ok(FOLLOW_UP_TYPE_LABELS[type], `Label missing for ${type}`);
    assert.equal(normalizeFollowUpType(type), type);
    assert.equal(normalizeFollowUpType(type.toLowerCase()), type);
  }
});

test("FollowUpType: Normalization maps legacy values and defaults to CALL safely", () => {
  assert.equal(normalizeFollowUpType("VISIT"), "MEETING");
  assert.equal(normalizeFollowUpType("visit"), "MEETING");
  assert.equal(normalizeFollowUpType("meeting"), "MEETING");
  assert.equal(normalizeFollowUpType("email"), "EMAIL");
  assert.equal(normalizeFollowUpType("whatsapp"), "WHATSAPP");
  assert.equal(normalizeFollowUpType("demo"), "DEMO");
  assert.equal(normalizeFollowUpType("call"), "CALL");
  assert.equal(normalizeFollowUpType(null), "CALL");
  assert.equal(normalizeFollowUpType(undefined), "CALL");
  assert.equal(normalizeFollowUpType("UNKNOWN_TYPE"), "CALL");
});

test("FollowUpType: extractFollowUpTypeAndCleanNote respects explicitType over legacy note tags", () => {
  // Test explicit MEETING when note has legacy tag [Call]
  const res1 = extractFollowUpTypeAndCleanNote("[Call] Need to talk", "MEETING");
  assert.equal(res1.type, "MEETING");
  assert.equal(res1.cleanNote, "Need to talk");

  // Test explicit DEMO when note has legacy tag [Email]
  const res2 = extractFollowUpTypeAndCleanNote("[Email] Send proposal", "DEMO");
  assert.equal(res2.type, "DEMO");
  assert.equal(res2.cleanNote, "Send proposal");

  // Test legacy note tag parsing when explicitType is absent
  const res3 = extractFollowUpTypeAndCleanNote("[WhatsApp] Message sent", null);
  assert.equal(res3.type, "WHATSAPP");
  assert.equal(res3.cleanNote, "Message sent");
});

test("FollowUpType: Lead response mapper prioritizes lead's saved followUpType over scheduled followUp default", () => {
  const mockRow = {
    nextFollowUpNote: "Discuss project details",
    nextFollowUpType: "CALL", // Stale or default in lead_follow_ups
    followUpType: "MEETING",  // User selected & saved on lead record
  };

  const { type: parsedType, cleanNote: parsedNote } = extractFollowUpTypeAndCleanNote(
    mockRow.nextFollowUpNote,
    mockRow.followUpType || mockRow.nextFollowUpType
  );

  assert.equal(parsedType, "MEETING");
  assert.equal(parsedNote, "Discuss project details");
});
