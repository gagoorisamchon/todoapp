import { expect, test } from "@playwright/test";
import { card, column, dragTo, findTodo, seedPlan, seedTodo } from "./helpers/board";
import { mondayOf, todayKey, yearOf } from "../../lib/date";
import { disconnectE2EDb, resetDb } from "./helpers/db";
import { findGoalByTitle, findPlan, goalRow, openDialog, planRow, seedGoal } from "./helpers/plans";

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await disconnectE2EDb();
});

test("AC6b: moving a plan so a linked todo falls outside shows the conflict list and saves nothing", async ({ page }) => {
  const plan = await seedPlan("10월 셋째 주", "2026-10-19");
  await seedTodo("범위 안 할 일", "2026-10-20", plan.id);
  // Snapshot after seeding: linking the todo bumps the plan's guard rev.
  const before = await findPlan(plan.id);

  await page.goto("/weekly");
  const row = planRow(page, "10월 셋째 주");
  const dialog = await openDialog(page, row.getByRole("button", { name: "10월 셋째 주 수정" }), "주간 계획 수정");
  await expect(dialog.getByText("월요일만 선택할 수 있습니다")).toBeVisible();
  await dialog.getByLabel("시작일").fill("2026-10-26");
  await dialog.getByRole("button", { name: "저장" }).click();

  await expect(dialog.getByText("이 기간 밖으로 벗어나는 할 일이 있어 저장할 수 없습니다")).toBeVisible();
  const list = dialog.getByTestId("conflict-list");
  await expect(list).toContainText("범위 안 할 일");
  await expect(list).toContainText("2026-10-20");
  await expect(dialog).toBeVisible();

  const saved = await findPlan(plan.id);
  expect(saved?.startDate).toBe("2026-10-19");
  expect(saved?.endDate).toBe("2026-10-25");
  expect(saved?.rev).toBe(before?.rev);
  expect(saved?.updatedAt.toISOString()).toBe(before?.updatedAt.toISOString());
});

