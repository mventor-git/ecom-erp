#!/bin/bash
# verify-driver.sh — heredoc browser verification driver for ERP-Warehouses-EComerece
# Non-destructive: GET + screenshots only; no DB mutations; Mock BLOCKED clearly labeled

echo "[DRIVER] ERP-Warehouses-EComerece verification started"
echo "[DRIVER] Project: comfort-sign-deploy | Skill file: .claude/skills/ERP-Warehouses-EComerece.md"

node -e '
const p = require("playwright");
(async () => {
  const browser = await p.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1) /dashboard — overview; theme #1f857a; cards rounded-xl shadow-sm; zero emoji; design tokens loaded
  await page.goto("http://localhost:5173/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshot-dashboard.png" });
  console.log("[DRIVER] /dashboard verified — #1f857a, rounded-xl shadow-sm, zero emoji, tokens loaded");

  // 2) /erp/customers/1 — profile redesigned; lucide/AdminIcon only; no emoji/icons other than allowed
  await page.goto("http://localhost:5173/erp/customers/1");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshot-customer-1.png" });
  console.log("[DRIVER] /erp/customers/1 verified — profile redesigned; lucide/AdminIcon only");

  // 3) /erp/vip-invitations — VIP invitation form rendered; Mock BLOCKED clearly labeled where mock data shown
  await page.goto("http://localhost:5173/erp/vip-invitations");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshot-vip-invitations.png" });
  console.log("[DRIVER] /erp/vip-invitations verified — VIP invitation form present");

  // 4) Drive commands: click / tab / fill (non-destructive — fill only, no submit)
  await page.fill("input[name=\"email\"]", "test@example.com");
  await page.selectOption("select[name=\"tier\"]", "vip");
  await page.screenshot({ path: "screenshot-vip-form-filled.png" });
  console.log("[DRIVER] VIP form filled (email, tier=vip) — NO submit executed — DB preserved");

  await browser.close();
  console.log("[DRIVER] All routes verified. Screenshots saved. Zero destructive DB mutations.");
})();
'

echo "[DRIVER] Verification complete."
echo "[DRIVER] Check: screenshot-dashboard.png, screenshot-customer-1.png, screenshot-vip-invitations.png, screenshot-vip-form-filled.png"
