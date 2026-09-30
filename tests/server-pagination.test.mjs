import test from "node:test";
import assert from "node:assert/strict";

// Helper function simulating API pagination calculation logic
function calculatePagination(total, pageInput, pageSizeInput) {
  const rawPage = parseInt(pageInput, 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const rawLimit = parseInt(pageSizeInput, 10);
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(100, rawLimit);

  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const effectivePage = Math.min(page, totalPages);
  const offset = (effectivePage - 1) * limit;

  const startRecord = total === 0 ? 0 : offset + 1;
  const endRecord = Math.min(offset + limit, total);
  const hasNextPage = effectivePage < totalPages;
  const hasPreviousPage = effectivePage > 1;

  return {
    page: effectivePage,
    pageSize: limit,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    start: startRecord,
    end: endRecord,
  };
}

test("Pagination metadata: 60 items with pageSize 10", () => {
  const page1 = calculatePagination(60, 1, 10);
  assert.equal(page1.page, 1);
  assert.equal(page1.pageSize, 10);
  assert.equal(page1.total, 60);
  assert.equal(page1.totalPages, 6);
  assert.equal(page1.start, 1);
  assert.equal(page1.end, 10);
  assert.equal(page1.hasPreviousPage, false);
  assert.equal(page1.hasNextPage, true);

  const page2 = calculatePagination(60, 2, 10);
  assert.equal(page2.page, 2);
  assert.equal(page2.start, 11);
  assert.equal(page2.end, 20);
  assert.equal(page2.hasPreviousPage, true);
  assert.equal(page2.hasNextPage, true);

  const page6 = calculatePagination(60, 6, 10);
  assert.equal(page6.page, 6);
  assert.equal(page6.start, 51);
  assert.equal(page6.end, 60);
  assert.equal(page6.hasPreviousPage, true);
  assert.equal(page6.hasNextPage, false);
});

test("Pagination edge case: 0 items (empty dataset)", () => {
  const empty = calculatePagination(0, 1, 10);
  assert.equal(empty.page, 1);
  assert.equal(empty.total, 0);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
  assert.equal(empty.hasPreviousPage, false);
  assert.equal(empty.hasNextPage, false);
});

test("Pagination validation: malicious or invalid input capping", () => {
  // Negative page becomes 1
  const negativePage = calculatePagination(50, -5, 10);
  assert.equal(negativePage.page, 1);

  // Giant pageSize is capped at 100
  const giantPageSize = calculatePagination(500, 1, 999999);
  assert.equal(giantPageSize.pageSize, 100);

  // Non-numeric strings fallback safely
  const invalidStrings = calculatePagination(100, "abc", "xyz");
  assert.equal(invalidStrings.page, 1);
  assert.equal(invalidStrings.pageSize, 10);
});

test("Pagination rows per page change resets page position", () => {
  // Scenario: User was on page 4 with pageSize 10 (total 60)
  // Changes rows per page to 25
  const newSize = 25;
  const resetPage = 1;
  const result = calculatePagination(60, resetPage, newSize);

  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 25);
  assert.equal(result.totalPages, 3);
  assert.equal(result.start, 1);
  assert.equal(result.end, 25);
});

test("Pagination delete underflow auto-correction", () => {
  // Before deletion: 51 items, page 6 of 6, item count on page 6 = 1
  // Delete item -> total becomes 50
  const totalAfterDelete = 50;
  const currentPage = 6;
  const result = calculatePagination(totalAfterDelete, currentPage, 10);

  // Auto-corrected to max valid page (Page 5)
  assert.equal(result.page, 5);
  assert.equal(result.totalPages, 5);
  assert.equal(result.start, 41);
  assert.equal(result.end, 50);
});
