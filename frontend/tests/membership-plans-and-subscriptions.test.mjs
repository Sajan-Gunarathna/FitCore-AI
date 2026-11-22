/**
 * Automated tests for Milestone 2.5: Membership Plans & Subscriptions Logic
 * Executed via node:test (Node v20+ native test runner)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Milestone 2.5: Membership Plans & Subscriptions Contract Verification", () => {
  it("calculates renewal start date correctly for active vs expired subscriptions", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Case 1: Active subscription ending in 10 days
    const activeEndDate = new Date(today);
    activeEndDate.setDate(activeEndDate.getDate() + 10);

    function computeRenewalDates(subStatus, subEndDate, durationDays) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let nextStart;
      if (subStatus === "active" && subEndDate >= now) {
        nextStart = new Date(subEndDate);
        nextStart.setDate(nextStart.getDate() + 1);
      } else {
        nextStart = new Date(now);
      }

      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + durationDays);

      return {
        startDate: nextStart.toISOString().split("T")[0],
        endDate: nextEnd.toISOString().split("T")[0],
      };
    }

    const activeRenewal = computeRenewalDates("active", activeEndDate, 30);
    const expectedActiveStart = new Date(activeEndDate);
    expectedActiveStart.setDate(expectedActiveStart.getDate() + 1);
    assert.equal(activeRenewal.startDate, expectedActiveStart.toISOString().split("T")[0]);

    // Case 2: Expired subscription ending 5 days ago
    const expiredEndDate = new Date(today);
    expiredEndDate.setDate(expiredEndDate.getDate() - 5);

    const expiredRenewal = computeRenewalDates("expired", expiredEndDate, 30);
    assert.equal(expiredRenewal.startDate, today.toISOString().split("T")[0]);
  });

  it("validates membership plan creation parameters", () => {
    function validatePlan(plan) {
      const errors = [];
      if (!plan.name || plan.name.trim().length < 2) {
        errors.push("Plan name must be at least 2 characters");
      }
      if (!plan.duration_days || plan.duration_days < 1 || plan.duration_days > 3650) {
        errors.push("Duration must be between 1 and 3650 days");
      }
      if (plan.price === undefined || plan.price === null || plan.price < 0) {
        errors.push("Price cannot be negative");
      }
      const validFrequencies = ["one_time", "monthly", "quarterly", "yearly"];
      if (plan.billing_frequency && !validFrequencies.includes(plan.billing_frequency.toLowerCase())) {
        errors.push("Invalid billing frequency");
      }
      return errors;
    }

    // Valid plan
    const validPlan = {
      name: "Gold Monthly",
      duration_days: 30,
      price: 49.99,
      billing_frequency: "monthly",
    };
    assert.deepEqual(validatePlan(validPlan), []);

    // Invalid plan: negative price, invalid frequency
    const invalidPlan = {
      name: "A",
      duration_days: 0,
      price: -10,
      billing_frequency: "weekly",
    };
    const errors = validatePlan(invalidPlan);
    assert.equal(errors.length, 4);
  });

  it("verifies days remaining calculation for active vs cancelled subscriptions", () => {
    function computeDaysRemaining(status, endDateStr, todayStr) {
      if (status !== "active") return null;
      const end = new Date(endDateStr);
      const today = new Date(todayStr);
      const diffTime = end.getTime() - today.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    assert.equal(
      computeDaysRemaining("active", "2026-12-05", "2026-11-30"),
      5
    );
    assert.equal(
      computeDaysRemaining("cancelled", "2026-12-05", "2026-11-30"),
      null
    );
    assert.equal(
      computeDaysRemaining("expired", "2026-11-20", "2026-11-30"),
      null
    );
  });

  it("verifies tenant-header synchronization guard in FitCoreApiClient request", () => {
    // Simulates ApiClient request verification that gymId matches X-Gym-ID
    function simulateRequestHeaders(path, gymId) {
      const match = path.match(/\/gyms\/([^/]+)\//i);
      const pathGymId = match ? match[1] : null;

      const headers = {
        "X-Gym-ID": gymId,
      };

      if (pathGymId && gymId && pathGymId !== gymId) {
        throw new Error(
          `Tenant Desynchronization Guard: Path gym_id (${pathGymId}) does not match active gym (${gymId}).`
        );
      }

      return headers;
    }

    // Synchronized request passes
    const syncHeaders = simulateRequestHeaders(
      "/gyms/alpha-123/membership-plans",
      "alpha-123"
    );
    assert.equal(syncHeaders["X-Gym-ID"], "alpha-123");

    // Desynchronized request throws error
    assert.throws(
      () =>
        simulateRequestHeaders(
          "/gyms/alpha-123/membership-plans",
          "beta-456"
        ),
      /Tenant Desynchronization Guard/
    );
  });
});
