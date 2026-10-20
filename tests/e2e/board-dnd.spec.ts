import { expect, test } from "@playwright/test";
import { card, column, dragTo, findTodo, findTodoByTitle, gotoBoard, seedTodo } from "./helpers/board";
import { disconnectE2EDb, resetDb } from "./helpers/db";

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await disconnectE2EDb();
});

test("AC3: a created todo starts in 할 일 and dragging it to 진행 중 is saved", async ({ page }) => {
  await gotoBoard(page);
  await page.getByRole("button", { name: "할 일 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 추가" });
  await dialog.getByLabel("제목").fill("드래그할 일");
  await dialog.getByLabel("날짜").fill("2026-10-20");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  const created = card(column(page, "todo"), "드래그할 일");
  await expect(created).toBeVisible();
  const doc = await findTodoByTitle("드래그할 일");
  expect(doc?.status).toBe("todo");

  await dragTo(page, created, column(page, "doing"));
  await expect(card(column(page, "doing"), "드래그할 일")).toBeVisible();
  await expect.poll(async () => (await findTodo(doc!._id.toString()))?.status, { timeout: 3000 }).toBe("doing");

  await page.reload();
  await expect(card(column(page, "doing"), "드래그할 일")).toBeVisible();
  await expect(card(column(page, "todo"), "드래그할 일")).toHaveCount(0);
});

test("AC4: when saving the status fails the card returns and a toast is shown", async ({ page }) => {
  const todo = await seedTodo("실패할 일", "2026-10-20");
  await gotoBoard(page);
  await page.route("**/*", (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      return route.fulfill({ status: 500, body: "Internal Server Error" });
    }
    return route.fallback();
  });

  await dragTo(page, card(page, "실패할 일"), column(page, "doing"));
  await expect(page.getByText("상태를 저장하지 못했습니다")).toBeVisible();
  await expect(card(column(page, "todo"), "실패할 일")).toBeVisible();
  await expect(card(column(page, "doing"), "실패할 일")).toHaveCount(0);
  expect((await findTodo(todo.id))?.status).toBe("todo");
});

test("AC18: keyboard only (Tab, Space, ArrowRight, Space) moves a card to the next column", async ({ page }) => {
  const todo = await seedTodo("키보드로 옮길 일", "2026-10-20");
  await gotoBoard(page);
  const target = card(page, "키보드로 옮길 일");
  const liveRegion = page.locator('[id^="DndLiveRegion"]');

  let focused = false;
  for (let i = 0; i < 20 && !focused; i++) {
    await page.keyboard.press("Tab");
    focused = await target.evaluate((el) => el === document.activeElement);
  }
  expect(focused).toBe(true);

  await page.keyboard.press("Space");
  await expect(target).toHaveAttribute("aria-pressed", "true");
  // The KeyboardSensor attaches its keydown listener on the next tick after pickup, so retry a press that came too early.
  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect(liveRegion).toContainText("진행 중 컬럼 위에 있습니다", { timeout: 1000 });
  }).toPass({ timeout: 5000 });
  await page.keyboard.press("Space");
  await expect(liveRegion).toContainText("진행 중 컬럼에 놓았습니다");

  await expect(card(column(page, "doing"), "키보드로 옮길 일")).toBeVisible();
  await expect.poll(async () => (await findTodo(todo.id))?.status, { timeout: 3000 }).toBe("doing");
});
