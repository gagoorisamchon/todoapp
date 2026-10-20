import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { dateKey } from "./dateKey";

const weeklyPlanSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    startDate: dateKey,
    endDate: dateKey,
    goalId: { type: Schema.Types.ObjectId, ref: "Goal", default: null },
    rev: { type: Number, default: 0 }, // guard writes (PLAN §2.1)
  },
  { timestamps: true },
);

weeklyPlanSchema.index({ goalId: 1 });
weeklyPlanSchema.index({ startDate: 1 });

export type WeeklyPlan = InferSchemaType<typeof weeklyPlanSchema>;

export const WeeklyPlan: Model<WeeklyPlan> =
  (models.WeeklyPlan as Model<WeeklyPlan> | undefined) ?? model<WeeklyPlan>("WeeklyPlan", weeklyPlanSchema);
