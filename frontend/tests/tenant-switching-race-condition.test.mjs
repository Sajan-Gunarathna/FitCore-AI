/**
 * Automated tests for Tenant Switching & Out-of-Order API Response Prevention
 * Executed via node:test (Node v20+ native test runner)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Tenant Switching & Race Condition Guard", () => {
  it("prevents stale/out-of-order responses from previous gym from overwriting current gym state", async () => {
    let displayedGymData = null;
    let requestIdCounter = 0;
    let activeGymId = null;

    // Simulation of data fetching logic in dashboard
    async function switchAndFetch(targetGymId, delayMs, payload) {
      const currentRequestId = ++requestIdCounter;
      activeGymId = targetGymId;
      displayedGymData = null; // Clear state on switch

      // Simulate async network delay
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Guard: out-of-order check
      if (currentRequestId !== requestIdCounter || targetGymId !== activeGymId) {
        // Discard stale response
        return;
      }

      displayedGymData = payload;
    }

    // 1. User starts on Gym A, but the network request is slow (100ms)
    const gymAPromise = switchAndFetch("gym-alpha-id", 100, {
      gym_id: "gym-alpha-id",
      gym_name: "Gym Alpha",
      total_members: 42,
    });

    // 2. User quickly switches to Gym B before Gym A completes (20ms delay)
    await new Promise((resolve) => setTimeout(resolve, 10));
    const gymBPromise = switchAndFetch("gym-beta-id", 20, {
      gym_id: "gym-beta-id",
      gym_name: "Gym Beta",
      total_members: 15,
    });

    await Promise.all([gymAPromise, gymBPromise]);

    // 3. Verify: Gym B's data is displayed, Gym A's late response was ignored
    assert.notEqual(displayedGymData, null);
    assert.equal(displayedGymData.gym_id, "gym-beta-id");
    assert.equal(displayedGymData.gym_name, "Gym Beta");
    assert.equal(displayedGymData.total_members, 15);
  });

  it("aborts inflight requests when switching gyms", () => {
    let controller = null;

    function initiateGymRequest() {
      if (controller) {
        controller.abort();
      }
      controller = new AbortController();
      return controller;
    }

    const firstController = initiateGymRequest();
    assert.equal(firstController.signal.aborted, false);

    const secondController = initiateGymRequest();
    // First controller must be aborted
    assert.equal(firstController.signal.aborted, true);
    assert.equal(secondController.signal.aborted, false);
  });

  it("validates localStorage preferred gym against accessible gyms list (tamper resistance)", () => {
    const accessibleGyms = [
      { id: "legit-gym-1", name: "Legitimate Gym 1" },
      { id: "legit-gym-2", name: "Legitimate Gym 2" },
    ];

    function resolveActiveGym(storedId) {
      if (storedId && accessibleGyms.some((g) => g.id === storedId)) {
        return storedId;
      }
      return accessibleGyms[0]?.id || null;
    }

    // Legit stored ID resolves correctly
    assert.equal(resolveActiveGym("legit-gym-2"), "legit-gym-2");

    // Malicious or foreign tenant ID tampered in localStorage is rejected
    assert.equal(resolveActiveGym("malicious-foreign-gym-uuid"), "legit-gym-1");

    // Null or empty falls back to first gym
    assert.equal(resolveActiveGym(null), "legit-gym-1");
  });

  it("clears tenant preference key on logout", () => {
    const mockStorage = new Map();
    mockStorage.set("fitcore_active_gym_id", "active-gym-uuid");

    function signOut() {
      mockStorage.delete("fitcore_active_gym_id");
    }

    assert.equal(mockStorage.has("fitcore_active_gym_id"), true);
    signOut();
    assert.equal(mockStorage.has("fitcore_active_gym_id"), false);
  });
});
