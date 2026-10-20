"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import type { GoalDTO } from "@/lib/dto";
import { invalidInput, type Result } from "@/lib/errors";
import * as goalService from "@/lib/services/goals";
import { goalInput, goalUpdateInput, objectIdString } from "@/lib/validation";

// Thin wrappers: zod -> service -> revalidatePath after the service returns (PLAN 단계 3).
export async function createGoal(input: unknown): Promise<Result<GoalDTO>> {
  const parsed = goalInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await goalService.createGoal(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateGoal(input: unknown): Promise<Result<GoalDTO>> {
  const parsed = goalUpdateInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const { id, ...patch } = parsed.data;
  const result = await goalService.updateGoal(id, patch);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteGoal(id: unknown): Promise<Result<{ id: string }>> {
  const parsed = objectIdString.safeParse(id);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await goalService.deleteGoal(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
