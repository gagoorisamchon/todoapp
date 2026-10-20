import { expect, test } from "@playwright/test";
import { addDaysKey, mondayOf, todayKey, yearOf } from "../../lib/date";
import { card, column, dragTo, findTodo, seedPlan, seedTodo, setTodoStatus } from "./helpers/board";
import { disconnectE2EDb, resetDb } from "./helpers/db";
import { openDialog, seedGoal } from "./helpers/plans";

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await disconnectE2EDb();
});

async function seedWithStatus(title: string, date: string, planId: string | null, status: "todo" | "doing" | "done") {
  const todo = await seedTodo(title, date, planId);
  if (status !== "todo") await setTodoStatus(todo.id, status);
  return todo;
}

// The dashboard always shows the real today (Asia/Seoul), so the fixture is built around todayKey().
async function seedAC21() {
  const today = todayKey();
  const monday = mondayOf(today);
  const lastMonday = addDaysKey(monday, -7);
  const otherDay = today === monday ? addDaysKey(monday, 1) : monday; // in this week, not today
  const goal = await seedGoal("올해 목표", yearOf(monday));
  const planA = await seedPlan("계획 A", monday, goal.id);
  const planB = await seedPlan("계획 B", monday, goal.id);
  const last = await seedPlan("지난주 계획", lastMonday);

  // Today: todo 2 (a1, u1) / doing 1 / done 1. A = 1/3 -> 33%.
  await seedWithStatus("오늘 a1", today, planA.id, "todo");
  await seedWithStatus("오늘 a2", today, planA.id, "doing");
  await seedWithStatus("오늘 a3", today, planA.id, "done");
  // B = 1/2 -> 50%. Goal (R6) = (33.33 + 50) / 2 -> 42%.
  await seedWithStatus("B 끝", otherDay, planB.id, "done");
  await seedWithStatus("B 남음", otherDay, planB.id, "todo");
  // Unlinked: 3 (one of them today).
  await seedWithStatus("오늘 u1", today, null, "todo");
  await seedWithStatus("미연결 2", lastMonday, null, "done");
  await seedWithStatus("미연결 3", addDaysKey(lastMonday, 1), null, "todo");
  // Last week: 2 incomplete.
  await seedWithStatus("지난주 1", lastMonday, last.id, "todo");
  await seedWithStatus("지난주 2", addDaysKey(lastMonday, 1), last.id, "doing");
  await seedWithStatus("지난주 3", addDaysKey(lastMonday, 2), last.id, "done");
  return { goal, planA, planB, last };
}

test("AC21: the four cards show today's counts, weekly %, goal % and the attention numbers", async ({ page }) => {
  const { goal, planA, planB, last } = await seedAC21();
  await page.goto("/");

  const today = page.getByTestId("dashboard-today");
  await expect(today.getByTestId("today-count-todo")).toHaveText("2");
  await expect(today.getByTestId("today-count-doing")).toHaveText("1");
  await expect(today.getByTestId("today-count-done")).toHaveText("1");
  await expect(today.getByTestId("today-todo")).toHaveCount(4);

  const week = page.getByTestId("dashboard-week");
  await expect(week.getByTestId("dashboard-week-plan")).toHaveCount(2);
  await expect(week.getByTestId(`plan-progress-${planA.id}`)).toContainText("33%");
  await expect(week.getByTestId(`plan-progress-${planB.id}`)).toContainText("50%");

  const goals = page.getByTestId("dashboard-goals");
  await expect(goals.getByTestId("dashboard-goal")).toHaveCount(1);
  await expect(goals.getByTestId(`goal-progress-${goal.id}`)).toContainText("42%");
  await expect(goals.getByTestId(`goal-plan-count-${goal.id}`)).toHaveText("주간 계획 2개");

  const attention = page.getByTestId("dashboard-attention");
  await expect(attention.getByTestId("unlinked-count")).toHaveText("3");
  await expect(attention.getByTestId("lastweek-incomplete-count")).toHaveText("2");
  const lastRow = attention.getByTestId("lastweek-plan");
  await expect(lastRow).toContainText("지난주 계획");
  await expect(lastRow.getByRole("link", { name: /지난주 계획/ })).toHaveAttribute("href", `/weekly/${last.id}`);

  // Card links.
  await expect(today.getByRole("link", { name: "보드에서 보기" })).toHaveAttribute("href", "/board?view=day");
  await expect(week.getByRole("link", { name: "계획 A" })).toHaveAttribute("href", `/weekly/${planA.id}`);
  await expect(goals.getByRole("link", { name: "올해 목표" })).toHaveAttribute("href", `/goals/${goal.id}`);
  await expect(page.getByTestId("dashboard-empty")).toHaveCount(0);
});

test("AC21: carry-over from the attention card moves last week's unfinished todos", async ({ page }) => {
  const { planA } = await seedAC21();
  await page.goto("/");
  const attention = page.getByTestId("dashboard-attention");
  await expect(attention.getByTestId("lastweek-incomplete-count")).toHaveText("2");

  const dialog = await openDialog(page, attention.getByRole("button", { name: "미완료 이월" }), "미완료 이월");
  await dialog.getByTestId("carry-candidate").filter({ hasText: "계획 A" }).getByRole("radio").check();
  await dialog.getByRole("button", { name: "이월하기" }).click();
  await expect(dialog).toBeHidden();

  await expect(attention.getByTestId("lastweek-incomplete-count")).toHaveText("0");
  await expect(attention.getByTestId("lastweek-plan")).toHaveCount(0);
  // A: 1 done of 3 + 2 moved -> 1/5.
  await expect(page.getByTestId(`plan-progress-${planA.id}`)).toContainText("20%");
});

test("AC21: an empty database shows the 1년 목표 guide first", async ({ page }) => {
  await page.goto("/");
  const empty = page.getByTestId("dashboard-empty");
  await expect(empty.getByRole("heading", { name: "먼저 1년 목표를 만들어 보세요" })).toBeVisible();
  await expect(page.getByTestId("today-count-done")).toHaveText("0");
  await expect(page.getByTestId("unlinked-count")).toHaveText("0");
  await empty.getByRole("link", { name: "1년 목표 만들기" }).click();
  await expect(page).toHaveURL(/\/goals$/);
});

test("AC22: dragging today's todo to 완료 on the board updates the dashboard without a reload", async ({ page }) => {
  const today = todayKey();
  const plan = await seedPlan("이번 주 계획", mondayOf(today));
  const first = await seedTodo("끝낼 일", today, plan.id);
  await seedTodo("남은 일", today, plan.id);

  await page.goto("/");
  const done = page.getByTestId("today-count-done");
  const progress = page.getByTestId("dashboard-week").getByTestId(`plan-progress-${plan.id}`);
  await expect(done).toHaveText("0");
  await expect(progress).toContainText("0%");
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

  await page.getByTestId("dashboard-today").getByRole("link", { name: "보드에서 보기" }).click();
  await expect(page).toHaveURL(/\/board\?view=day$/);
  await expect(page.locator('[id^="DndLiveRegion"]')).toBeAttached();
  await dragTo(page, card(page, "끝낼 일"), column(page, "done"));
  await expect(card(column(page, "done"), "끝낼 일")).toBeVisible();
  await expect.poll(async () => (await findTodo(first.id))?.status, { timeout: 3000 }).toBe("done");

  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "대시보드", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(done).toHaveText("1");
  await expect(page.getByTestId("today-count-todo")).toHaveText("1");
  await expect(progress).toContainText("50%");

  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
});
