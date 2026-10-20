import { describe, expect, it } from "vitest";
import type { TodoStatus } from "@/lib/models/Todo";
import { getDashboardSummary } from "@/lib/queries";
import { createGoal } from "@/lib/services/goals";
import { createTodo, updateTodoStatus } from "@/lib/services/todos";
import { createWeeklyPlan } from "@/lib/services/weeklyPlans";
import { MON, unwrap } from "./helpers/fixtures";

// 2026-10-21 is the Wednesday of the week starting MON (2026-10-19); last week starts 2026-10-12.
const TODAY = "2026-10-21";
const LAST_MON = "2026-10-12";

async function todo(title: string, date: string, weeklyPlanId: string | null, status: TodoStatus = "todo") {
  const created = unwrap(await createTodo({ title, date, weeklyPlanId }));
  if (status !== "todo") unwrap(await updateTodoStatus(created.id, status));
  return created;
}

// AC21 fixture: today todo 2 / doing 1 / done 1, 2 plans this week, 1 goal of 2026, 3 unlinked, 2 incomplete last week.
async function seed() {
  const goal = unwrap(await createGoal({ title: "2026 목표", year: 2026 }));
  await createGoal({ title: "2025 목표", year: 2025 });
  const planA = unwrap(await createWeeklyPlan({ title: "A", startDate: MON, goalId: goal.id }));
  const planB = unwrap(await createWeeklyPlan({ title: "B", startDate: MON, goalId: null }));
  const last = unwrap(await createWeeklyPlan({ title: "지난주", startDate: LAST_MON, goalId: goal.id }));
  const older = unwrap(await createWeeklyPlan({ title: "2주 전", startDate: "2026-10-05", goalId: null }));
  await createWeeklyPlan({ title: "다음 주", startDate: "2026-10-26", goalId: null });

  // A: 2/4 done -> 50%. Three of them are today's.
  await todo("a1", TODAY, planA.id);
  await todo("a2", TODAY, planA.id, "doing");
  await todo("a3", TODAY, planA.id, "done");
  await todo("a4", "2026-10-22", planA.id, "done");
  // B: 1/3 done -> 33%. None today.
  await todo("b1", "2026-10-20", planB.id, "done");
  await todo("b2", "2026-10-20", planB.id);
  await todo("b3", "2026-10-23", planB.id, "doing");
  // Unlinked: 3 in total, one of them today (todo).
  await todo("u1", TODAY, null);
  await todo("u2", "2026-10-01", null, "done");
  await todo("u3", "2025-12-31", null);
  // Last week: 2 incomplete (todo + doing), 1 done -> 33%.
  await todo("l1", "2026-10-13", last.id);
  await todo("l2", "2026-10-14", last.id, "doing");
  await todo("l3", "2026-10-15", last.id, "done");
  // Two weeks ago: incomplete, but not "last week".
  await todo("o1", "2026-10-06", older.id);
  return { goal, planA, planB, last };
}

describe("getDashboardSummary (AC21)", () => {
  it("returns the four card numbers for a fixed today", async () => {
    const { goal, planA, planB, last } = await seed();
    const s = await getDashboardSummary(TODAY);

    expect(s.today).toBe(TODAY);
    expect(s.isEmpty).toBe(false);

    // Today: a1 + u1 todo, a2 doing, a3 done; listed in R9 order.
    expect(s.todayCard.counts).toEqual({ todo: 2, doing: 1, done: 1 });
    expect(s.todayCard.todos.map((t) => t.title)).toEqual(["a1", "a2", "a3", "u1"]);

    // This week: plans starting MON only.
    expect(s.week.monday).toBe(MON);
    expect(s.week.plans.map((p) => [p.id, p.percent])).toEqual([
      [planA.id, 50],
      [planB.id, 33],
    ]);

    // Goals of 2026: R6 mean of raw values (50 + 33.33) / 2 = 41.67 -> 42; linked plans A and 지난주.
    expect(s.goals.year).toBe(2026);
    expect(s.goals.items.map((g) => [g.id, g.percent, g.planCount])).toEqual([[goal.id, 42, 2]]);

    expect(s.attention.unlinkedCount).toBe(3);
    expect(s.attention.lastWeekIncomplete).toBe(2);
    expect(s.attention.lastWeekPlans).toEqual([{ id: last.id, title: "지난주", incomplete: 2 }]);
  });

  it("lists at most 5 of today's todos but counts all of them", async () => {
    for (let i = 1; i <= 7; i++) await todo(`t${i}`, TODAY, null, i === 7 ? "done" : "todo");
    const s = await getDashboardSummary(TODAY);
    expect(s.todayCard.counts).toEqual({ todo: 6, doing: 0, done: 1 });
    expect(s.todayCard.todos.map((t) => t.title)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  it("isEmpty only when there are no goals, plans and todos at all", async () => {
    const empty = await getDashboardSummary(TODAY);
    expect(empty.isEmpty).toBe(true);
    expect(empty.todayCard.counts).toEqual({ todo: 0, doing: 0, done: 0 });
    expect(empty.week.plans).toEqual([]);
    expect(empty.goals.items).toEqual([]);
    expect(empty.attention).toEqual({ unlinkedCount: 0, lastWeekIncomplete: 0, lastWeekPlans: [] });

    // A goal of another year still makes the app non-empty.
    await createGoal({ title: "2030 목표", year: 2030 });
    expect((await getDashboardSummary(TODAY)).isEmpty).toBe(false);
  });
});
