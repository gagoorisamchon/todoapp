import { z } from "zod";
import { isMonday, isValidDateKey } from "./date";
import { TODO_STATUSES } from "./models/Todo";

// Client input schemas (PLAN §1). Unknown keys (e.g. endDate) are stripped by z.object.
export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "올바른 ID가 아닙니다");

export const dateKeyString = z
  .string({ error: "날짜를 입력하세요" })
  .refine(isValidDateKey, "올바른 날짜가 아닙니다");

const title = z
  .string({ error: "제목을 입력하세요" })
  .trim()
  .min(1, "제목을 입력하세요")
  .max(200, "제목은 200자 이하로 입력하세요");

const todoStatus = z.enum(TODO_STATUSES);

// R1: weeks start on Monday; endDate is derived server-side.
const mondayKey = dateKeyString.refine(isMonday, "주간 계획은 월요일에 시작해야 합니다");

export const todoCreateInput = z.object({
  title,
  date: dateKeyString,
  weeklyPlanId: objectIdString.nullish().transform((v) => v ?? null),
});

export const todoUpdateInput = z.object({
  id: objectIdString,
  title: title.optional(),
  date: dateKeyString.optional(),
  weeklyPlanId: objectIdString.nullable().optional(),
  status: todoStatus.optional(),
});

export const todoStatusInput = z.object({ id: objectIdString, status: todoStatus });

export const weeklyPlanInput = z.object({
  title,
  startDate: mondayKey,
  goalId: objectIdString.nullable().optional(),
});

export const weeklyPlanUpdateInput = weeklyPlanInput.partial().extend({ id: objectIdString });

export const goalInput = z.object({
  title,
  year: z
    .number({ error: "연도를 입력하세요" })
    .int("연도는 정수로 입력하세요")
    .min(2000, "연도는 2000~2100 사이로 입력하세요")
    .max(2100, "연도는 2000~2100 사이로 입력하세요"),
});

export const goalUpdateInput = goalInput.partial().extend({ id: objectIdString });

// /board?view=…&date=… (PLAN 단계 6.3). "all" (every date) is the default view.
export const boardViewInput = z.enum(["all", "day", "week", "year"]);
// Missing or unknown ?view= falls back to the all view.
export const boardViewParam = boardViewInput.catch("all");

// R7 carry-over: move to an existing next-week plan or create one in the same transaction.
export const carryOverInput = z.object({
  sourcePlanId: objectIdString,
  target: z.union([z.object({ planId: objectIdString }), z.object({ create: z.object({ title }) })]),
});
