import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("1. Coordinated Sequence - Timing, Stagger, and Rhythm", () => {
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");
  const motionJs = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");

  // Reserved layout shell
  assert.ok(dashCss.includes(".dash-main-tab-wrap"), "Must have tab wrap container");
  assert.ok(dashCss.includes(".crm-kpi-card.is-skeleton"), "Must have skeleton placeholder cards reserving layout");

  // Phase 1: Card surface growth
  assert.ok(dashCss.includes(".dash-entrance-card"), "Must define .dash-entrance-card");
  assert.ok(dashCss.includes("@keyframes dashCardGrow"), "Must define dashCardGrow keyframes");

  // Phase 2: Card headings & controls reveal shortly after surface
  assert.ok(dashCss.includes(".dash-entrance-card .dash-card-content"), "Must target inner card content");
  assert.ok(dashCss.includes("@keyframes dashCardContentReveal"), "Must define dashCardContentReveal");

  // Phase 3: Animated numbers
  assert.ok(motionJs.includes("export function useAnimatedNumber"), "Must provide useAnimatedNumber hook");
  assert.ok(motionJs.includes("export function AnimatedNumber"), "Must provide AnimatedNumber component");

  // Phase 4: Settle timing and transform release
  assert.ok(motionJs.includes("settleDelayMs: number = 1000"), "useDashboardEntrance must support settle delay for transform release");
  assert.ok(motionJs.includes("shouldAnimateEntrance: hasEntered && !isSettled && !reducedMotion"), "Must release shouldAnimateEntrance once settled");
});

test("2. Pipeline Stages Donut - Clockwise Progressive Sweep & Real Data Integrity", () => {
  const pipelineCode = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadLivePipeline.tsx"), "utf8");
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");

  // Clockwise sweep mask starting at 12 o'clock (-90deg)
  assert.ok(pipelineCode.includes("transform={`rotate(-90 ${center} ${center})`}"), "Mask must rotate -90deg around center to start at 12 o'clock");
  assert.ok(pipelineCode.includes("strokeDasharray={`${circumference} ${circumference}`}"), "Mask must set circumference strokeDasharray");
  assert.ok(pipelineCode.includes("pipeline-donut-sweep-mask"), "Mask must apply pipeline-donut-sweep-mask class");
  assert.ok(dashCss.includes(".pipeline-donut-sweep-mask"), "dashboard.css must style .pipeline-donut-sweep-mask");
  assert.ok(dashCss.includes("@keyframes pipelineDonutSweep"), "dashboard.css must define pipelineDonutSweep keyframes");

  // Coordinated center counter & legend reveal
  assert.ok(pipelineCode.includes("useAnimatedNumber(totalLeads"), "Must coordinate center counter via useAnimatedNumber");
  assert.ok(pipelineCode.includes("animatedCenterTotal"), "Must render animatedCenterTotal inside center text");
  assert.ok(pipelineCode.includes("dash-legend-reveal"), "Must apply dash-legend-reveal to table rows");
  assert.ok(dashCss.includes(".pipeline-table-row.dash-legend-reveal"), "dashboard.css must define .pipeline-table-row.dash-legend-reveal");

  // Settle lifecycle (release mask after animation finishes)
  assert.ok(pipelineCode.includes("mask={isSettled ? undefined : `url(#${maskId})`}"), "Must release SVG mask once settled");
  assert.ok(pipelineCode.includes("hasAnimatedRef.current = true"), "Must guard with hasAnimatedRef so filters and typing do not retrigger");

  // Real data handling: 0-count stages stay in legend without visible segments
  assert.ok(pipelineCode.includes("filter((s) => (pipelineCounts?.[s.key] || 0) > 0)"), "Only stages with >0 count generate ring slices");
  assert.ok(pipelineCode.includes("PIPELINE_STAGES.map("), "All stages remain present in the legend table");
  assert.ok(pipelineCode.includes("pipeline-empty-ring"), "Must handle 0 leads via neutral placeholder ring");

  // Check finite positive SVG dimensions
  assert.ok(pipelineCode.includes("const size = 220;"), "Size must be finite positive constant");
  assert.ok(pipelineCode.includes("const radius = 80;"), "Radius must be finite positive constant");
  assert.ok(pipelineCode.includes("const strokeWidth = 18;"), "Stroke width must be finite positive constant");
});

