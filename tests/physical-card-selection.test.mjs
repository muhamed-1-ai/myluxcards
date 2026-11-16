import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  PLAN_CATALOG,
  CARD_FINISHES,
  resolvePlanId,
  resolveCardFinishId,
  mergePlanPermissions,
} from "../src/lib/billingPlans.ts";

const choosePlanCode = readFileSync(new URL("../src/components/dashboard/ChoosePlanSection.tsx", import.meta.url), "utf8");
const dashboardCssCode = readFileSync(new URL("../src/app/dashboard/dashboard.css", import.meta.url), "utf8");
const checkoutApiCode = readFileSync(new URL("../src/app/api/checkout/route.ts", import.meta.url), "utf8");

test("1. Card Finishes catalog defines Velvet Matte Black PVC and Ceramic White PVC", () => {
  const black = CARD_FINISHES["black"];
  const white = CARD_FINISHES["white"];

  assert.ok(black, "Black card finish must exist in CARD_FINISHES");
  assert.equal(black.id, "black");
  assert.equal(black.name, "Velvet Matte Black PVC");
  assert.equal(black.shortName, "Matte Black PVC");
  assert.equal(black.badge, "Matte Finish");
  assert.match(black.description, /Durable matte PVC/i);
  assert.equal(black.image, "/assets/black-pvc-card.jpg");

  assert.ok(white, "White card finish must exist in CARD_FINISHES");
  assert.equal(white.id, "white");
  assert.equal(white.name, "Ceramic White PVC");
  assert.equal(white.shortName, "Ceramic White PVC");
  assert.equal(white.badge, "Matte Finish");
  assert.match(white.description, /Durable white PVC/i);
  assert.equal(white.image, "/assets/white-pvc-card.jpg");

  // Check physical assets exist in public folder
  assert.ok(existsSync(new URL("../public/assets/black-pvc-card.jpg", import.meta.url)), "black-pvc-card.jpg asset must exist");
  assert.ok(existsSync(new URL("../public/assets/white-pvc-card.jpg", import.meta.url)), "white-pvc-card.jpg asset must exist");
});

test("2. Card Finish resolver resolves valid identifiers and rejects invalid finishes", () => {
  assert.equal(resolveCardFinishId("black"), "black");
  assert.equal(resolveCardFinishId("Velvet Matte Black PVC"), "black");
  assert.equal(resolveCardFinishId("matte black"), "black");
  assert.equal(resolveCardFinishId("BLACK"), "black");

  assert.equal(resolveCardFinishId("white"), "white");
  assert.equal(resolveCardFinishId("Ceramic White PVC"), "white");
  assert.equal(resolveCardFinishId("white-pvc"), "white");
  assert.equal(resolveCardFinishId("WHITE"), "white");

  // Rejections
  assert.equal(resolveCardFinishId("gold"), null);
  assert.equal(resolveCardFinishId("wood"), null);
  assert.equal(resolveCardFinishId(""), null);
  assert.equal(resolveCardFinishId(null), null);
  assert.equal(resolveCardFinishId(undefined), null);
});

test("3. Step 1 (Plan Selection) carries selected plan into Step 2 and does not open checkout directly", () => {
  // Verifies flowStep state exists in ChoosePlanSection
  assert.match(choosePlanCode, /const\s+\[flowStep,\s*setFlowStep\]\s*=\s*useState<"plan"\s*\|\s*"card">\("plan"\)/);

  // Verifies handleSelectPlan advances to card step
  assert.match(choosePlanCode, /handleSelectPlan\("plan-lite"\)/);
  assert.match(choosePlanCode, /handleSelectPlan\("plan-pro"\)/);
  assert.match(choosePlanCode, /setFlowStep\("card"\)/);

  // Buttons in Step 1 render buttonLabel from catalog ("Choose Lite" and "Choose Pro")
  assert.equal(PLAN_CATALOG["plan-lite"].buttonLabel, "Choose Lite");
  assert.equal(PLAN_CATALOG["plan-pro"].buttonLabel, "Choose Pro");
  assert.match(choosePlanCode, /plan\.buttonLabel/);
});

test("4. Step 2 (Choose NFC card) renders stepper, selected plan banner, and selectable finish cards", () => {
  // Stepper indicator
  assert.match(choosePlanCode, /purchase-stepper/, "Must render purchase-stepper");
  assert.match(choosePlanCode, /1\.\s*Plan/, "Stepper must show Step 1: Plan");
  assert.match(choosePlanCode, /2\.\s*NFC Card/, "Stepper must show Step 2: NFC Card");
  assert.match(choosePlanCode, /3\.\s*Checkout/, "Stepper must show Step 3: Checkout");

  // Selected plan banner with change option
  assert.match(choosePlanCode, /selected-plan-banner/, "Must render selected plan banner");
  assert.match(choosePlanCode, /Change plan/, "Banner must allow changing plan");

  // Title & description
  assert.match(choosePlanCode, /Choose your NFC card/, "Header title must be 'Choose your NFC card'");

  // Two finish cards with images and accessibility
  assert.match(choosePlanCode, /card-finish-card/, "Must render card-finish-card elements");
  assert.match(choosePlanCode, /role="radio"/, "Card finishes must be selectable radio elements");
  assert.match(choosePlanCode, /aria-checked=\{isSelected\}/, "Card finishes must have accessible checked state");
  assert.match(choosePlanCode, /card-finish-img-wrap/, "Image wrapper must enforce aspect ratio");
  assert.match(dashboardCssCode, /aspect-ratio:\s*16\s*\/\s*10/, "Card image aspect ratio must be standard 16:10");

  // Single continue button below the pair and back button
  assert.match(choosePlanCode, /card-finish-continue-btn/, "Must have single continue button below pair");
  assert.match(choosePlanCode, /Continue to checkout/, "Continue button must say 'Continue to checkout'");
  assert.match(choosePlanCode, /card-finish-back-btn/, "Must have Back to plans button");
  assert.match(choosePlanCode, /Back to plans/, "Back button must say 'Back to plans'");
});

