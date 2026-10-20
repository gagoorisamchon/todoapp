import type { Types } from "mongoose";
import { addDaysKey, mondayOf, todayKey, weekEnd, yearOf } from "./date";
import { connectDB } from "./db";
import { toGoalDTO, toTodoDTO, toWeeklyPlanDTO, type GoalDTO, type TodoDTO, type WeeklyPlanDTO } from "./dto";
import { Goal } from "./models/Goal";
import { Todo, type TodoStatus } from "./models/Todo";
import { WeeklyPlan } from "./models/WeeklyPlan";
import { goalPercent, toPercent, weeklyRaw } from "./progress";

// Progress is computed on read, never stored (PLAN §1 R6).
export type WeeklyPlanWithProgress = WeeklyPlanDTO & { total: number; done: number; raw: number; percent: number };
export type GoalWithProgress = GoalDTO & { plans: WeeklyPlanWithProgress[]; percent: number };

type PlanFilter = { id?: string; startDate?: string };

function planQuery(filter: PlanFilter) {
  return {
    ...(filter.id !== undefined && { _id: filter.id }),
    ...(filter.startDate !== undefined && { startDate: filter.startDate }),
  };
}

// One aggregate for all plans (PLAN 단계 5).
async function withProgress(plans: WeeklyPlanDTO[], ids: Types.ObjectId[]): Promise<WeeklyPlanWithProgress[]> {
  const rows =
    ids.length === 0
      ? []
      : await Todo.aggregate<{ _id: Types.ObjectId; total: number; done: number }>([
          { $match: { weeklyPlanId: { $in: ids } } },
          {
            $group: {
              _id: "$weeklyPlanId",
              total: { $sum: 1 },
              done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
            },
          },
        ]);
  const counts = new Map(rows.map((r) => [r._id.toString(), r]));
  return plans.map((plan) => {
    const { total = 0, done = 0 } = counts.get(plan.id) ?? {};
    const raw = weeklyRaw({ total, done });
    return { ...plan, total, done, raw, percent: toPercent(raw) };
  });
}

export async function getWeeklyPlansWithProgress(filter: PlanFilter = {}): Promise<WeeklyPlanWithProgress[]> {
  await connectDB();
  const plans = await WeeklyPlan.find(planQuery(filter)).sort({ startDate: 1, createdAt: 1 }).lean();
  return withProgress(plans.map(toWeeklyPlanDTO), plans.map((p) => p._id));
}

// R6: mean of raw weekly values, plans with 0 todos count as 0, no plans -> 0.
export async function getGoalsWithProgress(filter: { year?: number; id?: string } = {}): Promise<GoalWithProgress[]> {
  await connectDB();
  const goals = await Goal.find({
    ...(filter.year !== undefined && { year: filter.year }),
    ...(filter.id !== undefined && { _id: filter.id }),
  })
    .sort({ year: 1, createdAt: 1 })
    .lean();
  const plans = await WeeklyPlan.find({ goalId: { $in: goals.map((g) => g._id) } })
    .sort({ startDate: 1, createdAt: 1 })
    .lean();
  const withPct = await withProgress(plans.map(toWeeklyPlanDTO), plans.map((p) => p._id));

  return goals.map((goal) => {
    const dto = toGoalDTO(goal);
    const linked = withPct.filter((p) => p.goalId === dto.id);
    return { ...dto, plans: linked, percent: goalPercent(linked.map((p) => p.raw)) };
  });
}