test("AC11: a plan with no todos shows 0% on /weekly", async ({ page }) => {
  const plan = await seedPlan("빈 계획", "2026-10-19");
  await page.goto("/weekly");
  const progress = page.getByTestId(`plan-progress-${plan.id}`);
  await expect(progress).toContainText("0%");
  await expect(progress.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
});

test("AC12: weekly plans can be created, renamed and deleted from the list", async ({ page }) => {
  await page.goto("/weekly");
  await expect(page.getByText("아직 주간 계획이 없습니다")).toBeVisible();

  let dialog = await openDialog(page, page.getByRole("button", { name: "주간 계획 추가" }), "주간 계획 추가");
  await dialog.getByLabel("제목").fill("새 주간 계획");
  await dialog.getByLabel("시작일").fill("2026-10-19");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
  await expect(planRow(page, "새 주간 계획")).toContainText("2026-10-19 ~ 2026-10-25");
  await expect(planRow(page, "새 주간 계획")).toContainText("목표 없음");

  dialog = await openDialog(page, page.getByRole("button", { name: "새 주간 계획 수정" }), "주간 계획 수정");
  await dialog.getByLabel("제목").fill("바뀐 주간 계획");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
  await expect(planRow(page, "바뀐 주간 계획")).toBeVisible();
  await expect(planRow(page, "새 주간 계획")).toHaveCount(0);

  await page.getByRole("button", { name: "바뀐 주간 계획 삭제" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(planRow(page, "바뀐 주간 계획")).toHaveCount(0);
  await expect(page.getByText("아직 주간 계획이 없습니다")).toBeVisible();
});

test("AC12: a non-Monday start date is rejected with a field error", async ({ page }) => {
  await page.goto("/weekly");
  const dialog = await openDialog(page, page.getByRole("button", { name: "주간 계획 추가" }), "주간 계획 추가");
  await dialog.getByLabel("제목").fill("화요일 시작");
  await dialog.getByLabel("시작일").fill("2026-10-20");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByText("주간 계획은 월요일에 시작해야 합니다")).toBeVisible();
});

test("AC12: goals can be created, renamed and deleted from the list", async ({ page }) => {
  await page.goto("/goals");
  await expect(page.getByText("아직 목표가 없습니다")).toBeVisible();

  let dialog = await openDialog(page, page.getByRole("button", { name: "목표 추가" }), "목표 추가");
  await dialog.getByLabel("제목").fill("새 목표");
  await dialog.getByLabel("연도").fill("2026");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
  await expect(goalRow(page, "새 목표")).toContainText("2026년");
  expect((await findGoalByTitle("새 목표"))?.year).toBe(2026);

  dialog = await openDialog(page, page.getByRole("button", { name: "새 목표 수정" }), "목표 수정");
  await dialog.getByLabel("제목").fill("바뀐 목표");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
  await expect(goalRow(page, "바뀐 목표")).toBeVisible();
  await expect(goalRow(page, "새 목표")).toHaveCount(0);

  await page.getByRole("button", { name: "바뀐 목표 삭제" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(goalRow(page, "바뀐 목표")).toHaveCount(0);
  await expect(page.getByText("아직 목표가 없습니다")).toBeVisible();
});

test("AC13: malformed or missing ids on /weekly/[id] and /goals/[id] return 404", async ({ page }) => {
  for (const path of ["/weekly/not-an-id", "/weekly/0123456789abcdef01234567", "/goals/not-an-id", "/goals/0123456789abcdef01234567"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeVisible();
  }
});

test("AC20: dragging a card to 완료 updates the weekly % and the goal % on /weekly and /goals/[id] without a reload", async ({ page }) => {
  // The nav link opens /board's default view (today, Asia/Seoul), so seed around the real today.
  const today = todayKey();
  const monday = mondayOf(today);
  const goal = await seedGoal("올해 목표", yearOf(monday));
  const plan = await seedPlan("진행률 계획", monday, goal.id);
  const first = await seedTodo("끝낼 일", today, plan.id);
  await seedTodo("남은 일", today, plan.id);

  await page.goto(`/goals/${goal.id}`);
  await expect(page.getByTestId(`goal-progress-${goal.id}`)).toContainText("0%");
  await page.goto("/weekly");
  const progress = page.getByTestId(`plan-progress-${plan.id}`);
  await expect(progress).toContainText("0%");
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await nav.getByRole("link", { name: "보드", exact: true }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.locator('[id^="DndLiveRegion"]')).toBeAttached();
  await dragTo(page, card(page, "끝낼 일"), column(page, "done"));
  await expect(card(column(page, "done"), "끝낼 일")).toBeVisible();
  await expect.poll(async () => (await findTodo(first.id))?.status, { timeout: 3000 }).toBe("done");

  await nav.getByRole("link", { name: "주간", exact: true }).click();
  await expect(page).toHaveURL(/\/weekly$/);
  await expect(progress).toContainText("50%");

  await planRow(page, "진행률 계획").getByRole("link", { name: /올해 목표/ }).click();
  await expect(page).toHaveURL(new RegExp(`/goals/${goal.id}$`));
  await expect(page.getByTestId(`plan-progress-${plan.id}`)).toContainText("50%");
  // R6: one plan at 50% -> goal 50%.
  await expect(page.getByTestId(`goal-progress-${goal.id}`)).toContainText("50%");

  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
});

test("/weekly/[id] shows only that plan's todos with its progress", async ({ page }) => {
  const plan = await seedPlan("상세 계획", "2026-10-19");
  await seedTodo("계획 안 할 일", "2026-10-20", plan.id);
  await seedTodo("다른 할 일", "2026-10-20");

  await page.goto(`/weekly/${plan.id}`);
  await expect(page.getByRole("heading", { name: "상세 계획" })).toBeVisible();
  await expect(page.getByTestId(`plan-progress-${plan.id}`)).toContainText("0%");
  await expect(card(page, "계획 안 할 일")).toBeVisible();
  await expect(card(page, "다른 할 일")).toHaveCount(0);
});
