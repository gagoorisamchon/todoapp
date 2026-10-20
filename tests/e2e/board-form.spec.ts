import { expect, test } from "@playwright/test";
import { card, column, countTodos, findTodo, gotoBoard, seedPlan, seedTodo } from "./helpers/board";
import { disconnectE2EDb, resetDb } from "./helpers/db";

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await disconnectE2EDb();
});

test("AC1: missing title or date shows field errors and creates nothing", async ({ page }) => {
  await gotoBoard(page);
  await page.getByRole("button", { name: "할 일 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 추가" });
  // The day view prefills its date; clear it to submit an empty form.
  await dialog.getByLabel("날짜").fill("");

  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByText("제목을 입력하세요")).toBeVisible();
  await expect(dialog.getByText("날짜를 입력하세요")).toBeVisible();
  expect(await countTodos()).toBe(0);

  await dialog.getByLabel("제목").fill("제목만 있음");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByText("날짜를 입력하세요")).toBeVisible();
  await expect(dialog.getByText("제목을 입력하세요")).toHaveCount(0);
  expect(await countTodos()).toBe(0);

  await dialog.getByLabel("제목").fill("");
  await dialog.getByLabel("날짜").fill("2026-10-20");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByText("제목을 입력하세요")).toBeVisible();
  await expect(dialog.getByText("날짜를 입력하세요")).toHaveCount(0);
  expect(await countTodos()).toBe(0);
});

test("AC2a: editing title, date and linked plan updates the DB and the card", async ({ page }) => {
  const planA = await seedPlan("10월 셋째 주", "2026-10-19");
  const planB = await seedPlan("10월 넷째 주", "2026-10-26");
  const todo = await seedTodo("원래 제목", "2026-10-20", planA.id);

  await gotoBoard(page);
  const before = card(page, "원래 제목");
  await expect(before).toContainText("10월 셋째 주");
  await before.getByRole("button", { name: "원래 제목 수정" }).click();

  const dialog = page.getByRole("dialog", { name: "할 일 수정" });
  await dialog.getByLabel("제목").fill("바뀐 제목");
  await dialog.getByLabel("날짜").fill("2026-10-27");
  // Only plans containing the chosen date are offered.
  const select = dialog.getByLabel("주간 계획");
  await expect(select.locator("option")).toHaveCount(2);
  await select.selectOption(planB.id);
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  // The new date leaves the 2026-10-20 day view; the card shows up on 2026-10-27.
  await expect(card(page, "원래 제목")).toHaveCount(0);
  await expect(card(page, "바뀐 제목")).toHaveCount(0);
  await gotoBoard(page, "view=day&date=2026-10-27");
  const after = card(page, "바뀐 제목");
  await expect(after).toContainText("2026-10-27");
  await expect(after.getByTestId("todo-card-plan")).toContainText("10월 넷째 주");
  await expect(after.getByTestId("todo-card-plan")).toContainText("0%");
  await expect(card(page, "원래 제목")).toHaveCount(0);

  const saved = await findTodo(todo.id);
  expect(saved?.title).toBe("바뀐 제목");
  expect(saved?.date).toBe("2026-10-27");
  expect(saved?.weeklyPlanId?.toString()).toBe(planB.id);

  await page.reload();
  await expect(card(column(page, "todo"), "바뀐 제목")).toContainText("10월 넷째 주");
});

test("AC5: delete asks for confirmation; cancel keeps the todo, confirm removes it", async ({ page }) => {
  const todo = await seedTodo("지울 할 일", "2026-10-20");
  await gotoBoard(page);

  await card(page, "지울 할 일").getByRole("button", { name: "지울 할 일 삭제" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("할 일을 삭제할까요?");
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toBeHidden();
  await expect(card(page, "지울 할 일")).toBeVisible();
  expect(await findTodo(todo.id)).not.toBeNull();

  await card(page, "지울 할 일").getByRole("button", { name: "지울 할 일 삭제" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(card(page, "지울 할 일")).toHaveCount(0);
  await expect.poll(async () => findTodo(todo.id), { timeout: 3000 }).toBeNull();
});
