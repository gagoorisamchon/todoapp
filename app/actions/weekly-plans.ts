"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import type { WeeklyPlanDTO } from "@/lib/dto";
import { invalidInput, type Result } from "@/lib/errors";
import * as weeklyPlanService from "@/lib/services/weeklyPlans";
import { objectIdString, weeklyPlanInput, weeklyPlanUpdateInput } from "@/lib/validation";

// Thin wrappers: zod -> service -> revalidatePath after the service returns (PLAN 단계 3).
export async function createWeeklyPlan(input: unknown): Promise<Result<WeeklyPlanDTO>> {
  const parsed = weeklyPlanInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await weeklyPlanService.createWeeklyPlan(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateWeeklyPlan(input: unknown): Promise<Result<WeeklyPlanDTO>> {
  const parsed = weeklyPlanUpdateInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const { id, ...patch } = parsed.data;
  const result = await weeklyPlanService.updateWeeklyPlan(id, patch);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteWeeklyPlan(id: unknown): Promise<Result<{ id: string }>> {
  const parsed = objectIdString.safeParse(id);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await weeklyPlanService.deleteWeeklyPlan(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
