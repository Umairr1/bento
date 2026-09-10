// Captures the current UI for a polish pass: auth pages, dashboard, board editor (grid + freeform).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:5173";
const SHOTS = "drive-shots";
mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const user = { name: "Umair", email: `ui${stamp}@test.dev`, password: "password123" };

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("[pageerror]", e.message));

try {
  await p.goto(BASE + "/signup");
  await p.screenshot({ path: `${SHOTS}/ui-01-signup.png` });

  await p.fill("#name", user.name);
  await p.fill("#email", user.email);
  await p.fill("#password", user.password);
  await p.click("button[type=submit]");
  await p.waitForURL(BASE + "/");
  await p.screenshot({ path: `${SHOTS}/ui-02-dash-empty.png` });

  await p.click('.ws-panel-head button[title="New workspace"]');
  await p.fill('input[placeholder="Workspace name"]', "Client Work");
  await p.press('input[placeholder="Workspace name"]', "Enter");
  for (const t of ["Brand Moodboard", "Q3 Campaign", "Site Redesign"]) {
    await p.click('button:has-text("New board")');
    await p.fill('input[placeholder="Board title"]', t);
    await p.press('input[placeholder="Board title"]', "Enter");
    // Creating a board now opens it — come back for the next one.
    await p.waitForURL(/\/board\/\d+/);
    await p.goto(BASE + "/");
    await p.waitForSelector(".board-card");
  }
  await p.screenshot({ path: `${SHOTS}/ui-03-dash-full.png` });
  await p.locator(".board-card").first().hover();
  await p.screenshot({ path: `${SHOTS}/ui-03b-dash-hover.png` });

  await p.locator(".board-card").first().click();
  await p.waitForURL(/\/board\/\d+/);
  await p.waitForSelector(".react-flow");
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${SHOTS}/ui-04-board-grid.png` });

  // Header alone, at real scale.
  await p.locator(".board-editor-header").screenshot({ path: `${SHOTS}/ui-05-header.png` });
  await p.locator(".board-sidebar, .sidebar, aside").first().screenshot({ path: `${SHOTS}/ui-06-sidebar.png` });

  // A freeform board (grid mode off) to check the empty state.
  await p.goto(BASE + "/");
  await p.click("button:has-text(\"New board\")");
  await p.fill("input[placeholder=\"Board title\"]", "Freeform");
  await p.press("input[placeholder=\"Board title\"]", "Enter");
  await p.waitForURL(/\/board\/\d+/);
  await p.waitForSelector(".react-flow");
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${SHOTS}/ui-07-freeform-empty.png` });
} finally {
  await browser.close();
}
console.log("done");