test("3. Explicit Exclusion of Growth Velocity (Screenshot 2)", () => {
  const dashCode = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");
  const chartCode = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadGrowthChart.tsx"), "utf8");

  // In LeadManagementDashboard, renderGrowthChartCard must NOT wrap with dash-entrance-card or dash-card-content
  const growthRenderFn = dashCode.substring(
    dashCode.indexOf("const renderGrowthChartCard"),
    dashCode.indexOf("const renderPipelineCard")
  );
  assert.ok(!growthRenderFn.includes("dash-entrance-card"), "renderGrowthChartCard must NOT wrap with dash-entrance-card");
  assert.ok(!growthRenderFn.includes("dash-card-content"), "renderGrowthChartCard must NOT wrap with dash-card-content");
  assert.ok(growthRenderFn.includes("<LeadGrowthChart"), "renderGrowthChartCard must directly mount LeadGrowthChart");

  // LeadGrowthChart retains its own internal clip-path horizontal reveal and period controls
  assert.ok(chartCode.includes("clipPath id={clipId}"), "LeadGrowthChart must retain its own SVG horizontal clipPath reveal");
  assert.ok(chartCode.includes("growth-period-selector"), "LeadGrowthChart must retain period controls");
  assert.ok(chartCode.includes("periodTotal"), "LeadGrowthChart must retain animated period total counter");
});

test("4. Full Dashboard Coverage Across All Tabs and Sections", () => {
  // 1. Dashboard & CRM
  const overview = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");
  const leads = fs.readFileSync(path.join(ROOT, "src/components/leads/LeadsWorkspace.tsx"), "utf8");
  assert.ok(overview.includes("dash-entrance-card"), "Overview cards must use dash-entrance-card");
  assert.ok(leads.includes("dash-entrance-panel"), "Leads table must use dash-entrance-panel");

  // 2. Master Config
  const cfgSources = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LeadSourcesConfig.tsx"), "utf8");
  const cfgStages = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LeadStagesConfig.tsx"), "utf8");
  const cfgProducts = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/ProductsConfig.tsx"), "utf8");
  const cfgCalendar = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/CalendarConfig.tsx"), "utf8");
  const cfgReasons = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LobReasonsConfig.tsx"), "utf8");
  const cfgDynamic = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LeadDynamicsConfig.tsx"), "utf8");

  assert.ok(cfgSources.includes("dash-entrance-card") && cfgSources.includes("dash-entrance-panel"), "Sources has entrance");
  assert.ok(cfgStages.includes("dash-entrance-card") && cfgStages.includes("dash-entrance-panel"), "Stages has entrance");
  assert.ok(cfgProducts.includes("dash-entrance-header") && cfgProducts.includes("dash-entrance-panel"), "Products has entrance");
  assert.ok(cfgCalendar.includes("dash-entrance-card") && cfgCalendar.includes("dash-entrance-panel"), "Calendar has entrance");
  assert.ok(cfgReasons.includes("dash-entrance-header") && cfgReasons.includes("dash-entrance-panel"), "Reasons has entrance");
  assert.ok(cfgDynamic.includes("dash-entrance-card") && cfgDynamic.includes("dash-entrance-panel"), "Dynamic fields has entrance");

  // 3. Accounting Pages
  const accOverview = fs.readFileSync(path.join(ROOT, "src/components/accounting/AccountingOverview.tsx"), "utf8");
  const accTx = fs.readFileSync(path.join(ROOT, "src/components/accounting/TransactionsView.tsx"), "utf8");
  const accPeople = fs.readFileSync(path.join(ROOT, "src/components/accounting/PeopleView.tsx"), "utf8");
  const accInvoices = fs.readFileSync(path.join(ROOT, "src/components/accounting/SalesInvoicesView.tsx"), "utf8");
  const accProducts = fs.readFileSync(path.join(ROOT, "src/components/accounting/ProductsView.tsx"), "utf8");
  const accCategories = fs.readFileSync(path.join(ROOT, "src/components/accounting/CategoriesView.tsx"), "utf8");
  const accReports = fs.readFileSync(path.join(ROOT, "src/components/accounting/ReportsView.tsx"), "utf8");
  const accMore = fs.readFileSync(path.join(ROOT, "src/components/accounting/MoreView.tsx"), "utf8");

  assert.ok(accOverview.includes("acc-entrance-card") && accOverview.includes("acc-chart-line-reveal-in"), "Accounting Overview has entrance");
  assert.ok(accTx.includes("acc-entrance-header") && accTx.includes("acc-entrance-panel"), "Transactions has entrance");
  assert.ok(accPeople.includes("acc-entrance-header") && accPeople.includes("acc-entrance-panel"), "People has entrance");
  assert.ok(accInvoices.includes("acc-entrance-header") && accInvoices.includes("acc-entrance-panel"), "Invoices has entrance");
  assert.ok(accProducts.includes("acc-entrance-header") && accProducts.includes("acc-entrance-panel"), "Products has entrance");
  assert.ok(accCategories.includes("acc-entrance-header") && accCategories.includes("acc-entrance-panel"), "Categories has entrance");
  assert.ok(accReports.includes("acc-entrance-header") && accReports.includes("acc-entrance-panel"), "Reports has entrance");
  assert.ok(accMore.includes("acc-entrance-header") && accMore.includes("acc-entrance-panel"), "More has entrance");

  // 4. Card & Account Screens
  const demoFile = fs.readFileSync(path.join(ROOT, "src/app/dashboard/DashboardDemo.tsx"), "utf8");
  const settingsFile = fs.readFileSync(path.join(ROOT, "src/components/settings/GlobalAccountSettingsView.tsx"), "utf8");

  assert.ok(demoFile.includes("dash-entrance-panel"), "Card edit views have dash-entrance-panel");
  assert.ok(demoFile.includes("dash-entrance-header"), "Card edit views have dash-entrance-header");
  assert.ok(settingsFile.includes("acc-entrance-header") && settingsFile.includes("acc-entrance-panel"), "Account settings has entrance");
});

