import { expect, test, type Page } from "@playwright/test";
import { todayKey } from "../../lib/date";
import { Todo } from "../../lib/models/Todo";
import { WeeklyPlan } from "../../lib/models/WeeklyPlan";
import { card, column, findTodo, findTodoByTitle, gotoBoard, seedPlan, seedTodo, setTodoStatus } from "./helpers/board";
import { connectE2EDb, disconnectE2EDb, resetDb } from "./helpers/db";
import { openDialog, seedGoal } from "./helpers/plans";

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await disconnectE2EDb();
});

async function plansStarting(startDate: string) {
  await connectE2EDb();
  return WeeklyPlan.find({ startDate }).lean();
}

const unlinkedSection = (page: Page) => page.getByTestId("unlinked-section");

test("AC15: a todo created without a plan appears in the 미연결 section and on no plan's board", async ({ page }) => {
  const planA = await seedPlan("A 계획", "2026-10-19");
  const planB = await seedPlan("B 계획", "2026-10-26");
  await seedTodo("A에 연결된 일", "2026-10-20", planA.id);

  await gotoBoard(page);
  await page.getByRole("button", { name: "할 일 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 추가" });
  // The day view prefills its date; no plan is chosen.
  await expect(dialog.getByLabel("날짜")).toHaveValue("2026-10-20");
  await dialog.getByLabel("제목").fill("계획 없는 일");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  const section = unlinkedSection(page);
  await expect(section.getByRole("heading", { name: /주간 계획 없음/ })).toBeVisible();
  await expect(section.getByTestId("unlinked-todo").filter({ hasText: "계획 없는 일" })).toBeVisible();
  await expect(section.getByTestId("unlinked-todo").filter({ hasText: "A에 연결된 일" })).toHaveCount(0);
  expect((await findTodoByTitle("계획 없는 일"))?.weeklyPlanId).toBeNull();

  for (const plan of [planA, planB]) {
    await page.goto(`/weekly/${plan.id}`);
    await expect(page.getByRole("heading", { name: plan.title })).toBeVisible();
    await expect(card(page, "계획 없는 일")).toHaveCount(0);
  }
  await page.goto(`/weekly/${planA.id}`);
  await expect(card(page, "A에 연결된 일")).toBeVisible();
});