// R9: date asc, then createdAt asc.
export async function listTodos(
  filter: { date?: string; from?: string; to?: string; weeklyPlanId?: string | null } = {},
): Promise<TodoDTO[]> {
  await connectDB();
  const date =
    filter.date !== undefined
      ? filter.date
      : filter.from !== undefined || filter.to !== undefined
        ? { ...(filter.from !== undefined && { $gte: filter.from }), ...(filter.to !== undefined && { $lte: filter.to }) }
        : undefined;
  const todos = await Todo.find({
    ...(date !== undefined && { date }),
    ...(filter.weeklyPlanId !== undefined && { weeklyPlanId: filter.weeklyPlanId }),
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();
  return todos.map(toTodoDTO);
}

export async function getUnlinkedTodos(): Promise<TodoDTO[]> {
  return listTodos({ weeklyPlanId: null });
}

// /board views (PLAN 단계 6.3). `date` must already be a valid dateKey.
export type BoardView = "day" | "week" | "year";

export type BoardData =
  | { view: "day"; date: string; from: string; to: string; todos: TodoDTO[]; plans: WeeklyPlanWithProgress[] }
  | {
      view: "week";
      date: string;
      from: string;
      to: string;
      todos: TodoDTO[];
      plans: WeeklyPlanWithProgress[];
      weekPlans: WeeklyPlanWithProgress[];
    }
  | { view: "year"; date: string; year: number; goals: GoalWithProgress[] };

export async function getBoardData(view: BoardView, date: string): Promise<BoardData> {
  if (view === "year") {
    const year = yearOf(date);
    return { view, date, year, goals: await getGoalsWithProgress({ year }) };
  }
  // All plans are still passed so cards show their plan and the form can link any plan.
  const from = view === "day" ? date : mondayOf(date);
  const to = view === "day" ? date : weekEnd(from);
  const [todos, plans] = await Promise.all([
    view === "day" ? listTodos({ date }) : listTodos({ from, to }),
    getWeeklyPlansWithProgress(),
  ]);
  if (view === "day") return { view, date, from, to, todos, plans };
  return { view, date, from, to, todos, plans, weekPlans: plans.filter((p) => p.startDate === from) };
}

// Dashboard `/` (PLAN 단계 7). `today` must already be a valid dateKey (default: Asia/Seoul today, R10).
const DASHBOARD_TODAY_LIMIT = 5;

export type LastWeekPlan = { id: string; title: string; incomplete: number };
export type DashboardSummary = {
  today: string;
  todayCard: { counts: Record<TodoStatus, number>; todos: TodoDTO[] };
  week: { monday: string; plans: WeeklyPlanWithProgress[] };
  goals: { year: number; items: (GoalWithProgress & { planCount: number })[] };
  attention: { unlinkedCount: number; lastWeekIncomplete: number; lastWeekPlans: LastWeekPlan[] };
  isEmpty: boolean;
};

async function lastWeekPlans(startDate: string): Promise<LastWeekPlan[]> {
  const plans = await WeeklyPlan.find({ startDate }).sort({ createdAt: 1 }).lean();
  if (plans.length === 0) return [];
  const rows = await Todo.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { weeklyPlanId: { $in: plans.map((p) => p._id) }, status: { $in: ["todo", "doing"] } } },
    { $group: { _id: "$weeklyPlanId", n: { $sum: 1 } } },
  ]);
  const counts = new Map(rows.map((r) => [r._id.toString(), r.n]));
  return plans.map((p) => ({ id: p._id.toString(), title: p.title, incomplete: counts.get(p._id.toString()) ?? 0 }));
}

export async function getDashboardSummary(today: string = todayKey()): Promise<DashboardSummary> {
  await connectDB();
  const monday = mondayOf(today);
  const year = yearOf(today);
  const [statusRows, todayTodos, weekPlans, goals, unlinkedCount, lastWeek, anyGoal, anyPlan, anyTodo] =
    await Promise.all([
      Todo.aggregate<{ _id: TodoStatus; n: number }>([
        { $match: { date: today } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      // R9 within one date = createdAt asc.
      Todo.find({ date: today }).sort({ createdAt: 1 }).limit(DASHBOARD_TODAY_LIMIT).lean(),
      getWeeklyPlansWithProgress({ startDate: monday }),
      getGoalsWithProgress({ year }),
      Todo.countDocuments({ weeklyPlanId: null }),
      lastWeekPlans(addDaysKey(monday, -7)),
      Goal.exists({}),
      WeeklyPlan.exists({}),
      Todo.exists({}),
    ]);

  const counts: Record<TodoStatus, number> = { todo: 0, doing: 0, done: 0 };
  for (const row of statusRows) counts[row._id] = row.n;

  return {
    today,
    todayCard: { counts, todos: todayTodos.map(toTodoDTO) },
    week: { monday, plans: weekPlans },
    goals: { year, items: goals.map((g) => ({ ...g, planCount: g.plans.length })) },
    attention: {
      unlinkedCount,
      lastWeekIncomplete: lastWeek.reduce((sum, p) => sum + p.incomplete, 0),
      lastWeekPlans: lastWeek,
    },
    isEmpty: !anyGoal && !anyPlan && !anyTodo,
  };
}
