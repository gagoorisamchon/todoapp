import type { ClientSession } from "mongoose";
import { toTodoDTO, type TodoDTO } from "../dto";
import { DomainError, type Result } from "../errors";
import { Todo, type TodoStatus } from "../models/Todo";
import { WeeklyPlan } from "../models/WeeklyPlan";
import { runTx } from "./tx";

export type TodoCreate = { title: string; date: string; weeklyPlanId?: string | null };
export type TodoPatch = { title?: string; date?: string; weeklyPlanId?: string | null; status?: TodoStatus };

// PRD L45 guard write: the plan must exist and contain `date` (PLAN §2.1).
async function guardPlan(planId: string, date: string, session: ClientSession) {
  const { matchedCount } = await WeeklyPlan.updateOne(
    { _id: planId, startDate: { $lte: date }, endDate: { $gte: date } },
    { $inc: { rev: 1 } },
    { session },
  );
  if (matchedCount > 0) return;
  const exists = await WeeklyPlan.exists({ _id: planId }).session(session);
  if (!exists) throw new DomainError("invalid_link", { fieldErrors: { weeklyPlanId: ["주간 계획을 찾을 수 없습니다"] } });
  throw new DomainError("out_of_range", { fieldErrors: { date: ["주간 계획 기간 밖의 날짜입니다"] } });
}

export async function createTodo(input: TodoCreate): Promise<Result<TodoDTO>> {
  return runTx(async (session) => {
    const weeklyPlanId = input.weeklyPlanId ?? null;
    if (weeklyPlanId) await guardPlan(weeklyPlanId, input.date, session);

    const [todo] = await Todo.create([{ title: input.title, date: input.date, status: "todo", weeklyPlanId }], {
      session,
    });
    return toTodoDTO(todo.toObject());
  });
}

export async function updateTodo(id: string, patch: TodoPatch): Promise<Result<TodoDTO>> {
  return runTx(async (session) => {
    const existing = await Todo.findById(id).session(session).lean();
    if (!existing) throw new DomainError("not_found");

    // R5: re-check the merged (date, plan) whenever either changes.
    const date = patch.date ?? existing.date;
    const prevPlanId = existing.weeklyPlanId?.toString() ?? null;
    const weeklyPlanId = patch.weeklyPlanId === undefined ? prevPlanId : patch.weeklyPlanId;
    if (weeklyPlanId && (date !== existing.date || weeklyPlanId !== prevPlanId)) {
      await guardPlan(weeklyPlanId, date, session);
    }

    await Todo.updateOne({ _id: id }, { $set: patch }, { session });
    const updated = await Todo.findById(id).session(session).lean();
    return toTodoDTO(updated!);
  });
}

// Status does not depend on other documents, so no transaction (PLAN §2.1).
export async function updateTodoStatus(id: string, status: TodoStatus): Promise<Result<TodoDTO>> {
  const updated = await Todo.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean();
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true, data: toTodoDTO(updated) };
}

export async function deleteTodo(id: string): Promise<Result<{ id: string }>> {
  const { deletedCount } = await Todo.deleteOne({ _id: id });
  if (deletedCount === 0) return { ok: false, error: "not_found" };
  return { ok: true, data: { id } };
}
