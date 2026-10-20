import mongoose from "mongoose";

/** Connection for E2E setup/teardown. Refuses any database whose name does not end with `_e2e`. */
export async function connectE2EDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? "";
  if (!dbName.endsWith("_e2e")) {
    throw new Error(`Refusing to touch database "${dbName}": E2E databases must end with "_e2e".`);
  }
  if (!uri) throw new Error("MONGODB_URI is not set (.env.local).");
  if (mongoose.connection.readyState === 1) return mongoose;
  return mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
}

/** Empties every collection in the E2E database. Call before each test. */
export async function resetDb(): Promise<void> {
  const dbName = process.env.MONGODB_DB ?? "";
  if (!dbName.endsWith("_e2e")) {
    throw new Error(`Refusing to reset database "${dbName}": E2E databases must end with "_e2e".`);
  }
  const conn = await connectE2EDb();
  const collections = await conn.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function disconnectE2EDb(): Promise<void> {
  await mongoose.disconnect();
}
