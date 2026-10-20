import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { dateKey } from "./dateKey";

export const TODO_STATUSES = ["todo", "doing", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

const todoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    date: dateKey,
    status: { type: String, enum: TODO_STATUSES, default: "todo" },
    weeklyPlanId: { type: Schema.Types.ObjectId, ref: "WeeklyPlan", default: null },
  },
  { timestamps: true },
);

todoSchema.index({ weeklyPlanId: 1, status: 1 });
todoSchema.index({ date: 1 });

export type Todo = InferSchemaType<typeof todoSchema>;

export const Todo: Model<Todo> = (models.Todo as Model<Todo> | undefined) ?? model<Todo>("Todo", todoSchema);
