import { toGoalDTO, toWeeklyPlanDTO, type GoalDTO } from "../dto";
import { DomainError, type Result } from "../errors";
import { Goal } from "../models/Goal";
import { WeeklyPlan } from "../models/WeeklyPlan";
import { runTx } from "./tx";

export type GoalCreate = { title: string; year: number };
export type GoalPatch = { title?: string; year?: number };

export async function createGoal(input: GoalCreate): Promise<Result<GoalDTO>> {
  const goal = await Goal.create({ title: input.title, year: input.year });
  return { ok: true, data: toGoalDTO(goal.toObject()) };
}

export async function updateGoal(id: string, patch: GoalPatch): Promise<Result<GoalDTO>> {
  return runTx(async (session) => {
    const existing = await Goal.findById(id).session(session).lean();
    if (!existing) throw new DomainError("not_found");

    // Own $set + $inc rev in one write, so concurrent plan links (goal guard) conflict (PLAN §2.1).
    await Goal.updateOne({ _id: id }, { $set: patch, $inc: { rev: 1 } }, { session });

    // R8: linked plans must keep starting in the goal's year.
    if (patch.year !== undefined && patch.year !== existing.year) {
      const conflicts = await WeeklyPlan.find({
        goalId: id,
        $or: [{ startDate: { $lt: `${patch.year}-01-01` } }, { startDate: { $gt: `${patch.year}-12-31` } }],
      })
        .session(session)
        .sort({ startDate: 1 })
        .lean();
      if (conflicts.length > 0) throw new DomainError("year_conflict", { conflicts: conflicts.map(toWeeklyPlanDTO) });
    }

    const updated = await Goal.findById(id).session(session).lean();
    return toGoalDTO(updated!);
  });
}

// Plans survive with goalId null (PRD L46, PLAN §2.1).
export async function deleteGoal(id: string): Promise<Result<{ id: string }>> {
  return runTx(async (session) => {
    await WeeklyPlan.updateMany({ goalId: id }, { $set: { goalId: null } }, { session });
    const { deletedCount } = await Goal.deleteOne({ _id: id }, { session });
    if (deletedCount === 0) throw new DomainError("not_found");
    return { id };
  });
}

export async function getGoal(id: string): Promise<GoalDTO | null> {
  const goal = await Goal.findById(id).lean();
  return goal ? toGoalDTO(goal) : null;
}

export async function listGoals(filter: { year?: number } = {}): Promise<GoalDTO[]> {
  const goals = await Goal.find(filter.year === undefined ? {} : { year: filter.year })
    .sort({ year: 1, createdAt: 1 })
    .lean();
  return goals.map(toGoalDTO);
}
