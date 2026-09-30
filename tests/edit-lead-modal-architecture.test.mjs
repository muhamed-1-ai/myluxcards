import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const addLeadDrawerCode = fs.readFileSync(path.join(root, "src/components/leads/AddLeadDrawer.tsx"), "utf8");
const leadDetailsDrawerCode = fs.readFileSync(path.join(root, "src/components/leads/LeadDetailsDrawer.tsx"), "utf8");
const leadsWorkspaceCode = fs.readFileSync(path.join(root, "src/components/leads/LeadsWorkspace.tsx"), "utf8");
const leadsCss = fs.readFileSync(path.join(root, "src/app/dashboard/leads/leads.css"), "utf8");
const leadDrawerCss = fs.readFileSync(path.join(root, "src/components/leads/lead-drawer.css"), "utf8");

test("AddLeadDrawer renders via React Portal into document.body", () => {
  assert.match(addLeadDrawerCode, /import\s*\{\s*createPortal\s*\}\s*from\s*"react-dom"/);
  assert.match(addLeadDrawerCode, /createPortal\(/);
  assert.match(addLeadDrawerCode, /document\.body/);
});

test("LeadDetailsDrawer renders via React Portal into document.body", () => {
  assert.match(leadDetailsDrawerCode, /import\s*\{\s*createPortal\s*\}\s*from\s*"react-dom"/);
  assert.match(leadDetailsDrawerCode, /createPortal\(/);
  assert.match(leadDetailsDrawerCode, /document\.body/);
});

test("Z-Index hierarchy ensures Edit Lead modal (10000+) stays above Lead Details drawer (9000-9001)", () => {
  assert.match(leadsCss, /\.add-lead-overlay\s*\{[^}]*z-index:\s*10000/s);
  assert.match(leadDrawerCss, /\.lead-drawer-container\s*\{[^}]*z-index:\s*9000/s);
  assert.match(leadDrawerCss, /\.lead-drawer-panel\s*\{[^}]*z-index:\s*9001/s);
});

test("AddLeadDrawer implements backdrop element separation to prevent child element blur", () => {
  assert.match(addLeadDrawerCode, /className="add-lead-backdrop"/);
  assert.match(leadsCss, /\.add-lead-backdrop\s*\{[^}]*backdrop-filter:\s*blur/s);
});

test("Responsive mobile rules (< 767px) convert Edit Lead into full-screen dialog sheet (100dvh)", () => {
  assert.match(leadsCss, /@media\s*\(\s*max-width:\s*767px\s*\)/);
  assert.match(leadsCss, /100dvh/);
  assert.match(leadsCss, /max-width:\s*100vw/);
});

test("LeadsWorkspace cleanly closes LeadDetailsDrawer when Edit Lead is opened", () => {
  assert.match(leadsWorkspaceCode, /onEditLead=\{\(lead\)\s*=>\s*\{\s*setSelectedLeadId\(null\);\s*setEditingLead\(lead\);/s);
});

test("AddLeadDrawer implements body scroll lock and Escape key listener", () => {
  assert.match(addLeadDrawerCode, /document\.body\.style\.overflow\s*=\s*"hidden"/);
  assert.match(addLeadDrawerCode, /e\.key\s*===\s*"Escape"/);
});