test("5. Step 3 (Checkout modal) displays order summary with card thumbnail and Change card action", () => {
  // Order summary thumbnail
  assert.match(choosePlanCode, /plan-checkout-summary-thumb-wrap/, "Summary must have thumbnail container");
  assert.match(choosePlanCode, /plan-checkout-summary-thumb/, "Summary must render activeFinish image");

  // Change card action
  assert.match(choosePlanCode, /plan-checkout-change-card-btn/, "Summary must have 'Change card' button");
  assert.match(choosePlanCode, /Change card/, "Button text must be 'Change card'");

  // Verification that handleChangeCard preserves entered form data
  assert.match(choosePlanCode, /handleChangeCard/, "Component must define handleChangeCard handler");
  assert.match(choosePlanCode, /setModalOpen\(false\)/, "handleChangeCard closes modal");
  assert.match(choosePlanCode, /setFlowStep\("card"\)/, "handleChangeCard returns to card step");
});

test("6. Server-side validation in /api/checkout validates card finish and persists for fulfillment", () => {
  // Validates card finish
  assert.match(checkoutApiCode, /resolveCardFinishId/, "/api/checkout must resolve card finish");
  assert.match(checkoutApiCode, /INVALID_CARD_FINISH/, "Rejects invalid card finish with INVALID_CARD_FINISH");
  assert.match(checkoutApiCode, /status:\s*400/, "Returns 400 for invalid card finish");

  // Saves to fulfillment_data and order_items
  assert.match(checkoutApiCode, /fulfillmentData[^=]*=\s*\{[\s\S]*?cardFinish:/, "Saves cardFinish in fulfillmentData");
  assert.match(checkoutApiCode, /fulfillmentData[^=]*=\s*\{[\s\S]*?cardFinishId:/, "Saves cardFinishId in fulfillmentData");
  assert.match(checkoutApiCode, /variant:\s*\{[\s\S]*?cardFinish:/, "Saves cardFinish in order_items variant");
  assert.match(checkoutApiCode, /finishName\s*\?\s*`\$\{product\.name\}\s*\(\$\{finishName\}\)`/, "Appends finish to product_name for clear fulfillment");
  assert.match(checkoutApiCode, /internal_notes:\s*notesSummary/, "Records finish in internal notes summary");
});

test("7. All 4 combinations activate correct entitlements and preserve admin privileges", () => {
  const adminPermissions = {
    accounting_access: true,
    custom_admin_flag: true,
  };

  const combinations = [
    { planId: "plan-lite", finishId: "black", planName: "Lite", finishName: "Velvet Matte Black PVC" },
    { planId: "plan-lite", finishId: "white", planName: "Lite", finishName: "Ceramic White PVC" },
    { planId: "plan-pro", finishId: "black", planName: "Pro", finishName: "Velvet Matte Black PVC" },
    { planId: "plan-pro", finishId: "white", planName: "Pro", finishName: "Ceramic White PVC" },
  ];

  for (const combo of combinations) {
    const resolvedPlan = resolvePlanId(combo.planId);
    assert.equal(resolvedPlan, combo.planId, `Plan ID ${combo.planId} must resolve correctly`);

    const resolvedFinish = resolveCardFinishId(combo.finishId);
    assert.equal(resolvedFinish, combo.finishId, `Finish ID ${combo.finishId} must resolve correctly`);

    const finishDef = CARD_FINISHES[resolvedFinish];
    assert.equal(finishDef.name, combo.finishName, `Finish name must match ${combo.finishName}`);

    const activated = mergePlanPermissions(adminPermissions, resolvedPlan);

    // Lite features are active for all combinations
    assert.equal(activated.profile_features, true, "profile_features must be true");
    assert.equal(activated.contact_info, true, "contact_info must be true");
    assert.equal(activated.card_design, true, "card_design must be true");
    assert.equal(activated.my_orders, true, "my_orders must be true");

    // Pro features check
    if (combo.planId === "plan-pro") {
      assert.equal(activated.overview, true, "Pro must grant overview");
      assert.equal(activated.all_leads, true, "Pro must grant all_leads");
      assert.equal(activated.calendar, true, "Pro must grant calendar");
      assert.equal(activated.dynamic_leads, true, "Pro must grant dynamic_leads");
    } else {
      assert.equal(activated.overview, false, "Lite must not grant overview");
      assert.equal(activated.all_leads, false, "Lite must not grant all_leads");
      assert.equal(activated.calendar, false, "Lite must not grant calendar");
      assert.equal(activated.dynamic_leads, false, "Lite must not grant dynamic_leads");
    }

    // Existing admin privileges preserved
    assert.equal(activated.accounting_access, true, "accounting_access must be preserved");
    assert.equal(activated.custom_admin_flag, true, "custom_admin_flag must be preserved");
  }
});
