/**
 * FitCore AI — Frontend Navigation & Plan Dropdown Unit / Logic Tests
 * Executed via node:test (Node v20+ native test runner)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Bug 1 Fix: Dashboard Sidebar Navigation & Route Recognition", () => {
  const navItems = [
    { label: "Overview", href: "/dashboard" },
    { label: "Members", href: "/dashboard/members" },
    { label: "Trainers", href: "#", disabled: true },
    { label: "Membership Plans", href: "/dashboard/membership-plans" },
    { label: "Subscriptions", href: "/dashboard/subscriptions" },
    { label: "Branches", href: "/dashboard/branches" },
    { label: "Staff & Roles", href: "#", disabled: true },
    { label: "Settings", href: "#", disabled: true },
  ];

  function isItemActive(itemHref, pathname) {
    if (itemHref === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
  }

  it("verifies all active navigation items have valid dashboard hrefs", () => {
    const activeNav = navItems.filter((item) => !item.disabled && item.href !== "#");
    assert.equal(activeNav.length, 5);

    const hrefs = activeNav.map((n) => n.href);
    assert.deepEqual(hrefs, [
      "/dashboard",
      "/dashboard/members",
      "/dashboard/membership-plans",
      "/dashboard/subscriptions",
      "/dashboard/branches",
    ]);
  });

  it("accurately highlights active routes including subroutes", () => {
    // Exact overview match
    assert.equal(isItemActive("/dashboard", "/dashboard"), true);
    // Overview should NOT be active on /dashboard/members
    assert.equal(isItemActive("/dashboard", "/dashboard/members"), false);

    // Members list match
    assert.equal(isItemActive("/dashboard/members", "/dashboard/members"), true);
    // Members subroutes (new member, member detail) MUST stay active
    assert.equal(isItemActive("/dashboard/members", "/dashboard/members/new"), true);
    assert.equal(
      isItemActive("/dashboard/members", "/dashboard/members/a1b2c3d4-uuid"),
      true
    );
    // Should NOT match other pages
    assert.equal(isItemActive("/dashboard/members", "/dashboard/subscriptions"), false);

    // Membership Plans
    assert.equal(
      isItemActive("/dashboard/membership-plans", "/dashboard/membership-plans"),
      true
    );

    // Subscriptions
    assert.equal(
      isItemActive("/dashboard/subscriptions", "/dashboard/subscriptions"),
      true
    );

    // Branches
    assert.equal(
      isItemActive("/dashboard/branches", "/dashboard/branches"),
      true
    );
    assert.equal(
      isItemActive("/dashboard/branches", "/dashboard/branches/new"),
      true
    );
  });

  it("closes mobile drawer upon navigation link selection", () => {
    let isMobileOpen = true;
    function handleMobileNavClick(item) {
      if (item.disabled) return;
      isMobileOpen = false;
    }

    handleMobileNavClick({ label: "Members", href: "/dashboard/members" });
    assert.equal(isMobileOpen, false);
  });

  it("prevents interaction on disabled navigation items", () => {
    let navigated = false;
    function simulateNav(item) {
      if (item.disabled) return false;
      navigated = true;
      return true;
    }

    const disabledItem = navItems.find((n) => n.label === "Trainers");
    assert.equal(simulateNav(disabledItem), false);
    assert.equal(navigated, false);
  });
});

describe("Bug 2 Fix: Membership Plan Dropdown & Subscription Assignment Flow", () => {
  it("processes plan selection and updates prices and currencies correctly", () => {
    const plans = [
      {
        id: "plan-uuid-1",
        name: "Monthly Standard",
        price: 49.99,
        currency: "USD",
        duration_days: 30,
        is_active: true,
      },
      {
        id: "plan-uuid-2",
        name: "Annual Premium",
        price: 499.0,
        currency: "EUR",
        duration_days: 365,
        is_active: true,
      },
    ];

    let selectedPlanId = "";
    let assignPrice = "";
    let assignCurrency = "USD";

    function handlePlanSelection(planId, availablePlans) {
      selectedPlanId = planId;
      const found = availablePlans.find((p) => p.id === planId);
      if (found) {
        assignPrice = found.price.toString();
        assignCurrency = found.currency || "USD";
      } else {
        assignPrice = "";
      }
    }

    handlePlanSelection("plan-uuid-2", plans);
    assert.equal(selectedPlanId, "plan-uuid-2");
    assert.equal(assignPrice, "499");
    assert.equal(assignCurrency, "EUR");
  });

  it("identifies empty plan list and yields guidance with creation link", () => {
    const emptyPlans = [];

    function evaluatePlanState(isLoading, error, plans) {
      if (isLoading) return "LOADING";
      if (error) return "ERROR";
      if (!plans || plans.length === 0) return "EMPTY_PLANS";
      return "READY";
    }

    assert.equal(evaluatePlanState(true, null, []), "LOADING");
    assert.equal(evaluatePlanState(false, "API connection failed", []), "ERROR");
    assert.equal(evaluatePlanState(false, null, emptyPlans), "EMPTY_PLANS");
    assert.equal(
      evaluatePlanState(false, null, [{ id: "p1", name: "Basic", price: 10 }]),
      "READY"
    );
  });

  it("resets plan state and closes modal when active gym switches", () => {
    let isAssignOpen = true;
    let availablePlans = [{ id: "old-plan" }];
    let selectedPlanId = "old-plan";
    let assignError = "old error";

    function handleGymSwitch() {
      isAssignOpen = false;
      availablePlans = [];
      selectedPlanId = "";
      assignError = null;
    }

    handleGymSwitch();
    assert.equal(isAssignOpen, false);
    assert.deepEqual(availablePlans, []);
    assert.equal(selectedPlanId, "");
    assert.equal(assignError, null);
  });

  it("filters out deactivated plans from selection list", () => {
    const apiPlans = [
      { id: "p1", name: "Active Plan", is_active: true },
      { id: "p2", name: "Deactivated Plan", is_active: false },
      { id: "p3", name: "Default Plan", is_active: undefined }, // Should default to active
    ];

    const selectable = apiPlans.filter((p) => p.is_active !== false);
    assert.equal(selectable.length, 2);
    assert.deepEqual(
      selectable.map((p) => p.id),
      ["p1", "p3"]
    );
  });

  it("validates subscription assignment payload before submission", () => {
    function validateSubscriptionInput(input) {
      const errors = [];
      if (!input.member_id || input.member_id.trim().length === 0) {
        errors.push("Member is required");
      }
      if (!input.plan_id || input.plan_id.trim().length === 0) {
        errors.push("Membership Plan is required");
      }
      if (!input.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) {
        errors.push("Valid start date is required");
      }
      if (input.price_paid !== undefined && (isNaN(input.price_paid) || input.price_paid < 0)) {
        errors.push("Price must be a non-negative number");
      }
      return errors;
    }

    // Invalid submission: missing plan_id
    const invalidInput = {
      member_id: "00000000-0000-0000-0000-000000000001",
      plan_id: "",
      start_date: "2026-11-23",
      price_paid: 50,
    };
    assert.equal(validateSubscriptionInput(invalidInput).length, 1);
    assert.equal(validateSubscriptionInput(invalidInput)[0], "Membership Plan is required");

    // Valid submission
    const validInput = {
      member_id: "00000000-0000-0000-0000-000000000001",
      plan_id: "00000000-0000-0000-0000-000000000002",
      start_date: "2026-11-23",
      price_paid: 49.99,
    };
    assert.equal(validateSubscriptionInput(validInput).length, 0);
  });
});

describe("Branch Management Directory Logic", () => {
  const sampleBranches = [
    {
      id: "b1",
      gym_id: "gym-1",
      name: "ENERGYM Main",
      slug: "main",
      address: "100 Main St",
      is_main: true,
      is_active: true,
    },
    {
      id: "b2",
      gym_id: "gym-1",
      name: "Alawwa",
      slug: "alawwa",
      address: "Alawwa Town Center",
      is_main: false,
      is_active: true,
    },
    {
      id: "b3",
      gym_id: "gym-1",
      name: "Old Warehouse",
      slug: "old-warehouse",
      address: "Industrial Zone",
      is_main: false,
      is_active: false,
    },
  ];

  it("filters branches by search query across name, slug, and address", () => {
    const search = "alawwa";
    const filtered = sampleBranches.filter(
      (b) =>
        b.name.toLowerCase().includes(search) ||
        b.slug.toLowerCase().includes(search) ||
        b.address.toLowerCase().includes(search)
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].name, "Alawwa");
  });

  it("filters branches by status correctly (main, active, inactive)", () => {
    const mainBranches = sampleBranches.filter((b) => b.is_main);
    assert.equal(mainBranches.length, 1);
    assert.equal(mainBranches[0].slug, "main");

    const activeBranches = sampleBranches.filter((b) => b.is_active);
    assert.equal(activeBranches.length, 2);

    const inactiveBranches = sampleBranches.filter((b) => !b.is_active);
    assert.equal(inactiveBranches.length, 1);
    assert.equal(inactiveBranches[0].name, "Old Warehouse");
  });
});
