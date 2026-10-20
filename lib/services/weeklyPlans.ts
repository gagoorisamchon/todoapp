import type { ClientSession } from "mongoose";
import { isMonday, weekEnd, yearOf } from "../date";
import { toTodoDTO, toWeeklyPlanDTO, type WeeklyPlanDTO } from "../dto";
import { DomainError, type Result } from "../errors";
import { Goal } from "../models/Goal";
import { Todo } from "../models/Todo";
import { WeeklyPlan } from "../models/WeeklyPlan";
import { runTx } from "./tx";

// endDate is never accepted from callers; it is derived from startDate (R1).
export type WeeklyPlanCreate = { title: string; startDate: string; goalId?: string | null };
export type WeeklyPlanPatch = { title?: string; startDate?: string; goalId?: string | null };

function assertMonday(startDate: string) {
  if (!isMonday(startDate)) {
    throw new DomainError("invalid_input", { fieldErrors: { startDate: ["주간 계획은 월요일에 시작해야 합니다"] } });
  }
}

// R3 guard write: the goal must exist and match the plan's year (PLAN §2.1).
async function guardGoal(goalId: string, startDate: string, session: ClientSession) {
  const { matchedCount } = await Goal.updateOne({ _id: goalId, year: yearOf(startDate) }, { $inc: { rev: 1 } }, { session });
  if (matchedCount > 0) return;
  const exists = await Goal.exists({ _id: goalId }).session(session);
  if (!exists) throw new DomainError("invalid_link", { fieldErrors: { goalId: ["목표를 찾을 수 없습니다"] } });
  throw new DomainError("year_mismatch", { fieldErrors: { goalId: ["주간 계획과 같은 연도의 목표만 연결할 수 있습니다"] } });
}

export async function createWeeklyPlan(input: WeeklyPlanCreate): Promise<Result<WeeklyPlanDTO>> {
  return runTx(async (session) => {
    assertMonday(input.startDate);
    const goalId = input.goalId ?? null;
    if (goalId) await guardGoal(goalId, input.startDate, session);

    const [plan] = await WeeklyPlan.create(
      [{ title: input.title, startDate: input.startDate, endDate: weekEnd(input.startDate), goalId }],
      { session },
    );
    return toWeeklyPlanDTO(plan.toObject());
  });
}

export async function updateWeeklyPlan(id: string, patch: WeeklyPlanPatch): Promise<Result<WeeklyPlanDTO>> {
  return runTx(async (session) => {
    const existing = await WeeklyPlan.findById(id).session(session).lean();
    if (!existing) throw new DomainError("not_found");

    // Merge first, then validate the merged state (PLAN §2.1).
    const startDate = patch.startDate ?? existing.startDate;
    const endDate = weekEnd(startDate);
    const goalId = patch.goalId === undefined ? (existing.goalId?.toString() ?? null) : patch.goalId;
    assertMonday(startDate);

    // ① R3 goal guard.
    if (goalId) await guardGoal(goalId, startDate, session);

    // Own $set + $inc rev in one write: conflicts with concurrent todo guard writes on this plan.
    await WeeklyPlan.updateOne(
      { _id: id },
      {
        $set: { ...(patch.title !== undefined && { title: patch.title }), startDate, endDate, goalId },
        $inc: { rev: 1 },
      },
      { session },
    );

    // ② R4: linked todos must stay inside the new range.
    const conflicts = await Todo.find({
      weeklyPlanId: id,
      $or: [{ date: { $lt: startDate } }, { date: { $gt: endDate } }],
    })
      .session(session)
      .sort({ date: 1, createdAt: 1 })
      .lean();
    if (conflicts.length > 0) throw new DomainError("range_conflict", { conflicts: conflicts.map(toTodoDTO) });

    const updated = await WeeklyPlan.findById(id).session(session).lean();
    return toWeeklyPlanDTO(updated!);
  });
}

// Todos survive with weeklyPlanId null (PRD L46, PLAN §2.1).
export async function deleteWeeklyPlan(id: string): Promise<Result<{ id: string }>> {
  return runTx(async (session) => {
    await Todo.updateMany({ weeklyPlanId: id }, { $set: { weeklyPlanId: null } }, { session });
    const { deletedCount } = await WeeklyPlan.deleteOne({ _id: id }, { session });
    if (deletedCount === 0) throw new DomainError("not_found");
    return { id };
  });
}
