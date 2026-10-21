import { expect, test, type Page } from "@playwright/test";
import { todayKey } from "../../lib/date";
import { card, column, findTodoByTitle, gotoBoard, seedPlan, seedTodo } from "./helpers/board";
import { disconnectE2EDb, resetDb } from "./helpers/db";

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await disconnectE2EDb();
});

const switcher = (page: Page) => page.getByRole("navigation", { name: "보기 전환" });
const toast = (page: Page, title: string) => page.locator("[data-sonner-toast]").filter({ hasText: title });

async function addTodo(page: Page, title: string, date: string) {
  await page.getByRole("button", { name: "할 일 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 추가" });
  await dialog.getByLabel("제목").fill(title);
  await dialog.getByLabel("날짜").fill(date);
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
}

test("AC23: /board without parameters is the all view and shows todos of every date together", async ({ page }) => {
  // The user's bug report: todos dated 10-22 and 10-23 vanished from the default (today) view.
  const plan = await seedPlan("이번 주 계획", "2026-10-19");
  await seedTodo("20일 일", "2026-10-20", plan.id);
  await seedTodo("22일 일", "2026-10-22");
  await seedTodo("23일 일", "2026-10-23");

  await gotoBoard(page, "");
  await expect(switcher(page).getByRole("link", { name: "전체" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("view-range")).toHaveText("전체 할 일");
  // No range to step through in the all view.
  await expect(page.getByRole("link", { name: "이전 날" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "다음 날" })).toHaveCount(0);

  // R9: date asc in the 할 일 column.
  await expect(column(page, "todo").getByTestId("todo-card")).toHaveText([/20일 일/, /22일 일/, /23일 일/]);
  const unlinked = page.getByTestId("unlinked-section").getByTestId("unlinked-todo");
  await expect(unlinked).toHaveCount(2);
  await expect(unlinked.filter({ hasText: "22일 일" })).toBeVisible();
  await expect(unlinked.filter({ hasText: "23일 일" })).toBeVisible();

  // 오늘 goes to today's day view; the date picker opens the picked day's view.
  await expect(page.getByRole("link", { name: "오늘", exact: true })).toHaveAttribute(
    "href",
    `/board?view=day&date=${todayKey()}`,
  );
  await expect(async () => {
    await page.getByLabel("날짜 선택").fill("2026-10-22");
    await expect(page).toHaveURL(/\/board\?view=day&date=2026-10-22$/, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await expect(card(page, "22일 일")).toBeVisible();
  await expect(card(page, "20일 일")).toHaveCount(0);

  // The 전체 tab goes back to plain /board.
  await switcher(page).getByRole("link", { name: "전체" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(card(page, "20일 일")).toBeVisible();
});

test("AC23: saving a todo outside the shown day says where it went, and 보기 opens that day", async ({ page }) => {
  await gotoBoard(page, "view=day&date=2026-10-20");
  await addTodo(page, "다른 날 일", "2026-10-22");

  const notice = toast(page, "할 일을 추가했습니다");
  await expect(notice).toContainText("2026-10-22 날짜에 저장되어 지금 화면에는 보이지 않습니다.");
  expect((await findTodoByTitle("다른 날 일"))?.date).toBe("2026-10-22");
  await expect(card(page, "다른 날 일")).toHaveCount(0);

  await notice.getByRole("button", { name: "보기" }).click();
  await expect(page).toHaveURL(/\/board\?view=day&date=2026-10-22$/);
  await expect(page.getByTestId("view-range")).toHaveText("2026-10-22");
  await expect(card(page, "다른 날 일")).toBeVisible();
});

test("AC23: creating in the all view confirms with a toast and highlights the new card", async ({ page }) => {
  await seedTodo("기존 일", "2026-10-20");
  await gotoBoard(page, "");
  await addTodo(page, "새로 만든 일", "2026-11-05");

  const notice = toast(page, "할 일을 추가했습니다");
  await expect(notice).toBeVisible();
  await expect(notice).not.toContainText("보이지 않습니다");
  await expect(notice.getByRole("button", { name: "보기" })).toHaveCount(0);

  const created = card(page, "새로 만든 일");
  await expect(created).toBeVisible();
  await expect(created).toHaveAttribute("data-highlighted", "true");
  await expect(created).toBeInViewport();
  await expect(card(page, "기존 일")).not.toHaveAttribute("data-highlighted", "true");
  // The highlight is brief.
  await expect(created).not.toHaveAttribute("data-highlighted", "true", { timeout: 5000 });
});

test("editing a todo confirms with a toast", async ({ page }) => {
  await seedTodo("고칠 일", "2026-10-20");
  await gotoBoard(page);
  await page.getByRole("button", { name: "고칠 일 수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 수정" });
  await dialog.getByLabel("제목").fill("고친 일");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
  await expect(toast(page, "할 일을 수정했습니다")).toBeVisible();
  await expect(card(page, "고친 일")).toBeVisible();
});
