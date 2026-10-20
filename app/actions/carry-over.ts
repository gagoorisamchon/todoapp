"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { invalidInput, type Result } from "@/lib/errors";
import * as carryOverService from "@/lib/services/carryOver";
import { carryOverInput } from "@/lib/validation";

// Thin wrapper: zod -> service -> revalidatePath after the transaction (PLAN 단계 3, R7).
export async function carryOver(input: unknown): Promise<Result<carryOverService.CarryOverResult>> {
  const parsed = carryOverInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await carryOverService.carryOver(parsed.data.sourcePlanId, parsed.data.target);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
