import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const goalSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    rev: { type: Number, default: 0 }, // guard writes (PLAN §2.1)
  },
  { timestamps: true },
);

goalSchema.index({ year: 1 });

export type Goal = InferSchemaType<typeof goalSchema>;

export const Goal: Model<Goal> = (models.Goal as Model<Goal> | undefined) ?? model<Goal>("Goal", goalSchema);
