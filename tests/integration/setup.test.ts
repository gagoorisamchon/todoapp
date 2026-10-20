import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Goal } from "@/lib/models/Goal";
import { WeeklyPlan } from "@/lib/models/WeeklyPlan";
import { Todo } from "@/lib/models/Todo";

describe("test infrastructure", () => {
  it("commits a Goal and a WeeklyPlan in one transaction on the in-memory replica set", async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(
        async () => {
          const [goal] = await Goal.create([{ title: "Read 12 books", year: 2026 }], { session });
          await WeeklyPlan.create(
            [{ title: "Week 1", startDate: "2026-01-05", endDate: "2026-01-11", goalId: goal._id }],
            { session },
          );
        },
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
      );
    } finally {
      await session.endSession();
    }

    const goal = await Goal.findOne({ title: "Read 12 books" }).lean();
    expect(goal).not.toBeNull();
    const plan = await WeeklyPlan.findOne({ goalId: goal!._id }).lean();
    expect(plan?.title).toBe("Week 1");
  });

  it("rolls back every write when the transaction callback throws", async () => {
    const session = await mongoose.startSession();
    try {
      await expect(
        session.withTransaction(async () => {
          await Goal.create([{ title: "Aborted", year: 2026 }], { session });
          throw new Error("abort");
        }),
      ).rejects.toThrow("abort");
    } finally {
      await session.endSession();
    }
    expect(await Goal.countDocuments()).toBe(0);
  });

  it("applies schema validators to updateOne (global runValidators)", async () => {
    const todo = await Todo.create({ title: "Write tests", date: "2026-10-20" });
    expect(todo.status).toBe("todo");
    expect(todo.weeklyPlanId).toBeNull();

    await expect(Todo.updateOne({ _id: todo._id }, { status: "bogus" })).rejects.toBeInstanceOf(
      mongoose.Error.ValidationError,
    );
    await expect(Todo.updateOne({ _id: todo._id }, { date: "2026/10/20" })).rejects.toBeInstanceOf(
      mongoose.Error.ValidationError,
    );

    const reloaded = await Todo.findById(todo._id).lean();
    expect(reloaded?.status).toBe("todo");
  });
});
