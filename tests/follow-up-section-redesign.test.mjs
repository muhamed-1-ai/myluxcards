import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const addLeadDrawerCode = fs.readFileSync(path.join(root, "src/components/leads/AddLeadDrawer.tsx"), "utf8");
const leadsCss = fs.readFileSync(path.join(root, "src/app/dashboard/leads/leads.css"), "utf8");

test("AddLeadDrawer Follow-up card follows required section hierarchy", () => {
  assert.match(addLeadDrawerCode, /className="add-lead-card followup-card"/);
  assert.match(addLeadDrawerCode, /className="followup-card-header"/);
  assert.match(addLeadDrawerCode, /className="followup-header-icon"/);
  assert.match(addLeadDrawerCode, /className="followup-header-title"/);
  assert.match(addLeadDrawerCode, /className="followup-header-desc"/);
  assert.match(addLeadDrawerCode, /className="followup-grid"/);
});

test("Follow-up grid uses balanced 2-column grid on desktop and 1-column stack on mobile", () => {
  assert.match(leadsCss, /\.followup-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)/s);
  assert.match(leadsCss, /\.followup-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test("Follow-up section enforces exact 24px desktop, 20px tablet, and 16px mobile padding", () => {
  assert.match(leadsCss, /\.followup-card\s*\{[^}]*padding:\s*24px/s);
  assert.match(leadsCss, /@media\s*\(\s*max-width:\s*1023px\s*\)\s*and\s*\(\s*min-width:\s*768px\s*\)[^{]*\{[^}]*\.followup-card\s*\{[^}]*padding:\s*20px/s);
  assert.match(leadsCss, /@media\s*\(\s*max-width:\s*767px\s*\)[^{]*\{[^}]*\.followup-card\s*\{[^}]*padding:\s*16px/s);
});

test("Form controls enforce 48px touch targets and full 100% width", () => {
  assert.match(leadsCss, /\.followup-input-control\s*\{[^}]*height:\s*48px/s);
  assert.match(leadsCss, /\.followup-datetime-stack\s*\{[^}]*width:\s*100%/s);
  assert.match(leadsCss, /\.followup-note-textarea\s*\{[^}]*width:\s*100%/s);
});

test("Follow-up state bindings preserve date, time, type, and note without default resets", () => {
  assert.match(addLeadDrawerCode, /value=\{formData\.followUpDate\}/);
  assert.match(addLeadDrawerCode, /value=\{formData\.followUpTime\}/);
  assert.match(addLeadDrawerCode, /value=\{normalizeFollowUpType\(formData\.followUpType\)\}/);
  assert.match(addLeadDrawerCode, /value=\{formData\.followUpNote\}/);
});
