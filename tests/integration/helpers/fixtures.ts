import { expect } from "vitest";
import type { Result } from "@/lib/errors";
import { Todo } from "@/lib/models/Todo";
import { WeeklyPlan } from "@/lib/models/WeeklyPlan";

// 2026-10-19 is a Monday; MON2 is the following week.
export const MON = "2026-10-19";
export const SUN = "2026-10-25";
export const MON2 = "2026-10-26";

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result.data;
}

// Todos pointing at a missing plan.
export async function orphanTodoCount(): Promise<number> {
  const [row] = await Todo.aggregate<{ n: number }>([
    { $match: { weeklyPlanId: { $ne: null } } },
    { $lookup: { from: WeeklyPlan.collection.collectionName, localField: "weeklyPlanId", foreignField: "_id", as: "p" } },
    { $match: { p: { $size: 0 } } },
    { $count: "n" },
  ]);
  return row?.n ?? 0;
}

// Linked todos whose date is outside their plan's range (PRD L45).
export async function outOfRangeTodoCount(): Promise<number> {
  const [row] = await Todo.aggregate<{ n: number }>([
    { $match: { weeklyPlanId: { $ne: null } } },
    { $lookup: { from: WeeklyPlan.collection.collectionName, localField: "weeklyPlanId", foreignField: "_id", as: "p" } },
    { $unwind: "$p" },
    { $match: { $expr: { $or: [{ $lt: ["$date", "$p.startDate"] }, { $gt: ["$date", "$p.endDate"] }] } } },
    { $count: "n" },
  ]);
  return row?.n ?? 0;
}

export function expectFail<T>(result: Result<T>, error: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(error);
}
