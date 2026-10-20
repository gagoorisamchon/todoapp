import { describe, expect, it } from "vitest";
import { getBoardData } from "@/lib/queries";
import { createGoal } from "@/lib/services/goals";
import { createTodo, updateTodoStatus } from "@/lib/services/todos";
import { createWeeklyPlan } from "@/lib/services/weeklyPlans";
import { MON, MON2, unwrap } from "./helpers/fixtures";

// PLAN 단계 6.3 view definitions.
async function seed() {
  const goal = unwrap(await createGoal({ title: "2026 goal", year: 2026 }));
  const nextYear = unwrap(await createGoal({ title: "2027 goal", year: 2027 }));
  const week = unwrap(await createWeeklyPlan({ title: "This week", startDate: MON, goalId: goal.id }));
  const next = unwrap(await createWeeklyPlan({ title: "Next week", startDate: MON2, goalId: goal.id }));
  const tue = unwrap(await createTodo({ title: "tue", date: "2026-10-20", weeklyPlanId: week.id }));
  unwrap(await updateTodoStatus(tue.id, "done"));
  await createTodo({ title: "tue unlinked", date: "2026-10-20" });
  await createTodo({ title: "sun", date: "2026-10-25" });
  await createTodo({ title: "next mon", date: MON2, weeklyPlanId: next.id });
  return { goal, nextYear, week, next };
}

describe("getBoardData", () => {
  it("day: only todos on that date", async () => {
    await seed();
    const data = await getBoardData("day", "2026-10-20");
    if (data.view !== "day") throw new Error("expected day");
    expect(data.todos.map((t) => t.title)).toEqual(["tue", "tue unlinked"]);
    expect(data.from).toBe("2026-10-20");
    expect(data.to).toBe("2026-10-20");
    expect(data.plans).toHaveLength(2);
  });

  it("week: Monday..Sunday todos and the plans starting that Monday with progress", async () => {
    const { week } = await seed();
    const data = await getBoardData("week", "2026-10-22");
    if (data.view !== "week") throw new Error("expected week");
    expect(data.from).toBe(MON);
    expect(data.to).toBe("2026-10-25");
    expect(data.todos.map((t) => t.title)).toEqual(["tue", "tue unlinked", "sun"]);
    expect(data.weekPlans.map((p) => [p.id, p.percent])).toEqual([[week.id, 100]]);
  });

  it("year: goals of that year with linked plans and R6 progress", async () => {
    const { goal, week, next } = await seed();
    const data = await getBoardData("year", "2026-10-20");
    if (data.view !== "year") throw new Error("expected year");
    expect(data.year).toBe(2026);
    expect(data.goals.map((g) => g.id)).toEqual([goal.id]);
    expect(data.goals[0].plans.map((p) => p.id)).toEqual([week.id, next.id]);
    // (100 + 0) / 2
    expect(data.goals[0].percent).toBe(50);
  });
});
