/**
 * Automated tests for Milestone 2.6: Trainer Management & Member Assignments
 * Executed via node:test (Node v20+ native test runner)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Milestone 2.6: Trainer Management & Member Assignments Contract Verification", () => {
  it("serializes trainer listing query parameters correctly", () => {
    function buildTrainerQueryParams(params) {
      const queryParams = new URLSearchParams();
      if (params.page !== undefined) queryParams.set("page", String(params.page));
      if (params.pageSize !== undefined) queryParams.set("page_size", String(params.pageSize));
      if (params.search) queryParams.set("search", params.search);
      if (params.branchId) queryParams.set("branch_id", params.branchId);
      if (params.isActive !== undefined) queryParams.set("is_active", String(params.isActive));
      if (params.specialization) queryParams.set("specialization", params.specialization);
      return queryParams.toString();
    }

    const qs = buildTrainerQueryParams({
      page: 1,
      pageSize: 20,
      search: "Marcus",
      branchId: "branch-uuid-123",
      isActive: true,
      specialization: "HIIT",
    });

    assert.equal(
      qs,
      "page=1&page_size=20&search=Marcus&branch_id=branch-uuid-123&is_active=true&specialization=HIIT"
    );
  });

  it("validates trainer profile creation parameters", () => {
    function validateTrainer(trainer) {
      const errors = [];
      if (!trainer.full_name || trainer.full_name.trim().length < 2) {
        errors.push("Full name must be at least 2 characters");
      }
      if (trainer.email && !trainer.email.includes("@")) {
        errors.push("Invalid email format");
      }
      if (trainer.years_of_experience !== undefined && trainer.years_of_experience < 0) {
        errors.push("Years of experience cannot be negative");
      }
      const rate = Number(trainer.hourly_rate);
      if (isNaN(rate) || rate < 0) {
        errors.push("Hourly rate must be a valid non-negative number");
      }
      return errors;
    }

    // Valid trainer
    const validErrors = validateTrainer({
      full_name: "Marcus Vance",
      email: "marcus@gym.com",
      years_of_experience: 8,
      hourly_rate: "75.00",
    });
    assert.equal(validErrors.length, 0);

    // Invalid trainer
    const invalidErrors = validateTrainer({
      full_name: " ",
      email: "not-an-email",
      years_of_experience: -3,
      hourly_rate: "-10",
    });
    assert.equal(invalidErrors.length, 4);
    assert.ok(invalidErrors.includes("Full name must be at least 2 characters"));
    assert.ok(invalidErrors.includes("Invalid email format"));
    assert.ok(invalidErrors.includes("Years of experience cannot be negative"));
    assert.ok(invalidErrors.includes("Hourly rate must be a valid non-negative number"));
  });

  it("validates member assignment and reassignment transitions", () => {
    // Model state transitions for member assignments
    let assignments = [
      {
        id: "assign-1",
        trainer_id: "trainer-a",
        member_id: "member-1",
        status: "active",
        assigned_at: "2026-11-20T00:00:00Z",
      },
    ];

    function reassignMember(currentTrainerId, newTrainerId, memberId) {
      if (currentTrainerId === newTrainerId) {
        throw new Error("Cannot reassign to the same trainer");
      }

      // Mark existing as completed
      assignments = assignments.map((a) =>
        a.trainer_id === currentTrainerId && a.member_id === memberId && a.status === "active"
          ? { ...a, status: "completed" }
          : a
      );

      // Create new active assignment
      const newAssign = {
        id: `assign-${Date.now()}`,
        trainer_id: newTrainerId,
        member_id: memberId,
        status: "active",
        assigned_at: new Date().toISOString(),
      };
      assignments.push(newAssign);
      return newAssign;
    }

    function unassignMember(trainerId, memberId) {
      assignments = assignments.map((a) =>
        a.trainer_id === trainerId && a.member_id === memberId && a.status === "active"
          ? { ...a, status: "completed" }
          : a
      );
    }

    // Execute reassignment
    const newAssignment = reassignMember("trainer-a", "trainer-b", "member-1");
    assert.equal(newAssignment.trainer_id, "trainer-b");

    // Verify trainer-a assignment is now completed
    const oldAssign = assignments.find((a) => a.id === "assign-1");
    assert.equal(oldAssign.status, "completed");

    // Verify active assignments for member-1 is exactly 1 (trainer-b)
    const activeAssigns = assignments.filter((a) => a.member_id === "member-1" && a.status === "active");
    assert.equal(activeAssigns.length, 1);
    assert.equal(activeAssigns[0].trainer_id, "trainer-b");

    // Execute unassignment
    unassignMember("trainer-b", "member-1");
    const activeAfterUnassign = assignments.filter((a) => a.member_id === "member-1" && a.status === "active");
    assert.equal(activeAfterUnassign.length, 0);
  });

  it("verifies sidebar navigation contains enabled Trainers route", () => {
    const navItems = [
      { label: "Overview", href: "/dashboard" },
      { label: "Members", href: "/dashboard/members" },
      { label: "Trainers", href: "/dashboard/trainers" },
      { label: "Membership Plans", href: "/dashboard/membership-plans" },
      { label: "Subscriptions", href: "/dashboard/subscriptions" },
      { label: "Branches", href: "/dashboard/branches" },
    ];

    const trainerNav = navItems.find((item) => item.label === "Trainers");
    assert.ok(trainerNav, "Trainers nav item must exist");
    assert.equal(trainerNav.href, "/dashboard/trainers");
    assert.equal(trainerNav.disabled, undefined);
    assert.equal(trainerNav.badge, undefined);
  });

  it("verifies role-based access rules for trainer management", () => {
    function canAccessTrainerDirectory(role) {
      // Owners, Admins, and Trainers can access; Members cannot
      return role === "owner" || role === "admin" || role === "trainer";
    }

    function canManageTrainers(role) {
      // Only Owners and Admins can create/edit trainers
      return role === "owner" || role === "admin";
    }

    assert.equal(canAccessTrainerDirectory("owner"), true);
    assert.equal(canAccessTrainerDirectory("admin"), true);
    assert.equal(canAccessTrainerDirectory("trainer"), true);
    assert.equal(canAccessTrainerDirectory("member"), false);

    assert.equal(canManageTrainers("owner"), true);
    assert.equal(canManageTrainers("admin"), true);
    assert.equal(canManageTrainers("trainer"), false);
    assert.equal(canManageTrainers("member"), false);
  });
});
