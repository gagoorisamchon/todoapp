import type { Types } from "mongoose";
import type { TodoStatus } from "./models/Todo";

// Plain, serializable shapes for Client Components (PLAN §6: no ObjectId across the boundary).
export type TodoDTO = {
  id: string;
  title: string;
  date: string;
  status: TodoStatus;
  weeklyPlanId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyPlanDTO = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoalDTO = {
  id: string;
  title: string;
  year: number;
  createdAt: string;
  updatedAt: string;
};

type Base = { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
type Ref = Types.ObjectId | null | undefined;

const refToString = (ref: Ref): string | null => (ref ? ref.toString() : null);

export function toTodoDTO(doc: Base & { title: string; date: string; status?: TodoStatus | null; weeklyPlanId?: Ref }): TodoDTO {
  return {
    id: doc._id.toString(),
    title: doc.title,
    date: doc.date,
    status: doc.status ?? "todo",
    weeklyPlanId: refToString(doc.weeklyPlanId),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toWeeklyPlanDTO(doc: Base & { title: string; startDate: string; endDate: string; goalId?: Ref }): WeeklyPlanDTO {
  return {
    id: doc._id.toString(),
    title: doc.title,
    startDate: doc.startDate,
    endDate: doc.endDate,
    goalId: refToString(doc.goalId),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toGoalDTO(doc: Base & { title: string; year: number }): GoalDTO {
  return {
    id: doc._id.toString(),
    title: doc.title,
    year: doc.year,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
