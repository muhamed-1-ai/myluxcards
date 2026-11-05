import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { 
  COUNTRIES, 
  DEFAULT_COUNTRY, 
  findCountryByCode, 
  findCountryByPhone, 
  searchCountries, 
  cleanNationalNumber,
  formatCountryOption 
} from "../src/lib/countries.js";
import { normalizePhoneNumber } from "../src/lib/phone.js";

test("International Countries Library - Catalog Coverage and Formatting", async (t) => {
  // 1. Verify country count covers all international territories
  assert.ok(COUNTRIES.length >= 240, `Expected >= 240 countries, got ${COUNTRIES.length}`);

  // 2. Formatted option string: e.g. "India +91", "Saudi Arabia +966"
  const india = findCountryByCode("IN");
  const saudi = findCountryByCode("SA");
  const us = findCountryByCode("US");

  assert.equal(india.name, "India");
  assert.equal(india.dialCode, "+91");
  assert.equal(formatCountryOption(india), "India +91");

  assert.equal(saudi.name, "Saudi Arabia");
  assert.equal(saudi.dialCode, "+966");
  assert.equal(formatCountryOption(saudi), "Saudi Arabia +966");

  assert.equal(us.name, "United States");
  assert.equal(us.dialCode, "+1");
  assert.equal(formatCountryOption(us), "United States +1");

  // 3. Unique option key by ISO code (handles shared dial codes like US and CA)
  const ca = findCountryByCode("CA");
  assert.notEqual(us.code, ca.code, "Country identifier codes must be distinct");
  assert.equal(us.dialCode, ca.dialCode, "US and CA share calling code +1");
});

test("International Countries Library - Search Capability", async (t) => {
  // Search by country name
  const saudiResults = searchCountries("Saudi");
  assert.ok(saudiResults.length > 0);
  assert.equal(saudiResults[0].code, "SA");

  // Search by country abbreviation / ISO code
  const inResults = searchCountries("in");
  assert.equal(inResults[0].code, "IN", "Exact ISO search should rank India first");

  const saResults = searchCountries("sa");
  assert.equal(saResults[0].code, "SA", "Exact ISO search should rank Saudi Arabia first");

  // Search by calling code (with and without +)
  const dial966 = searchCountries("+966");
  assert.equal(dial966[0].code, "SA");

  const dialRaw966 = searchCountries("966");
  assert.equal(dialRaw966[0].code, "SA");

  const dial91 = searchCountries("+91");
  assert.equal(dial91[0].code, "IN");

  // Search by alias (UAE, UK, USA)
  const uaeResults = searchCountries("uae");
  assert.ok(uaeResults.some(c => c.code === "AE"));

  const ukResults = searchCountries("uk");
  assert.ok(ukResults.some(c => c.code === "GB"));
});

test("International Phone Parsing - Pasting and Typing Support", async (t) => {
  // 1. Paste full international number with + and country code
  const saudiPasted = findCountryByPhone("+966512345678");
  assert.ok(saudiPasted);
  assert.equal(saudiPasted.country.code, "SA");
  assert.equal(saudiPasted.nationalNumber, "512345678");

  // 2. Paste international number with spaces and formatting
  const formattedSaudi = findCountryByPhone("+966 51 234 5678");
  assert.ok(formattedSaudi);
  assert.equal(formattedSaudi.country.code, "SA");
  assert.equal(formattedSaudi.nationalNumber, "512345678");

  // 3. Paste US international number
  const usPasted = findCountryByPhone("+1 (415) 555-2671");
  assert.ok(usPasted);
  assert.equal(usPasted.country.code, "US");
  assert.equal(usPasted.nationalNumber, "4155552671");

  // 4. Paste UK international number
  const ukPasted = findCountryByPhone("+44 7911 123456");
  assert.ok(ukPasted);
  assert.equal(ukPasted.country.code, "GB");
  assert.equal(ukPasted.nationalNumber, "7911123456");

  // 5. Clean national number - prevent duplicate calling code
  // If user entered or pasted digits that already include dial code
  const cleaned = cleanNationalNumber("966512345678", "+966");
  assert.equal(cleaned, "512345678", "Should strip duplicate dial code from national digits");

  const cleanedWithPlus = cleanNationalNumber("+966512345678", "+966");
  assert.equal(cleanedWithPlus, "512345678");

  // Domestic trunk 0 stripped
  const cleanedTrunk = cleanNationalNumber("0512345678", "+966");
  assert.equal(cleanedTrunk, "512345678");

  // E.164 normalization produces single prefix without duplication
  const combined = `+966 ${cleaned}`;
  const norm = normalizePhoneNumber(combined);
  assert.equal(norm.normalized, "+966512345678");
  assert.equal(norm.isValid, true);
  assert.equal(norm.telLink, "tel:+966512345678");
  assert.equal(norm.waLink, "https://wa.me/966512345678");
});

