import { expect, test } from "@playwright/test";
import { disconnectE2EDb, resetDb } from "./helpers/db";

test.beforeEach(async () => {
  await resetDb();
});

test.afterAll(async () => {
  await disconnectE2EDb();
});

test("/ is the dashboard and the nav links to every screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "대시보드", level: 1 })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  for (const name of ["대시보드", "보드", "주간", "목표"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "대시보드", exact: true })).toHaveAttribute("aria-current", "page");
  for (const id of ["today", "week", "goals", "attention"]) {
    await expect(page.getByTestId(`dashboard-${id}`)).toBeVisible();
  }

  await nav.getByRole("link", { name: "보드", exact: true }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("heading", { name: "칸반 보드" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "보드", exact: true })).toHaveAttribute("aria-current", "page");
  for (const status of ["todo", "doing", "done"]) {
    await expect(page.getByTestId(`column-${status}`)).toBeVisible();
  }
});
