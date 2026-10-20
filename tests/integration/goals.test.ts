import { describe, expect, it } from "vitest";
import { Goal } from "@/lib/models/Goal";
import { WeeklyPlan } from "@/lib/models/WeeklyPlan";
import { getGoalsWithProgress } from "@/lib/queries";
import { createGoal, deleteGoal, updateGoal } from "@/lib/services/goals";
import { createTodo, updateTodoStatus } from "@/lib/services/todos";
import { createWeeklyPlan } from "@/lib/services/weeklyPlans";
import { MON, MON2, unwrap } from "./helpers/fixtures";

async function planWithTodos(goalId: string, startDate: string, total: number, done: number) {
  const plan = unwrap(await createWeeklyPlan({ title: `Plan ${startDate}`, startDate, goalId }));
  for (let i = 0; i < total; i++) {
    const todo = unwrap(await createTodo({ title: `t${i}`, date: startDate, weeklyPlanId: plan.id }));
    if (i < done) unwrap(await updateTodoStatus(todo.id, "done"));
  }
  return plan;
}

describe("goal service", () => {
  it("AC6c: changing year so a linked plan no longer matches returns year_conflict and leaves the goal unchanged (R8)", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON, goalId: goal.id }));
    const before = await Goal.findById(goal.id).lean();

    const result = await updateGoal(goal.id, { year: 2027, title: "Renamed" });
    expect(result).toMatchObject({ ok: false, error: "year_conflict" });
    if (!result.ok) expect(result.conflicts?.map((c) => c.id)).toEqual([plan.id]);
    expect(await Goal.findById(goal.id).lean()).toEqual(before);
  });

  it("updateGoal changes the year when no linked plan conflicts", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    const updated = unwrap(await updateGoal(goal.id, { year: 2027 }));
    expect(updated.year).toBe(2027);
  });

  it("AC8: deleting a goal keeps its plans with goalId null", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON, goalId: goal.id }));

    unwrap(await deleteGoal(goal.id));
    expect(await Goal.exists({ _id: goal.id })).toBeNull();
    const stored = await WeeklyPlan.findById(plan.id).lean();
    expect(stored).not.toBeNull();
    expect(stored?.goalId).toBeNull();
  });

  it("AC14: goal progress averages raw weekly values, then rounds once (R6)", async () => {
    const goal = unwrap(await createGoal({ title: "Goal", year: 2026 }));
    await planWithTodos(goal.id, MON, 8, 1); // 12.5
    await planWithTodos(goal.id, MON2, 0, 0); // 0
    expect((await getGoalsWithProgress({ id: goal.id }))[0].percent).toBe(6);

    await planWithTodos(goal.id, "2026-11-02", 3, 3); // 100
    expect((await getGoalsWithProgress({ id: goal.id }))[0].percent).toBe(38);
  });

  it("a goal with no linked plans has 0% progress", async () => {
    const goal = unwrap(await createGoal({ title: "Empty", year: 2026 }));
    const [row] = await getGoalsWithProgress({ id: goal.id });
    expect(row).toMatchObject({ percent: 0, plans: [] });
  });
});
