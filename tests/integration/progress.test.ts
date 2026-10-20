import { beforeEach, describe, expect, it } from "vitest";
import type { WeeklyPlanDTO } from "@/lib/dto";
import { getUnlinkedTodos, getWeeklyPlansWithProgress } from "@/lib/queries";
import { createTodo, deleteTodo, updateTodo, updateTodoStatus } from "@/lib/services/todos";
import { createWeeklyPlan } from "@/lib/services/weeklyPlans";
import { MON, MON2, unwrap } from "./helpers/fixtures";

async function percentOf(planId: string): Promise<number> {
  const plans = await getWeeklyPlansWithProgress();
  return plans.find((p) => p.id === planId)!.percent;
}

// AC10: weekly progress after each kind of change (PRD L49).
describe("weekly progress (AC10)", () => {
  let a: WeeklyPlanDTO;
  let b: WeeklyPlanDTO;
  let doneId: string;
  let openId: string;

  // Plan A: 1 done + 1 todo = 50%. Plan B (same week): 1 todo = 0%.
  beforeEach(async () => {
    a = unwrap(await createWeeklyPlan({ title: "A", startDate: MON }));
    b = unwrap(await createWeeklyPlan({ title: "B", startDate: MON }));
    doneId = unwrap(await createTodo({ title: "done", date: MON, weeklyPlanId: a.id })).id;
    openId = unwrap(await createTodo({ title: "open", date: MON, weeklyPlanId: a.id })).id;
    unwrap(await updateTodoStatus(doneId, "done"));
    unwrap(await createTodo({ title: "b", date: MON, weeklyPlanId: b.id }));
    expect(await percentOf(a.id)).toBe(50);
  });

  it("after create", async () => {
    unwrap(await createTodo({ title: "new", date: MON, weeklyPlanId: a.id }));
    expect(await percentOf(a.id)).toBe(33);
  });

  it("after title update", async () => {
    unwrap(await updateTodo(openId, { title: "renamed" }));
    expect(await percentOf(a.id)).toBe(50);
  });

  it("after date update within the plan", async () => {
    unwrap(await updateTodo(doneId, { date: "2026-10-23" }));
    expect(await percentOf(a.id)).toBe(50);
  });

  it("after delete", async () => {
    unwrap(await deleteTodo(openId));
    expect(await percentOf(a.id)).toBe(100);
  });

  it("after status change", async () => {
    unwrap(await updateTodoStatus(openId, "done"));
    expect(await percentOf(a.id)).toBe(100);
  });

  it("after unlink (A drops)", async () => {
    unwrap(await updateTodo(doneId, { weeklyPlanId: null }));
    expect(await percentOf(a.id)).toBe(0);
    expect((await getUnlinkedTodos()).map((t) => t.id)).toEqual([doneId]);
  });

  it("after re-link A -> B (A drops, B rises)", async () => {
    unwrap(await updateTodo(doneId, { weeklyPlanId: b.id }));
    expect(await percentOf(a.id)).toBe(0);
    expect(await percentOf(b.id)).toBe(50);
  });

  it("a plan with no todos is 0%", async () => {
    const empty = unwrap(await createWeeklyPlan({ title: "Empty", startDate: MON2 }));
    const [row] = await getWeeklyPlansWithProgress({ startDate: MON2 });
    expect(row).toMatchObject({ id: empty.id, total: 0, done: 0, percent: 0 });
  });
});
