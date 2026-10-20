import { describe, expect, it, vi } from "vitest";
import { carryOver as carryOverAction } from "@/app/actions/carry-over";
import { addDaysKey } from "@/lib/date";
import { Todo } from "@/lib/models/Todo";
import { WeeklyPlan } from "@/lib/models/WeeklyPlan";
import { getWeeklyPlansWithProgress } from "@/lib/queries";
import { carryOver, getCarryOverCandidates } from "@/lib/services/carryOver";
import { createGoal } from "@/lib/services/goals";
import { createTodo, updateTodoStatus } from "@/lib/services/todos";
import { createWeeklyPlan } from "@/lib/services/weeklyPlans";
import { expectFail, MON, MON2, orphanTodoCount, outOfRangeTodoCount, unwrap } from "./helpers/fixtures";

// Source plan with todo 2 · doing 1 · done 1 (AC17).
async function sourceWithTodos(startDate: string, goalId: string | null = null) {
  const plan = unwrap(await createWeeklyPlan({ title: "Source", startDate, goalId }));
  const day = (n: number) => addDaysKey(startDate, n);
  const todoA = unwrap(await createTodo({ title: "todo A", date: day(0), weeklyPlanId: plan.id }));
  const todoB = unwrap(await createTodo({ title: "todo B", date: day(3), weeklyPlanId: plan.id }));
  const doing = unwrap(await createTodo({ title: "doing", date: day(6), weeklyPlanId: plan.id }));
  unwrap(await updateTodoStatus(doing.id, "doing"));
  const done = unwrap(await createTodo({ title: "done", date: day(1), weeklyPlanId: plan.id }));
  unwrap(await updateTodoStatus(done.id, "done"));
  return { plan, todoA, todoB, doing, done };
}

const percentOf = async (id: string) => (await getWeeklyPlansWithProgress({ id }))[0].percent;