test("Edit Lead - Restore Countries Outside Old 5-Country List", async (t) => {
  // Existing lead with Saudi number (+966)
  const saudiLeadPhone = "+966512345678";
  const restoredSaudi = findCountryByPhone(saudiLeadPhone);
  assert.ok(restoredSaudi, "Saudi number must be restored");
  assert.equal(restoredSaudi.country.code, "SA");
  assert.equal(restoredSaudi.nationalNumber, "512345678");

  // Existing lead with German number (+49)
  const germanLeadPhone = "+491512345678";
  const restoredGerman = findCountryByPhone(germanLeadPhone);
  assert.ok(restoredGerman, "German number must be restored");
  assert.equal(restoredGerman.country.code, "DE");
  assert.equal(restoredGerman.nationalNumber, "1512345678");

  // Existing lead with Australian number (+61)
  const ausLeadPhone = "+61412345678";
  const restoredAus = findCountryByPhone(ausLeadPhone);
  assert.ok(restoredAus, "Australian number must be restored");
  assert.equal(restoredAus.country.code, "AU");
  assert.equal(restoredAus.nationalNumber, "412345678");
});

test("Stage Filter & Save Flow - FOLLOW_UP Support and Filter Notice", async (t) => {
  const workspacePath = path.resolve("src/components/leads/LeadsWorkspace.tsx");
  const addDrawerPath = path.resolve("src/components/leads/AddLeadDrawer.tsx");
  const leadsCssPath = path.resolve("src/app/dashboard/leads/leads.css");

  const workspaceContent = fs.readFileSync(workspacePath, "utf8");
  const addDrawerContent = fs.readFileSync(addDrawerPath, "utf8");
  const leadsCssContent = fs.readFileSync(leadsCssPath, "utf8");

  // 1. Stage dropdown in LeadsWorkspace must include FOLLOW_UP
  assert.ok(
    workspaceContent.includes('<option value="FOLLOW_UP">Follow-up</option>'),
    "LeadsWorkspace stage dropdown must include option with value FOLLOW_UP and label Follow-up"
  );

  // 2. Clear filters removes filters from both URL and results
  assert.ok(
    workspaceContent.includes("updateUrl({\n      q: null,\n      stage: null,"),
    "handleResetFilters must clear stage and active query parameters via updateUrl"
  );

  // 3. Removed unconditional counter increment in AddLeadDrawer onSuccess
  assert.ok(
    !workspaceContent.includes("setTotal((prev) => prev + 1);"),
    "Must NOT unconditionally increment total counter in onSuccess"
  );

  // 4. Notice: 'Lead created. Hidden by current filters' with 'View lead' and 'Clear filters'
  assert.ok(
    workspaceContent.includes("Lead created. Hidden by current filters"),
    "Must display exact notice text when created lead does not match active filters"
  );
  assert.ok(
    workspaceContent.includes("View lead"),
    "Notice must include 'View lead' action"
  );
  assert.ok(
    workspaceContent.includes("Clear filters"),
    "Notice must include 'Clear filters' action"
  );

  // 5. Cohesive Mobile field in AddLeadDrawer
  assert.ok(
    !addDrawerContent.includes('className="add-lead-dial-code"'),
    "AddLeadDrawer must remove separate add-lead-dial-code box"
  );
  assert.ok(
    addDrawerContent.includes("add-lead-country-selector-btn"),
    "AddLeadDrawer must use country selector button trigger inside mobile group"
  );
  assert.ok(
    addDrawerContent.includes("add-lead-country-popover"),
    "AddLeadDrawer must render searchable country popover"
  );

  // 6. CSS styling for cohesive mobile group and popover
  assert.ok(
    leadsCssContent.includes(".add-lead-country-selector-btn"),
    "leads.css must include .add-lead-country-selector-btn"
  );
  assert.ok(
    leadsCssContent.includes(".add-lead-country-popover"),
    "leads.css must include .add-lead-country-popover"
  );
  assert.ok(
    leadsCssContent.includes(".crm-filter-notice"),
    "leads.css must include .crm-filter-notice styling"
  );
});

test("Creator Privacy Rule Preservation", async (t) => {
  const adminAuthPath = path.resolve("src/lib/adminAuth.ts");
  const crmPath = path.resolve("src/lib/crm.ts");
  const leadsApiRoutePath = path.resolve("src/app/api/leads/route.ts");

  const adminAuthContent = fs.readFileSync(adminAuthPath, "utf8");
  const crmContent = fs.readFileSync(crmPath, "utf8");
  const leadsApiContent = fs.readFileSync(leadsApiRoutePath, "utf8");

  // Verify createdByUserId is recorded on lead creation
  assert.ok(
    leadsApiContent.includes("createdByUserId: identity.id"),
    "Lead creation route must pass authenticated identity.id as createdByUserId"
  );

  // Verify Super Admin creator filtering in adminAuth & crm
  assert.ok(
    adminAuthContent.includes("created_by_user_id ="),
    "adminAuth.ts must enforce created_by_user_id filter for Super Admin"
  );
  assert.ok(
    crmContent.includes("l.created_by_user_id ="),
    "crm.ts must enforce created_by_user_id filter for Super Admin"
  );
});

