import mongoose, { mongo, type ClientSession } from "mongoose";
import { DomainError, type Result } from "../errors";

export const TX_OPTIONS = {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
} as const;

/**
 * Runs `fn` in a transaction (PLAN §2.1). `fn` may be retried by the driver, so it must only do DB work
 * with `{ session }` — no revalidatePath or other side effects.
 */
export async function runTx<T>(fn: (session: ClientSession) => Promise<T>): Promise<Result<T>> {
  const session = await mongoose.startSession();
  try {
    let data: T | undefined;
    await session.withTransaction(async () => {
      data = await fn(session);
    }, TX_OPTIONS);
    return { ok: true, data: data as T };
  } catch (err) {
    if (err instanceof DomainError) return err.toResult();
    // Write conflicts that survived the driver's retries (PLAN §2.1).
    if (
      err instanceof mongo.MongoError &&
      (err.hasErrorLabel("TransientTransactionError") || err.hasErrorLabel("UnknownTransactionCommitResult"))
    ) {
      return { ok: false, error: "conflict" };
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