test("AC16: day, week and year views show their defined content and survive a reload", async ({ page }) => {
  const goal = await seedGoal("2026 목표", 2026);
  await seedGoal("2027 목표", 2027);
  const thisWeek = await seedPlan("이번 주 계획", "2026-10-19", goal.id);
  const nextWeek = await seedPlan("다음 주 계획", "2026-10-26", goal.id);
  const tue = await seedTodo("화요일 일", "2026-10-20", thisWeek.id);
  await setTodoStatus(tue.id, "done");
  await seedTodo("수요일 일", "2026-10-21");
  await seedTodo("다음 주 일", "2026-10-27", nextWeek.id);

  // day
  await gotoBoard(page, "view=day&date=2026-10-20");
  const checkDay = async () => {
    await expect(page.getByTestId("view-range")).toHaveText("2026-10-20");
    await expect(card(column(page, "done"), "화요일 일")).toBeVisible();
    await expect(card(page, "수요일 일")).toHaveCount(0);
    await expect(card(page, "다음 주 일")).toHaveCount(0);
    await expect(page.getByTestId("week-plans")).toHaveCount(0);
  };
  await checkDay();
  await page.reload();
  await expect(page).toHaveURL(/\/board\?view=day&date=2026-10-20$/);
  await checkDay();

  // Next day via the arrow, then switch to the week tab (keeps the date).
  await page.getByRole("link", { name: "다음 날", exact: true }).click();
  await expect(page).toHaveURL(/view=day&date=2026-10-21$/);
  await expect(card(page, "수요일 일")).toBeVisible();
  await expect(unlinkedSection(page).getByTestId("unlinked-todo").filter({ hasText: "수요일 일" })).toBeVisible();
  await page.getByRole("navigation", { name: "보기 전환" }).getByRole("link", { name: "주간" }).click();
  await expect(page).toHaveURL(/view=week&date=2026-10-21$/);

  const checkWeek = async () => {
    await expect(page.getByTestId("view-range")).toHaveText("2026-10-19 ~ 2026-10-25");
    await expect(card(page, "화요일 일")).toBeVisible();
    await expect(card(page, "수요일 일")).toBeVisible();
    await expect(card(page, "다음 주 일")).toHaveCount(0);
    const plans = page.getByTestId("week-plans");
    await expect(plans.getByTestId("week-plan")).toHaveCount(1);
    await expect(plans).toContainText("이번 주 계획");
    await expect(plans.getByTestId(`plan-progress-${thisWeek.id}`)).toContainText("100%");
    // Unlinked section is filtered to the same week.
    await expect(unlinkedSection(page).getByTestId("unlinked-todo")).toHaveCount(1);
  };
  await checkWeek();
  await page.reload();
  await expect(page).toHaveURL(/view=week&date=2026-10-21$/);
  await checkWeek();

  await page.getByRole("link", { name: "다음 주", exact: true }).click();
  await expect(page).toHaveURL(/view=week&date=2026-10-28$/);
  await expect(card(page, "다음 주 일")).toBeVisible();
  await expect(card(page, "화요일 일")).toHaveCount(0);

  // year via the date picker + tab
  await page.goto("/board?view=year&date=2026-10-20");
  const checkYear = async () => {
    const tree = page.getByTestId("year-tree");
    await expect(tree.getByRole("heading", { name: "2026년 목표" })).toBeVisible();
    await expect(tree.getByTestId("year-goal")).toHaveCount(1);
    await expect(tree).toContainText("2026 목표");
    await expect(tree).not.toContainText("2027 목표");
    await expect(tree.getByTestId("year-plan")).toHaveCount(2);
    // R6: (100 + 0) / 2
    await expect(tree.getByTestId(`goal-progress-${goal.id}`)).toContainText("50%");
    await expect(tree.getByTestId(`plan-progress-${thisWeek.id}`)).toContainText("100%");
    await expect(tree.getByTestId(`plan-progress-${nextWeek.id}`)).toContainText("0%");
    await expect(page.getByTestId("column-todo")).toHaveCount(0);
  };
  await checkYear();
  await page.reload();
  await expect(page).toHaveURL(/\/board\?view=year&date=2026-10-20$/);
  await checkYear();

  await page.getByRole("link", { name: "다음 해", exact: true }).click();
  await expect(page).toHaveURL(/view=year&date=2027-10-20$/);
  await expect(page.getByTestId("year-tree")).toContainText("2027 목표");

  // The date picker navigates once hydrated (retry a pre-hydration change).
  await expect(async () => {
    await page.getByLabel("날짜 선택").fill("2026-03-05");
    await expect(page).toHaveURL(/view=year&date=2026-03-05$/, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await expect(page.getByTestId("year-tree")).toContainText("2026 목표");
});

test("AC16: an unknown view falls back to the all view and an invalid date to today", async ({ page }) => {
  const switcher = page.getByRole("navigation", { name: "보기 전환" });
  await page.goto("/board?view=month&date=nope");
  await expect(switcher.getByRole("link", { name: "전체" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("view-range")).toHaveText("전체 할 일");
  await expect(page.getByTestId("unlinked-section")).toBeVisible();
  await expect(page.getByTestId("column-todo")).toBeVisible();

  await page.goto("/board?view=day&date=2026-02-30");
  await expect(switcher.getByRole("link", { name: "일간" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("view-range")).toHaveText(todayKey());
});

test("AC17a: with no next-week plan the dialog creates one linked to the goal and moves the unfinished todos", async ({
  page,
}) => {
  const goal = await seedGoal("올해 목표", 2026);
  const source = await seedPlan("10월 셋째 주", "2026-10-19", goal.id);
  const a = await seedTodo("할 일 A", "2026-10-20", source.id);
  const b = await seedTodo("진행 B", "2026-10-22", source.id);
  await setTodoStatus(b.id, "doing");
  const c = await seedTodo("완료 C", "2026-10-21", source.id);
  await setTodoStatus(c.id, "done");

  await page.goto(`/weekly/${source.id}`);
  const dialog = await openDialog(page, page.getByRole("button", { name: "미완료 이월" }), "미완료 이월");
  await expect(dialog).toContainText("완료하지 않은 할 일 2개");
  await expect(dialog).toContainText("다음 주에 시작하는 주간 계획이 없습니다");
  await expect(dialog).toContainText("같은 목표에 연결됩니다");
  await expect(dialog.getByLabel("새 계획 제목")).toHaveValue("10월 셋째 주 (이월)");
  await dialog.getByRole("button", { name: "다음 주 계획 만들기" }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(async () => (await plansStarting("2026-10-26")).length, { timeout: 3000 }).toBe(1);
  const [created] = await plansStarting("2026-10-26");
  expect(created.title).toBe("10월 셋째 주 (이월)");
  expect(created.goalId?.toString()).toBe(goal.id);
  expect(await findTodo(a.id)).toMatchObject({ date: "2026-10-27", status: "todo" });
  expect(await findTodo(b.id)).toMatchObject({ date: "2026-10-29", status: "doing" });
  expect((await findTodo(a.id))?.weeklyPlanId?.toString()).toBe(created._id.toString());
  const done = await findTodo(c.id);
  expect(done?.date).toBe("2026-10-21");
  expect(done?.weeklyPlanId?.toString()).toBe(source.id);

  // Source board keeps only the done todo; the new plan's board has the moved ones.
  await expect(card(page, "할 일 A")).toHaveCount(0);
  await expect(card(page, "완료 C")).toBeVisible();
  await page.goto(`/weekly/${created._id.toString()}`);
  await expect(card(column(page, "todo"), "할 일 A")).toBeVisible();
  await expect(card(column(page, "doing"), "진행 B")).toBeVisible();
});

test("AC17a: at the year boundary the dialog explains the new plan is created without a goal", async ({ page }) => {
  const goal = await seedGoal("2026 목표", 2026);
  const source = await seedPlan("연말 주", "2026-12-28", goal.id);
  await seedTodo("넘길 일", "2027-01-02", source.id);

  await page.goto(`/weekly/${source.id}`);
  const dialog = await openDialog(page, page.getByRole("button", { name: "미완료 이월" }), "미완료 이월");
  await expect(dialog.getByTestId("carry-year-boundary")).toBeVisible();
  await dialog.getByRole("button", { name: "다음 주 계획 만들기" }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(async () => (await plansStarting("2027-01-04")).length, { timeout: 3000 }).toBe(1);
  const [created] = await plansStarting("2027-01-04");
  expect(created.goalId).toBeNull();
  expect((await findTodoByTitle("넘길 일"))?.date).toBe("2027-01-09");
});

test("AC17b: several next-week plans are listed with the same-goal plan first, and the picked one receives the todos", async ({
  page,
}) => {
  const goal = await seedGoal("올해 목표", 2026);
  const source = await seedPlan("원래 계획", "2026-10-19", goal.id);
  // Created first, so without the recommendation it would be listed first.
  const other = await seedPlan("다른 계획", "2026-10-26");
  const same = await seedPlan("같은 목표 계획", "2026-10-26", goal.id);
  const todo = await seedTodo("옮길 일", "2026-10-23", source.id);

  await page.goto(`/weekly/${source.id}`);
  const dialog = await openDialog(page, page.getByRole("button", { name: "미완료 이월" }), "미완료 이월");
  const candidates = dialog.getByTestId("carry-candidate");
  await expect(candidates).toHaveCount(2);
  await expect(candidates.nth(0)).toContainText("같은 목표 계획");
  await expect(candidates.nth(0)).toContainText("같은 목표");
  await expect(candidates.nth(1)).toContainText("다른 계획");
  await expect(candidates.nth(1)).not.toContainText("같은 목표");
  // The recommendation is preselected; pick the other one.
  await expect(candidates.nth(0).getByRole("radio")).toBeChecked();
  await candidates.nth(1).getByRole("radio").check();
  await dialog.getByRole("button", { name: "이월하기" }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(async () => (await findTodo(todo.id))?.weeklyPlanId?.toString(), { timeout: 3000 }).toBe(other.id);
  expect((await findTodo(todo.id))?.date).toBe("2026-10-30");
  await connectE2EDb();
  expect(await Todo.countDocuments({ weeklyPlanId: same.id })).toBe(0);
  expect(await WeeklyPlan.countDocuments()).toBe(3);
});

test("goal % (R6) is shown on /goals rows and the /goals/[id] header", async ({ page }) => {
  const goal = await seedGoal("진행률 목표", 2026);
  const planA = await seedPlan("A", "2026-10-19", goal.id);
  await seedPlan("B (할 일 없음)", "2026-10-26", goal.id);
  const t = await seedTodo("끝난 일", "2026-10-20", planA.id);
  await setTodoStatus(t.id, "done");
  await seedTodo("남은 일", "2026-10-21", planA.id);

  // A = 50, B = 0 -> 25
  await page.goto("/goals");
  await expect(page.getByTestId(`goal-progress-${goal.id}`)).toContainText("25%");
  await page.goto(`/goals/${goal.id}`);
  await expect(page.getByTestId(`goal-progress-${goal.id}`)).toContainText("25%");
});
