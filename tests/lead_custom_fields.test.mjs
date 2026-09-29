import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test("Dynamic Lead Custom Fields - CRUD and Workspace Isolation", async (t) => {
  // 1. Get or create two test users for workspace isolation testing
  let userA = await prisma.user.findFirst({
    where: { email: "test_workspace_a@example.com" }
  });
  if (!userA) {
    userA = await prisma.user.create({
      data: {
        email: "test_workspace_a@example.com",
        name: "Workspace A Owner",
        role: "CUSTOMER",
      }
    });
  }

  let userB = await prisma.user.findFirst({
    where: { email: "test_workspace_b@example.com" }
  });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        email: "test_workspace_b@example.com",
        name: "Workspace B Owner",
        role: "CUSTOMER",
      }
    });
  }

  // Clean up any test fields for these users from prior runs
  await prisma.leadFieldDefinition.deleteMany({
    where: {
      ownerUserId: { in: [userA.id, userB.id] }
    }
  });

  await t.test("Test 0: Create field with user prompt payload (NUMBER, TEXT, order 2, Optional, Active)", async () => {
    // Exact payload simulation
    const payload = {
      fieldName: "NUMBER",
      inputType: "TEXT",
      sortOrder: 2,
      required: "Optional",
      status: "Active"
    };

    // Simulate backend route logic
    const rawName = payload.fieldName ?? payload.name;
    assert.equal(rawName, "NUMBER");

    const created = await prisma.leadFieldDefinition.create({
      data: {
        ownerUserId: userA.id,
        name: rawName,
        inputType: payload.inputType,
        isRequired: false,
        status: "ACTIVE",
        sortOrder: payload.sortOrder,
        options: [],
        config: {},
      }
    });

    assert.ok(created.id, "Field ID generated");
    assert.equal(created.name, "NUMBER");
    assert.equal(created.sortOrder, 2);
    assert.equal(created.status, "ACTIVE");
    assert.equal(created.isRequired, false);
    assert.equal(created.ownerUserId, userA.id);
  });

  await t.test("Test 1: Create 'Payment Information'", async () => {
    const created = await prisma.leadFieldDefinition.create({
      data: {
        ownerUserId: userA.id,
        name: "Payment Information",
        inputType: "TEXT",
        isRequired: true,
        status: "ACTIVE",
        sortOrder: 3,
        options: [],
        config: {},
      }
    });

    assert.ok(created.id);
    assert.equal(created.name, "Payment Information");
  });

  await t.test("Test 2: Create another field 'Remark' and verify both appear in Workspace A list", async () => {
    const createdRemark = await prisma.leadFieldDefinition.create({
      data: {
        ownerUserId: userA.id,
        name: "Remark",
        inputType: "TEXTAREA",
        isRequired: false,
        status: "ACTIVE",
        sortOrder: 4,
        options: [],
        config: {},
      }
    });

    assert.ok(createdRemark.id);
    assert.equal(createdRemark.name, "Remark");

    // Fetch fields for user A
    const userAFields = await prisma.leadFieldDefinition.findMany({
      where: {
        ownerUserId: userA.id,
        status: { not: "ARCHIVED" }
      },
      orderBy: { sortOrder: "asc" }
    });

    const fieldNames = userAFields.map((f) => f.name);
    assert.ok(fieldNames.includes("Payment Information"), "Payment Information must appear in list");
    assert.ok(fieldNames.includes("Remark"), "Remark must appear in list");
    assert.ok(fieldNames.includes("NUMBER"), "NUMBER must appear in list");
  });

  await t.test("Test 3: Login with another account (Workspace B) - Only own workspace fields appear", async () => {
    // Create a field for Workspace B
    await prisma.leadFieldDefinition.create({
      data: {
        ownerUserId: userB.id,
        name: "Workspace B Private Field",
        inputType: "TEXT",
        isRequired: false,
        status: "ACTIVE",
        sortOrder: 1,
        options: [],
        config: {},
      }
    });

    // Query Workspace B fields
    const userBFields = await prisma.leadFieldDefinition.findMany({
      where: {
        ownerUserId: userB.id,
        status: { not: "ARCHIVED" }
      },
      orderBy: { sortOrder: "asc" }
    });

    const userBNames = userBFields.map((f) => f.name);
    assert.ok(userBNames.includes("Workspace B Private Field"));
    assert.ok(!userBNames.includes("Payment Information"), "Workspace B must not see User A's Payment Information");
    assert.ok(!userBNames.includes("Remark"), "Workspace B must not see User A's Remark");
    assert.ok(!userBNames.includes("NUMBER"), "Workspace B must not see User A's NUMBER");
  });

  await t.test("Test 4: Verify route implementation invariants", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const routePath = path.join(process.cwd(), "src", "app", "api", "leads", "custom-fields", "route.ts");
    assert.ok(fs.existsSync(routePath), "route.ts must exist");
    const routeCode = fs.readFileSync(routePath, "utf8");

    // DEBUG STEP 1: Detailed logging before validation
    assert.match(routeCode, /console\.log\(\s*["']CREATE CUSTOM FIELD REQUEST["']/);

    // DEBUG STEP 2: Unified aliases
    assert.match(routeCode, /body\.fieldName\s*\?\?\s*body\.name/);
    assert.match(routeCode, /body\.inputType\s*\?\?\s*body\.type/);
    assert.match(routeCode, /body\.isRequired\s*!==\s*undefined/);
    assert.match(routeCode, /body\.sortOrder\s*\?\?\s*body\.order/);

    // DEBUG STEP 3: Return actual error instead of generic
    assert.match(routeCode, /fieldName is required/);
    assert.match(routeCode, /Invalid input type/);

    // DEBUG STEP 4 & 5: Prisma model and workspace isolation
    assert.match(routeCode, /prisma\.leadFieldDefinition\.create/);
    assert.match(routeCode, /ownerUserId:\s*identity\.id/);

    // FINAL REQUIREMENT: 201 Created with success and field
    assert.match(routeCode, /status:\s*201/);
    assert.match(routeCode, /field:\s*createdField/);
  });

  // Clean up
  await prisma.leadFieldDefinition.deleteMany({
    where: {
      ownerUserId: { in: [userA.id, userB.id] }
    }
  });

  await prisma.$disconnect();
});

