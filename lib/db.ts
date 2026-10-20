import mongoose from "mongoose";

// Apply schema validators to updateOne/findOneAndUpdate/updateMany as well (PLAN §2).
mongoose.set("runValidators", true);

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __mongoose?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose.__mongoose ??= {
  conn: null,
  promise: null,
});

/**
 * Connects once per process and reuses the connection (survives dev HMR via globalThis).
 * Env vars are checked here, not at import time, so `next build` works without Atlas.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  // Reuse a default connection opened elsewhere (e.g. the test setup) instead of opening a second one.
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI is not set. Copy .env.example to .env.local and fill in the Atlas connection string.",
      );
    }
    const dbName = process.env.MONGODB_DB || "todo_app_dev";
    cache.promise = mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
