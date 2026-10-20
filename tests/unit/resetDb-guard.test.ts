import { afterEach, describe, expect, it } from "vitest";
import { resetDb } from "../e2e/helpers/db";

describe("E2E resetDb guard", () => {
  const original = process.env.MONGODB_DB;
  afterEach(() => {
    process.env.MONGODB_DB = original;
  });

  it.each(["todo_app_dev", "todo_app_e2e_backup", ""])("refuses to reset %j", async (name) => {
    process.env.MONGODB_DB = name;
    await expect(resetDb()).rejects.toThrow(/_e2e/);
  });
});
