import { Types } from "mongoose";
import { addDaysKey, weekEnd, yearOf } from "../date";
import { toWeeklyPlanDTO, type WeeklyPlanDTO } from "../dto";
import { DomainError, type Result } from "../errors";
import { Goal } from "../models/Goal";
import { Todo } from "../models/Todo";
import { WeeklyPlan } from "../models/WeeklyPlan";
import { runTx } from "./tx";

// R7: only unfinished todos move; done todos stay with the source plan.
const INCOMPLETE = ["todo", "doing"] as const;

export type CarryOverCandidate = WeeklyPlanDTO & { sameGoal: boolean };
export type CarryOverCandidates = {
  source: WeeklyPlanDTO;
  nextStartDate: string;
  candidates: CarryOverCandidate[]; // same-goal plans first
  incompleteCount: number;
  // "다음 주 계획 만들기" links the source goal only when next week is still in the goal's year.
  createGoalId: string | null;
  yearBoundary: boolean; // source has a goal but next week is in another year
};

export type CarryOverTarget = { planId: string } | { create: { title: string } };
export type CarryOverResult = { moved: number; plan: WeeklyPlanDTO; created: boolean };

export async function getCarryOverCandidates(sourcePlanId: string): Promise<CarryOverCandidates | null> {
  const source = await WeeklyPlan.findById(sourcePlanId).lean();
  if (!source) return null;
  const nextStartDate = addDaysKey(source.startDate, 7);
  const sourceGoalId = source.goalId?.toString() ?? null;

  const [plans, incompleteCount, goal] = await Promise.all([
    WeeklyPlan.find({ startDate: nextStartDate }).sort({ createdAt: 1 }).lean(),
    Todo.countDocuments({ weeklyPlanId: source._id, status: { $in: INCOMPLETE } }),
    sourceGoalId ? Goal.findById(sourceGoalId).lean() : null,
  ]);

  const candidates = plans
    .map((p) => {
      const dto = toWeeklyPlanDTO(p);
      return { ...dto, sameGoal: sourceGoalId !== null && dto.goalId === sourceGoalId };
    })
    // Stable sort keeps createdAt order inside each group.
    .sort((a, b) => Number(b.sameGoal) - Number(a.sameGoal));

  const linkable = goal !== null && goal.year === yearOf(nextStartDate);
  return {
    source: toWeeklyPlanDTO(source),
    nextStartDate,
    candidates,
    incompleteCount,
    createGoalId: linkable ? sourceGoalId : null,
    yearBoundary: goal !== null && !linkable,
  };
}

/**
 * R7 carry-over in ONE transaction (PLAN §2.1): optional next-week plan creation, target guard write
 * covering the moved dates, and the todo move. Any failure leaves no new plan and no moved todo.
 */
export async function carryOver(sourcePlanId: string, target: CarryOverTarget): Promise<Result<CarryOverResult>> {
  return runTx(async (session) => {
    const source = await WeeklyPlan.findById(sourcePlanId).session(session).lean();
    if (!source) throw new DomainError("not_found");

    const todos = await Todo.find({ weeklyPlanId: source._id, status: { $in: INCOMPLETE } })
      .session(session)
      .sort({ date: 1, createdAt: 1 })
      .lean();
    if (todos.length === 0) {
      throw new DomainError("invalid_input", { fieldErrors: { _form: ["이월할 미완료 할 일이 없습니다"] } });
    }
    const moves = todos.map((t) => ({ id: t._id, date: addDaysKey(t.date, 7) }));
    const minDate = moves[0].date;
    const maxDate = moves[moves.length - 1].date;

    let targetId: string;
    const created = "create" in target;
    if ("create" in target) {
      const startDate = addDaysKey(source.startDate, 7);
      // Goal guard (R3, like createWeeklyPlan): link only if the goal still exists in next week's year.
      let goalId: string | null = null;
      if (source.goalId) {
        const { matchedCount } = await Goal.updateOne(
          { _id: source.goalId, year: yearOf(startDate) },
          { $inc: { rev: 1 } },
          { session },
        );
        if (matchedCount > 0) goalId = source.goalId.toString();
      }
      const [plan] = await WeeklyPlan.create(
        [{ title: target.create.title, startDate, endDate: weekEnd(startDate), goalId }],
        { session },
      );
      targetId = plan._id.toString();
    } else {
      if (target.planId === sourcePlanId) {
        throw new DomainError("invalid_input", { fieldErrors: { planId: ["같은 계획으로는 이월할 수 없습니다"] } });
      }
      targetId = target.planId;
    }

    // Target guard write: the plan must exist and contain every moved date (PLAN §2.1 이월 가드 조건).
    const { matchedCount } = await WeeklyPlan.updateOne(
      { _id: targetId, startDate: { $lte: minDate }, endDate: { $gte: maxDate } },
      { $inc: { rev: 1 } },
      { session },
    );
    if (matchedCount === 0) {
      const exists = await WeeklyPlan.exists({ _id: targetId }).session(session);
      if (!exists) throw new DomainError("invalid_link", { fieldErrors: { planId: ["주간 계획을 찾을 수 없습니다"] } });
      throw new DomainError("out_of_range", { fieldErrors: { planId: ["옮길 날짜가 이 계획 기간 밖입니다"] } });
    }

    // Each todo gets its own date + 7, so one bulkWrite (a single updateMany cannot add days per document).
    const moved = await Todo.bulkWrite(
      moves.map(({ id, date }) => ({
        updateOne: {
          filter: { _id: id, weeklyPlanId: source._id, status: { $in: [...INCOMPLETE] } },
          update: { $set: { date, weeklyPlanId: new Types.ObjectId(targetId) } },
        },
      })),
      { session },
    );
    if (moved.matchedCount !== moves.length) throw new DomainError("conflict");

    const plan = await WeeklyPlan.findById(targetId).session(session).lean();
    return { moved: moves.length, plan: toWeeklyPlanDTO(plan!), created };
  });
}
