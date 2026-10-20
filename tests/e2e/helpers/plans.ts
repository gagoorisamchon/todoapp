import { expect, type Locator, type Page } from "@playwright/test";
import { Goal } from "../../../lib/models/Goal";
import { WeeklyPlan } from "../../../lib/models/WeeklyPlan";
import { createGoal } from "../../../lib/services/goals";
import { connectE2EDb } from "./db";

export async function seedGoal(title: string, year: number) {
  await connectE2EDb();
  const result = await createGoal({ title, year });
  if (!result.ok) throw new Error(`seedGoal failed: ${result.error}`);
  return result.data;
}

export async function findPlan(id: string) {
  await connectE2EDb();
  return WeeklyPlan.findById(id).lean();
}

export async function findGoalByTitle(title: string) {
  await connectE2EDb();
  return Goal.findOne({ title }).lean();
}

/** Clicks until the dialog opens: list pages have no hydration marker, and a pre-hydration click does nothing. */
export async function openDialog(page: Page, trigger: Locator, name: string): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name });
  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  return dialog;
}

export const planRow = (page: Page, title: string) => page.getByTestId("weekly-plan-row").filter({ hasText: title });
export const goalRow = (page: Page, title: string) => page.getByTestId("goal-row").filter({ hasText: title });
