import { expect, test } from "@playwright/test";

test("home page renders studio entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PulseForge" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open studio" })).toBeVisible();
});

test("login screen is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("settings explains auth and MIDI", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /MIDI map/i })).toBeVisible();
});