describe("carry-over (R7)", () => {
  it("AC17: todo 2 · doing 1 move to the chosen plan with date +7, done stays, both plans' progress is recalculated", async () => {
    const { plan, todoA, todoB, doing, done } = await sourceWithTodos(MON);
    const target = unwrap(await createWeeklyPlan({ title: "Next", startDate: MON2 }));
    const already = unwrap(await createTodo({ title: "already done", date: MON2, weeklyPlanId: target.id }));
    unwrap(await updateTodoStatus(already.id, "done"));
    expect(await percentOf(plan.id)).toBe(25);
    expect(await percentOf(target.id)).toBe(100);

    const result = unwrap(await carryOver(plan.id, { planId: target.id }));
    expect(result.moved).toBe(3);
    expect(result.created).toBe(false);
    expect(result.plan.id).toBe(target.id);

    const stored = async (id: string) => Todo.findById(id).lean();
    expect(await stored(todoA.id)).toMatchObject({ date: "2026-10-26", status: "todo" });
    expect(await stored(todoB.id)).toMatchObject({ date: "2026-10-29", status: "todo" });
    expect(await stored(doing.id)).toMatchObject({ date: "2026-11-01", status: "doing" });
    for (const id of [todoA.id, todoB.id, doing.id]) {
      expect((await stored(id))?.weeklyPlanId?.toString()).toBe(target.id);
    }
    const doneDoc = await stored(done.id);
    expect(doneDoc?.date).toBe("2026-10-20");
    expect(doneDoc?.weeklyPlanId?.toString()).toBe(plan.id);

    // Source now has only the done todo (1/1); target has 1 done of 4.
    expect(await percentOf(plan.id)).toBe(100);
    expect(await percentOf(target.id)).toBe(25);
    expect(await outOfRangeTodoCount()).toBe(0);
    expect(await orphanTodoCount()).toBe(0);
  });

  it("guards the target: a plan that does not contain the moved dates is rejected and nothing moves", async () => {
    const { plan, todoA } = await sourceWithTodos(MON);
    const farPlan = unwrap(await createWeeklyPlan({ title: "Far", startDate: "2026-11-02" }));
    const before = await WeeklyPlan.findById(farPlan.id).lean();

    expectFail(await carryOver(plan.id, { planId: farPlan.id }), "out_of_range");
    expectFail(await carryOver(plan.id, { planId: plan.id }), "invalid_input");
    expectFail(await carryOver(plan.id, { planId: "0123456789abcdef01234567" }), "invalid_link");
    expectFail(await carryOver("0123456789abcdef01234567", { planId: farPlan.id }), "not_found");
    expect(await WeeklyPlan.findById(farPlan.id).lean()).toEqual(before);
    expect((await Todo.findById(todoA.id).lean())?.weeklyPlanId?.toString()).toBe(plan.id);
  });

  it("rejects a source with no unfinished todos", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Empty", startDate: MON }));
    expectFail(await carryOver(plan.id, { create: { title: "Next" } }), "invalid_input");
    expect(await WeeklyPlan.countDocuments()).toBe(1);
  });

  it("AC17a: with no next-week plan, create links the source goal in the same year", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    const { plan } = await sourceWithTodos(MON, goal.id);

    const result = unwrap(await carryOver(plan.id, { create: { title: "Source (이월)" } }));
    expect(result.created).toBe(true);
    expect(result.moved).toBe(3);
    expect(result.plan).toMatchObject({ title: "Source (이월)", startDate: MON2, endDate: "2026-11-01", goalId: goal.id });
    expect(await Todo.countDocuments({ weeklyPlanId: result.plan.id })).toBe(3);
  });

  it("AC17a: at the year boundary (2026-12-28 week) the 2027-01-04 plan is created without a goal", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    const { plan, doing } = await sourceWithTodos("2026-12-28", goal.id);

    const candidates = await getCarryOverCandidates(plan.id);
    expect(candidates).toMatchObject({ nextStartDate: "2027-01-04", createGoalId: null, yearBoundary: true });

    const result = unwrap(await carryOver(plan.id, { create: { title: "Next year" } }));
    expect(result.plan).toMatchObject({ startDate: "2027-01-04", endDate: "2027-01-10", goalId: null });
    // 2027-01-03 (Sun of the source week) + 7.
    expect((await Todo.findById(doing.id).lean())?.date).toBe("2027-01-10");
  });

  it("AC17a: if the todo move throws, the transaction rolls back and no new plan remains", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    const { plan, todoA } = await sourceWithTodos(MON, goal.id);
    const before = await Todo.find().sort({ _id: 1 }).lean();

    const spy = vi.spyOn(Todo, "bulkWrite").mockRejectedValue(new Error("injected failure"));
    try {
      await expect(carryOver(plan.id, { create: { title: "Next" } })).rejects.toThrow("injected failure");
    } finally {
      spy.mockRestore();
    }
    expect(await WeeklyPlan.find({ startDate: MON2 }).lean()).toHaveLength(0);
    expect(await WeeklyPlan.countDocuments()).toBe(1);
    expect(await Todo.find().sort({ _id: 1 }).lean()).toEqual(before);
    expect((await Todo.findById(todoA.id).lean())?.weeklyPlanId?.toString()).toBe(plan.id);
  });

  it("AC17a: if the todo move only partly applies, the result is ok:false and no new plan remains", async () => {
    const { plan } = await sourceWithTodos(MON);
    const before = await Todo.find().sort({ _id: 1 }).lean();

    // Simulates a concurrent change: the move matches fewer todos than were read.
    const spy = vi.spyOn(Todo, "bulkWrite").mockResolvedValue({ matchedCount: 0 } as never);
    try {
      expectFail(await carryOver(plan.id, { create: { title: "Next" } }), "conflict");
    } finally {
      spy.mockRestore();
    }
    expect(await WeeklyPlan.find({ startDate: MON2 }).lean()).toHaveLength(0);
    expect(await Todo.find().sort({ _id: 1 }).lean()).toEqual(before);
  });

  it("AC17b: candidates are next-week plans with same-goal plans first, plus the unfinished count", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    const other = unwrap(await createGoal({ title: "Other", year: 2026 }));
    const { plan } = await sourceWithTodos(MON, goal.id);
    const noGoal = unwrap(await createWeeklyPlan({ title: "No goal", startDate: MON2 }));
    const otherGoal = unwrap(await createWeeklyPlan({ title: "Other goal", startDate: MON2, goalId: other.id }));
    const sameGoal = unwrap(await createWeeklyPlan({ title: "Same goal", startDate: MON2, goalId: goal.id }));
    await createWeeklyPlan({ title: "Two weeks later", startDate: "2026-11-02", goalId: goal.id });

    const result = await getCarryOverCandidates(plan.id);
    expect(result?.incompleteCount).toBe(3);
    expect(result?.nextStartDate).toBe(MON2);
    expect(result?.createGoalId).toBe(goal.id);
    expect(result?.yearBoundary).toBe(false);
    expect(result?.candidates.map((c) => [c.id, c.sameGoal])).toEqual([
      [sameGoal.id, true],
      [noGoal.id, false],
      [otherGoal.id, false],
    ]);

    // Picking a non-recommended candidate is allowed.
    const moved = unwrap(await carryOver(plan.id, { planId: noGoal.id }));
    expect(moved.plan.id).toBe(noGoal.id);
    expect(await Todo.countDocuments({ weeklyPlanId: noGoal.id })).toBe(3);
  });

  it("a source without a goal has no recommendation and creates an unlinked plan", async () => {
    const { plan } = await sourceWithTodos(MON);
    const result = await getCarryOverCandidates(plan.id);
    expect(result).toMatchObject({ candidates: [], createGoalId: null, yearBoundary: false, incompleteCount: 3 });
    expect(await getCarryOverCandidates("0123456789abcdef01234567")).toBeNull();
  });

  it("the action validates input with zod and returns the service result", async () => {
    const { plan } = await sourceWithTodos(MON);
    expectFail(await carryOverAction({ sourcePlanId: "bad", target: { planId: plan.id } }), "invalid_input");
    expectFail(await carryOverAction({ sourcePlanId: plan.id, target: { create: { title: " " } } }), "invalid_input");
    const result = unwrap(await carryOverAction({ sourcePlanId: plan.id, target: { create: { title: "Next" } } }));
    expect(result.moved).toBe(3);
  });
});
