import { describe, expect, it, vi } from "vitest";
import { Todo } from "@/lib/models/Todo";
import { WeeklyPlan } from "@/lib/models/WeeklyPlan";
import { createGoal } from "@/lib/services/goals";
import { createTodo } from "@/lib/services/todos";
import { createWeeklyPlan, deleteWeeklyPlan, updateWeeklyPlan } from "@/lib/services/weeklyPlans";
import { MON, MON2, expectFail, unwrap } from "./helpers/fixtures";

describe("weekly plan service", () => {
  it("AC6b: moving startDate so a linked todo falls outside returns range_conflict and leaves the plan unchanged (R4)", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    const todo = unwrap(await createTodo({ title: "Tue", date: "2026-10-20", weeklyPlanId: plan.id }));
    const before = await WeeklyPlan.findById(plan.id).lean();

    const result = await updateWeeklyPlan(plan.id, { startDate: MON2, title: "Moved" });
    expect(result).toMatchObject({ ok: false, error: "range_conflict" });
    if (!result.ok) expect(result.conflicts?.map((c) => c.id)).toEqual([todo.id]);

    expect(await WeeklyPlan.findById(plan.id).lean()).toEqual(before);
  });

  it("AC6d: linking a plan to a goal of a different year is rejected (R3)", async () => {
    const goal = unwrap(await createGoal({ title: "2027", year: 2027 }));
    expectFail(await createWeeklyPlan({ title: "Week", startDate: MON, goalId: goal.id }), "year_mismatch");
    expect(await WeeklyPlan.countDocuments()).toBe(0);

    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    expectFail(await updateWeeklyPlan(plan.id, { goalId: goal.id }), "year_mismatch");
    expect((await WeeklyPlan.findById(plan.id).lean())?.goalId).toBeNull();
  });

  it("AC6e: moving a goal-linked plan's startDate into another year is rejected (R3)", async () => {
    const goal = unwrap(await createGoal({ title: "2026", year: 2026 }));
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: "2026-12-28", goalId: goal.id }));

    expectFail(await updateWeeklyPlan(plan.id, { startDate: "2027-01-04" }), "year_mismatch");
    expect((await WeeklyPlan.findById(plan.id).lean())?.startDate).toBe("2026-12-28");
  });

  it("AC6f: a non-Monday startDate is rejected and a client-sent endDate is ignored (R1)", async () => {
    expectFail(await createWeeklyPlan({ title: "Tue", startDate: "2026-10-20" }), "invalid_input");
    expect(await WeeklyPlan.countDocuments()).toBe(0);

    const input = { title: "Week", startDate: MON, endDate: "2026-12-31" };
    const plan = unwrap(await createWeeklyPlan(input));
    expect(plan.endDate).toBe("2026-10-25");
    expect((await WeeklyPlan.findById(plan.id).lean())?.endDate).toBe("2026-10-25");

    expectFail(await updateWeeklyPlan(plan.id, { startDate: "2026-10-27" }), "invalid_input");
    const moved = unwrap(await updateWeeklyPlan(plan.id, { startDate: MON2 }));
    expect(moved.endDate).toBe("2026-11-01");
  });

  it("AC7: deleting a plan keeps its todos with weeklyPlanId null", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    const a = unwrap(await createTodo({ title: "a", date: MON, weeklyPlanId: plan.id }));
    const b = unwrap(await createTodo({ title: "b", date: "2026-10-22", weeklyPlanId: plan.id }));

    unwrap(await deleteWeeklyPlan(plan.id));
    expect(await WeeklyPlan.exists({ _id: plan.id })).toBeNull();
    const todos = await Todo.find({ _id: { $in: [a.id, b.id] } }).lean();
    expect(todos).toHaveLength(2);
    expect(todos.every((t) => t.weeklyPlanId === null)).toBe(true);
  });

  it("AC9: a failure during delete rolls back the unlink", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    const todo = unwrap(await createTodo({ title: "a", date: MON, weeklyPlanId: plan.id }));

    const spy = vi.spyOn(WeeklyPlan, "deleteOne").mockImplementation(() => {
      throw new Error("injected failure");
    });
    try {
      await expect(deleteWeeklyPlan(plan.id)).rejects.toThrow("injected failure");
    } finally {
      spy.mockRestore();
    }

    expect(await WeeklyPlan.exists({ _id: plan.id })).not.toBeNull();
    expect((await Todo.findById(todo.id).lean())?.weeklyPlanId?.toString()).toBe(plan.id);
  });

  it("deleteWeeklyPlan returns not_found for a missing plan", async () => {
    expectFail(await deleteWeeklyPlan("0123456789abcdef01234567"), "not_found");
  });
});