test("5. Transform Release & Stability on Filters/Typing/Theme", () => {
  const motionJs = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");
  const pipelineJs = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadLivePipeline.tsx"), "utf8");

  // useDashboardEntrance releases CSS transforms after settle delay
  assert.ok(motionJs.includes("setIsSettled(true)"), "Must set isSettled after duration");
  assert.ok(motionJs.includes("shouldAnimateEntrance: hasEntered && !isSettled && !reducedMotion"), "shouldAnimateEntrance must become false after settle");

  // Pipeline donut mask releases after settle
  assert.ok(pipelineJs.includes("mask={isSettled ? undefined : `url(#${maskId})`}"), "SVG mask is removed once settled");

  // Retain values during background data refresh without restart
  assert.ok(motionJs.includes("previousTargetRef.current = endValue"), "Animated numbers retain previous values on refresh without resetting to zero");
});

test("6. Accessibility - Reduced Motion Guarantees", () => {
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");
  const motionJs = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");
  const pipelineJs = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadLivePipeline.tsx"), "utf8");

  // prefers-reduced-motion in JS
  assert.ok(motionJs.includes("usePrefersReducedMotion()"), "Must detect reduced motion");
  assert.ok(pipelineJs.includes("if (prefersReducedMotion)"), "Pipeline must immediately settle on reduced motion");

  // prefers-reduced-motion in CSS
  assert.ok(dashCss.includes("@media (prefers-reduced-motion: reduce)"), "dashboard.css must have reduced-motion query");
  assert.ok(dashCss.includes(".pipeline-donut-sweep-mask"), "Must override .pipeline-donut-sweep-mask under reduced motion");
  assert.ok(dashCss.includes(".pipeline-table-row.dash-legend-reveal"), "Must override legend reveal under reduced motion");
});

