import { describe, expect, it } from "vitest";
import { Todo } from "@/lib/models/Todo";
import { WeeklyPlan } from "@/lib/models/WeeklyPlan";
import { createTodo, deleteTodo, updateTodo, updateTodoStatus } from "@/lib/services/todos";
import { createWeeklyPlan } from "@/lib/services/weeklyPlans";
import { MON, MON2, SUN, expectFail, unwrap } from "./helpers/fixtures";

describe("todo service", () => {
  it("AC2: a new todo starts as todo", async () => {
    const todo = unwrap(await createTodo({ title: "Write tests", date: "2026-10-20" }));
    expect(todo.status).toBe("todo");
    expect(todo.weeklyPlanId).toBeNull();
    expect((await Todo.findById(todo.id).lean())?.status).toBe("todo");
  });

  it("AC2a: updating title, date and weeklyPlanId persists", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    const todo = unwrap(await createTodo({ title: "Old", date: "2026-10-01" }));

    const updated = unwrap(await updateTodo(todo.id, { title: "New", date: "2026-10-21", weeklyPlanId: plan.id }));
    expect(updated).toMatchObject({ title: "New", date: "2026-10-21", weeklyPlanId: plan.id });

    const stored = await Todo.findById(todo.id).lean();
    expect(stored).toMatchObject({ title: "New", date: "2026-10-21" });
    expect(stored?.weeklyPlanId?.toString()).toBe(plan.id);
  });

  it("AC6: creating a todo outside the plan range is rejected and writes nothing", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    const rev = (await WeeklyPlan.findById(plan.id).lean())?.rev;

    expectFail(await createTodo({ title: "Late", date: MON2, weeklyPlanId: plan.id }), "out_of_range");
    expect(await Todo.countDocuments()).toBe(0);
    expect((await WeeklyPlan.findById(plan.id).lean())?.rev).toBe(rev);
  });

  it("AC6: linking an existing todo to a plan that does not contain its date is rejected", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    const todo = unwrap(await createTodo({ title: "Late", date: MON2 }));

    expectFail(await updateTodo(todo.id, { weeklyPlanId: plan.id }), "out_of_range");
    const stored = await Todo.findById(todo.id).lean();
    expect(stored?.weeklyPlanId).toBeNull();
    expect(stored?.date).toBe(MON2);
  });

  it("AC6a: changing only the date of a linked todo outside the range is rejected (R5)", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "Week", startDate: MON }));
    const todo = unwrap(await createTodo({ title: "In", date: SUN, weeklyPlanId: plan.id }));

    expectFail(await updateTodo(todo.id, { date: MON2 }), "out_of_range");
    expect((await Todo.findById(todo.id).lean())?.date).toBe(SUN);
  });

  it("rejects a link to a missing plan as invalid_link", async () => {
    const missing = "0123456789abcdef01234567";
    expectFail(await createTodo({ title: "x", date: MON, weeklyPlanId: missing }), "invalid_link");
    expect(await Todo.countDocuments()).toBe(0);
  });

  it("updateTodoStatus and deleteTodo return not_found for missing todos", async () => {
    const missing = "0123456789abcdef01234567";
    expectFail(await updateTodoStatus(missing, "done"), "not_found");
    expectFail(await deleteTodo(missing), "not_found");
    expectFail(await updateTodo(missing, { title: "x" }), "not_found");
  });
});
