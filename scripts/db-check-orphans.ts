import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { Goal } from "../lib/models/Goal";
import { Todo } from "../lib/models/Todo";
import { WeeklyPlan } from "../lib/models/WeeklyPlan";

async function countOrphans(
  model: mongoose.Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  field: string,
  parentCollection: string,
): Promise<number> {
  const [row] = await model.aggregate<{ n: number }>([
    { $match: { [field]: { $ne: null } } },
    { $lookup: { from: parentCollection, localField: field, foreignField: "_id", as: "parent" } },
    { $match: { parent: { $size: 0 } } },
    { $count: "n" },
  ]);
  return row?.n ?? 0;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Create .env.local from .env.example and add the Atlas connection string.");
    process.exit(1);
  }
  try {
    const conn = await connectDB();
    const todos = await countOrphans(Todo, "weeklyPlanId", WeeklyPlan.collection.collectionName);
    const plans = await countOrphans(WeeklyPlan, "goalId", Goal.collection.collectionName);
    console.log(`Database "${conn.connection.name}"`);
    console.log(`  todos -> missing weekly plan: ${todos}`);
    console.log(`  weekly plans -> missing goal: ${plans}`);
    if (todos + plans > 0) {
      console.error("Orphan references found.");
      process.exitCode = 1;
    } else {
      console.log("OK — no orphan references");
    }
  } catch (err) {
    console.error("Orphan check failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
