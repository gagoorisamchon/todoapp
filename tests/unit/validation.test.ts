import { describe, expect, it } from "vitest";
import {
  goalInput,
  goalUpdateInput,
  objectIdString,
  todoCreateInput,
  todoStatusInput,
  todoUpdateInput,
  weeklyPlanInput,
  weeklyPlanUpdateInput,
} from "@/lib/validation";

const oid = "507f1f77bcf86cd799439011";

function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));
}

describe("objectIdString", () => {
  it("accepts 24 hex, rejects others", () => {
    expect(objectIdString.safeParse(oid).success).toBe(true);
    expect(objectIdString.safeParse("507F1F77BCF86CD799439011").success).toBe(true);
    expect(objectIdString.safeParse("xyz").success).toBe(false);
    expect(objectIdString.safeParse(oid + "0").success).toBe(false);
  });
});

describe("todoCreateInput", () => {
  it("trims title and normalizes missing weeklyPlanId to null", () => {
    const r = todoCreateInput.parse({ title: "  hi  ", date: "2026-10-20" });
    expect(r).toEqual({ title: "hi", date: "2026-10-20", weeklyPlanId: null });
  });

  it("keeps a valid weeklyPlanId and null", () => {
    expect(todoCreateInput.parse({ title: "a", date: "2026-10-20", weeklyPlanId: oid }).weeklyPlanId).toBe(oid);
    expect(todoCreateInput.parse({ title: "a", date: "2026-10-20", weeklyPlanId: null }).weeklyPlanId).toBeNull();
  });

  it("rejects missing title/date with field errors", () => {
    const r = todoCreateInput.safeParse({});
    expect(r.success).toBe(false);
    const errs = fieldErrors(r);
    expect(errs.title).toBeDefined();
    expect(errs.date).toBeDefined();
  });

  it("rejects whitespace-only and too-long titles", () => {
    const ws = todoCreateInput.safeParse({ title: "   ", date: "2026-10-20" });
    expect(ws.success).toBe(false);
    expect(fieldErrors(ws).title).toBe("제목을 입력하세요");
    expect(todoCreateInput.safeParse({ title: "a".repeat(201), date: "2026-10-20" }).success).toBe(false);
  });

  it("rejects bad ObjectId and impossible dates", () => {
    expect(todoCreateInput.safeParse({ title: "a", date: "2026-10-20", weeklyPlanId: "nope" }).success).toBe(false);
    const r = todoCreateInput.safeParse({ title: "a", date: "2026-02-30" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r).date).toBe("올바른 날짜가 아닙니다");
  });
});

describe("todoUpdateInput / todoStatusInput", () => {
  it("requires id; other fields optional", () => {
    expect(todoUpdateInput.safeParse({}).success).toBe(false);
    expect(todoUpdateInput.parse({ id: oid })).toEqual({ id: oid });
    expect(todoUpdateInput.parse({ id: oid, weeklyPlanId: null, status: "done" })).toEqual({
      id: oid,
      weeklyPlanId: null,
      status: "done",
    });
  });

  it("rejects invalid status and blank title", () => {
    expect(todoUpdateInput.safeParse({ id: oid, status: "x" }).success).toBe(false);
    expect(todoUpdateInput.safeParse({ id: oid, title: " " }).success).toBe(false);
    expect(todoStatusInput.safeParse({ id: oid, status: "doing" }).success).toBe(true);
    expect(todoStatusInput.safeParse({ id: oid, status: "nope" }).success).toBe(false);
    expect(todoStatusInput.safeParse({ id: "bad", status: "todo" }).success).toBe(false);
  });
});

describe("weeklyPlanInput (R1)", () => {
  it("accepts a Monday and strips endDate", () => {
    const r = weeklyPlanInput.parse({ title: "w", startDate: "2026-10-19", endDate: "2030-01-01" });
    expect(r).toEqual({ title: "w", startDate: "2026-10-19" });
    expect("endDate" in r).toBe(false);
  });

  it("accepts goalId as objectId or null", () => {
    expect(weeklyPlanInput.parse({ title: "w", startDate: "2026-10-19", goalId: oid }).goalId).toBe(oid);
    expect(weeklyPlanInput.parse({ title: "w", startDate: "2026-10-19", goalId: null }).goalId).toBeNull();
    expect(weeklyPlanInput.safeParse({ title: "w", startDate: "2026-10-19", goalId: "x" }).success).toBe(false);
  });

  it("rejects non-Monday start", () => {
    const r = weeklyPlanInput.safeParse({ title: "w", startDate: "2026-10-20" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r).startDate).toBe("주간 계획은 월요일에 시작해야 합니다");
  });

  it("rejects 2026-02-30 and missing fields", () => {
    expect(weeklyPlanInput.safeParse({ title: "w", startDate: "2026-02-30" }).success).toBe(false);
    const r = weeklyPlanInput.safeParse({});
    expect(fieldErrors(r).title).toBeDefined();
    expect(fieldErrors(r).startDate).toBeDefined();
  });
});

describe("weeklyPlanUpdateInput", () => {
  it("is id + partial, still strips endDate and checks Monday", () => {
    expect(weeklyPlanUpdateInput.parse({ id: oid, endDate: "2030-01-01" })).toEqual({ id: oid });
    expect(weeklyPlanUpdateInput.safeParse({ id: oid, startDate: "2026-10-20" }).success).toBe(false);
    expect(weeklyPlanUpdateInput.safeParse({ id: oid, startDate: "2026-10-19", title: "x" }).success).toBe(true);
    expect(weeklyPlanUpdateInput.safeParse({ title: "x" }).success).toBe(false);
  });
});

describe("goalInput / goalUpdateInput", () => {
  it("validates title and year range", () => {
    expect(goalInput.parse({ title: " g ", year: 2026 })).toEqual({ title: "g", year: 2026 });
    expect(goalInput.safeParse({ title: "g", year: 1999 }).success).toBe(false);
    expect(goalInput.safeParse({ title: "g", year: 2101 }).success).toBe(false);
    expect(goalInput.safeParse({ title: "g", year: 2026.5 }).success).toBe(false);
    expect(goalInput.safeParse({ title: " ", year: 2026 }).success).toBe(false);
    expect(fieldErrors(goalInput.safeParse({})).title).toBeDefined();
  });

  it("update is id + partial", () => {
    expect(goalUpdateInput.parse({ id: oid, year: 2027 })).toEqual({ id: oid, year: 2027 });
    expect(goalUpdateInput.safeParse({ year: 2027 }).success).toBe(false);
  });
});
