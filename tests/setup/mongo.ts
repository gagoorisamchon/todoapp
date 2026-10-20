import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, inject, vi } from "vitest";

// Registers the global `runValidators` setting, same as the app.
import "@/lib/db";
import "@/lib/models/Goal";
import "@/lib/models/WeeklyPlan";
import "@/lib/models/Todo";

// Server Actions call revalidatePath, which throws outside the Next runtime.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
}));

beforeAll(async () => {
  // Separate DB per worker so test files can run in parallel.
  const dbName = `test_${process.env.VITEST_POOL_ID ?? "0"}`;
  await mongoose.connect(inject("mongoUri"), { dbName });
  // Create collections + indexes up front so transactions never create them implicitly.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().then(() => m.createCollection())));
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
