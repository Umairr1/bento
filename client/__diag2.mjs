import { chromium } from "playwright";
const BASE = process.env.BASE_URL; const s = Date.now();
const b = await chromium.launch({ channel: "chrome", headless: true });
const o = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
o.on("pageerror", (e) => console.log("[pageerror]", e.message));
await o.goto(BASE + "/signup"); await o.fill("#name", "own"); await o.fill("#email", `o${s}@t.dev`); await o.fill("#password", "password123"); await o.click("button[type=submit]");
await o.waitForURL(BASE + "/");
await o.click('.ws-panel-head button[title="New workspace"]'); await o.fill('input[placeholder="Workspace name"]', "W"); await o.press('input[placeholder="Workspace name"]', "Enter");
await o.click('button:has-text("New board")'); await o.fill('input[placeholder="Board title"]', "B"); await o.press('input[placeholder="Board title"]', "Enter");
await o.waitForURL(/\/board\/\d+/); await o.waitForSelector(".conn-status--connected", { timeout: 20000 });
const id = o.url().split("/").pop();
const info = await o.evaluate(async (id) => (await fetch(`/api/boards/${id}`, { credentials: "include" })).json(), id);
console.log("owner role from API:", info.role);
console.log("mode:", (await o.locator(".grid-canvas-frame").count()) ? "grid" : "freeform", "| nodes:", await o.locator(".react-flow__node").count());
await o.click('.btn-cluster button[title="Text note"]'); await o.waitForTimeout(2000);
console.log("owner after header Text click:", await o.locator(".react-flow__node").count());
if (await o.locator(".canvas-empty-state button").count()) { await o.click('.canvas-empty-state button:has-text("Add a note")'); await o.waitForTimeout(2000); console.log("owner after empty-state button:", await o.locator(".react-flow__node").count()); }
await o.screenshot({ path: "drive-shots/live-diag.png" });
await b.close(); process.exit(0);
