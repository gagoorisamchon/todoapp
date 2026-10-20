import { expect, type Locator, type Page } from "@playwright/test";
import { Todo, type TodoStatus } from "../../../lib/models/Todo";
import { createTodo, updateTodoStatus } from "../../../lib/services/todos";
import { createWeeklyPlan } from "../../../lib/services/weeklyPlans";
import { connectE2EDb } from "./db";

// Specs pin the board to a fixed day so they do not depend on the real "today" (default /board view, PLAN 단계 6).
export const SEED_DAY = "2026-10-20";

/** Opens /board (default: day view of SEED_DAY) and waits until React has hydrated (dnd-kit mounts its live region only on the client). */
export async function gotoBoard(page: Page, query = `view=day&date=${SEED_DAY}`): Promise<void> {
  await page.goto(`/board?${query}`);
  await expect(page.locator('[id^="DndLiveRegion"]')).toBeAttached();
}

export const column = (page: Page, status: "todo" | "doing" | "done") => page.getByTestId(`column-${status}`);
export const card = (scope: Page | Locator, title: string) => scope.getByTestId("todo-card").filter({ hasText: title });

/** Mouse drag with intermediate moves so the PointerSensor (distance 5px) activates. */
export async function dragTo(page: Page, source: Locator, target: Locator): Promise<void> {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("drag source or target is not visible");
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(80, to.height / 2), { steps: 15 });
  await page.mouse.up();
}

// Seeds go through the service layer so the same invariants apply (the plan UI arrives in 단계 5).
export async function seedPlan(title: string, startDate: string, goalId: string | null = null) {
  await connectE2EDb();
  const result = await createWeeklyPlan({ title, startDate, goalId });
  if (!result.ok) throw new Error(`seedPlan failed: ${result.error}`);
  return result.data;
}

export async function seedTodo(title: string, date: string, weeklyPlanId: string | null = null) {
  await connectE2EDb();
  const result = await createTodo({ title, date, weeklyPlanId });
  if (!result.ok) throw new Error(`seedTodo failed: ${result.error}`);
  return result.data;
}

export async function setTodoStatus(id: string, status: TodoStatus): Promise<void> {
  await connectE2EDb();
  const result = await updateTodoStatus(id, status);
  if (!result.ok) throw new Error(`setTodoStatus failed: ${result.error}`);
}

export async function findTodo(id: string) {
  await connectE2EDb();
  return Todo.findById(id).lean();
}

export async function findTodoByTitle(title: string) {
  await connectE2EDb();
  return Todo.findOne({ title }).lean();
}

export async function countTodos(): Promise<number> {
  await connectE2EDb();
  return Todo.countDocuments();
}
