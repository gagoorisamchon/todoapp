import mongoose, { mongo, type ClientSession } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Todo } from "@/lib/models/Todo";
import { WeeklyPlan } from "@/lib/models/WeeklyPlan";
import { createTodo } from "@/lib/services/todos";
import { TX_OPTIONS } from "@/lib/services/tx";
import { createWeeklyPlan, deleteWeeklyPlan, updateWeeklyPlan } from "@/lib/services/weeklyPlans";
import { MON, MON2, SUN, orphanTodoCount, outOfRangeTodoCount, unwrap } from "./helpers/fixtures";

/*
 * Forced interleaving (AC9a/AC9b). Txn1 is opened by hand and left uncommitted after its guard write.
 * Txn2 runs through the real service: inside a transaction MongoDB does not block on a locked document,
 * it aborts txn2 with WriteConflict (TransientTransactionError) and withTransaction retries the callback.
 * We wait — by polling a spy's call count, not by sleeping — until txn2's callback has run at least twice
 * (= its first attempt hit the conflict) and check it has not settled. Then txn1 commits and txn2's next
 * retry sees txn1's committed state.
 */

function track<T>(promise: Promise<T>) {
  const state = { settled: false };
  void promise.finally(() => (state.settled = true)).catch(() => {});
  return state;
}

function isWriteConflict(err: unknown): boolean {
  return err instanceof mongo.MongoServerError && err.code === 112 && err.hasErrorLabel("TransientTransactionError");
}

const sessions: ClientSession[] = [];
async function openTxn(): Promise<ClientSession> {
  const session = await mongoose.startSession();
  sessions.push(session);
  session.startTransaction(TX_OPTIONS);
  return session;
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const s of sessions.splice(0)) {
    if (s.inTransaction()) await s.abortTransaction();
    await s.endSession();
  }
});

describe("concurrency (AC9a)", () => {
  it("todo create (txn1, plan A guard) vs delete A (txn2): txn2 conflicts, retries after commit, no orphans", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "A", startDate: MON }));

    // Txn1: the createTodo guard write + insert, left open.
    const s1 = await openTxn();
    const guard = await WeeklyPlan.updateOne(
      { _id: plan.id, startDate: { $lte: "2026-10-20" }, endDate: { $gte: "2026-10-20" } },
      { $inc: { rev: 1 } },
      { session: s1 },
    );
    expect(guard.matchedCount).toBe(1);
    const [todo] = await Todo.create([{ title: "t", date: "2026-10-20", weeklyPlanId: plan.id }], { session: s1 });

    // A raw delete attempt in its own transaction fails immediately with WriteConflict.
    const s2 = await openTxn();
    await Todo.updateMany({ weeklyPlanId: plan.id }, { $set: { weeklyPlanId: null } }, { session: s2 });
    const raw = await WeeklyPlan.deleteOne({ _id: plan.id }, { session: s2 }).then(
      () => null,
      (err: unknown) => err,
    );
    expect(isWriteConflict(raw)).toBe(true);
    await s2.abortTransaction();

    // The real service keeps retrying while txn1 holds the write.
    const attempts = vi.spyOn(Todo, "updateMany");
    const pending = deleteWeeklyPlan(plan.id);
    const state = track(pending);
    await vi.waitFor(() => expect(attempts.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 10_000 });
    expect(state.settled).toBe(false);

    await s1.commitTransaction();
    expect(await pending).toEqual({ ok: true, data: { id: plan.id } });

    expect(await WeeklyPlan.exists({ _id: plan.id })).toBeNull();
    const stored = await Todo.findById(todo._id).lean();
    expect(stored).not.toBeNull();
    expect(stored?.weeklyPlanId).toBeNull();
    expect(await orphanTodoCount()).toBe(0);
  });
});

describe("concurrency (AC9b)", () => {
  // Txn1 = the updateTodo R5 guard write on plan A + the todo's own update, left open.
  async function openTodoUpdate(planId: string, todoId: unknown, set: Record<string, unknown>) {
    const s1 = await openTxn();
    const date = set.date as string;
    const guard = await WeeklyPlan.updateOne(
      { _id: planId, startDate: { $lte: date }, endDate: { $gte: date } },
      { $inc: { rev: 1 } },
      { session: s1 },
    );
    expect(guard.matchedCount).toBe(1);
    await Todo.updateOne({ _id: todoId }, { $set: set }, { session: s1 });
    return s1;
  }

  async function runPlanMoveAgainst(s1: ClientSession, planId: string) {
    const attempts = vi.spyOn(WeeklyPlan, "updateOne");
    const pending = updateWeeklyPlan(planId, { startDate: MON2 });
    const state = track(pending);
    await vi.waitFor(() => expect(attempts.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 10_000 });
    expect(state.settled).toBe(false);
    await s1.commitTransaction();
    return pending;
  }

  it("linked todo date change (txn1) vs plan range change (txn2): txn1 commits, txn2 is rejected", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "A", startDate: MON }));
    const todo = unwrap(await createTodo({ title: "t", date: "2026-10-20", weeklyPlanId: plan.id }));

    const s1 = await openTodoUpdate(plan.id, todo.id, { date: SUN });
    const result = await runPlanMoveAgainst(s1, plan.id);

    expect(result).toMatchObject({ ok: false, error: "range_conflict" });
    if (!result.ok) expect(result.conflicts?.map((c) => c.id)).toEqual([todo.id]);
    expect((await WeeklyPlan.findById(plan.id).lean())?.startDate).toBe(MON);
    expect((await Todo.findById(todo.id).lean())?.date).toBe(SUN);
    expect(await outOfRangeTodoCount()).toBe(0);
  });

  it("write skew: link+date change of an unlinked todo (txn1) vs moving a plan with no todos (txn2): exactly one wins", async () => {
    const plan = unwrap(await createWeeklyPlan({ title: "A", startDate: MON }));
    const todo = unwrap(await createTodo({ title: "t", date: "2026-10-30" }));

    // Each alone is valid: txn2's snapshot sees no linked todos; txn1 is in A's current range.
    const s1 = await openTodoUpdate(plan.id, todo.id, { date: "2026-10-21", weeklyPlanId: plan.id });
    const result = await runPlanMoveAgainst(s1, plan.id);

    expect(result).toMatchObject({ ok: false, error: "range_conflict" });
    expect((await WeeklyPlan.findById(plan.id).lean())?.startDate).toBe(MON);
    const stored = await Todo.findById(todo.id).lean();
    expect(stored?.weeklyPlanId?.toString()).toBe(plan.id);
    expect(stored?.date).toBe("2026-10-21");
    expect(await outOfRangeTodoCount()).toBe(0);
  });
});
