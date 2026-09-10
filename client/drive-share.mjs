// Drives the sharing flow end-to-end in two isolated browser contexts (two real accounts):
//   owner  → signs up, makes a board, opens Share, creates an invite link
//   guest  → signs up via that link (the ?next= hop), lands on the board, edits it
//   owner  → sees the guest in the member list and the guest's note appear live
//
// Uses system Chrome (`channel: "chrome"`) because the Playwright Chromium CDN is unreachable here.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:5173";
const SHOTS = "drive-shots";
mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const owner = { name: "Owner", email: `owner${stamp}@test.dev`, password: "password123" };
const guest = { name: "Guest", email: `guest${stamp}@test.dev`, password: "password123" };

const log = (m) => console.log(`  ${m}`);
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function signup(page, who, path = "/signup") {
  await page.goto(BASE + path);
  await page.fill("#name", who.name);
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click("button[type=submit]");
}

const browser = await chromium.launch({ channel: "chrome", headless: false });

try {
  // ---- owner ----
  const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const o = await ownerCtx.newPage();
  o.on("pageerror", (e) => console.log("  [owner pageerror]", e.message));

  await signup(o, owner);
  await o.waitForURL(BASE + "/");
  log("owner signed up");

  await o.click('.ws-panel-head button[title="New workspace"]');
  await o.fill('input[placeholder="Workspace name"]', "Team");
  await o.press('input[placeholder="Workspace name"]', "Enter");
  await o.click('button:has-text("New board")');
  await o.fill('input[placeholder="Board title"]', "Shared Board");
  await o.press('input[placeholder="Board title"]', "Enter");
  // Creating a board opens it directly.
  await o.waitForURL(/\/board\/\d+/);
  const boardUrl = o.url();
  log(`owner opened ${boardUrl}`);

  await o.click(".share-btn");
  await o.waitForSelector(".shd");
  check("share dialog opens", await o.isVisible(".shd"));
  await o.screenshot({ path: `${SHOTS}/share-01-dialog.png` });

  await o.click('button:has-text("Create link")');
  await o.waitForSelector(".shd-linkinput");
  const inviteUrl = await o.inputValue(".shd-linkinput");
  check("invite link created", /\/join\/[A-Za-z0-9_-]+$/.test(inviteUrl));
  log(`invite link: ${inviteUrl}`);

  // Link role change should stick.
  await o.selectOption(".shd-linkmeta .shd-role", "viewer");
  await o.waitForSelector(".shd-notice");
  await o.selectOption(".shd-linkmeta .shd-role", "editor");
  await o.screenshot({ path: `${SHOTS}/share-02-link.png` });
  await o.click(".shd-close");

  // ---- guest joins through the link while logged out ----
  const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const g = await guestCtx.newPage();
  g.on("pageerror", (e) => console.log("  [guest pageerror]", e.message));

  await g.goto(inviteUrl);
  await g.waitForURL(/\/login\?next=/);
  check("logged-out invite redirects to login with ?next", g.url().includes("next=%2Fjoin%2F"));
  await g.click(".auth-switch a"); // → signup, next preserved
  check("signup link keeps ?next", g.url().includes("/signup?next="));

  await g.fill("#name", guest.name);
  await g.fill("#email", guest.email);
  await g.fill("#password", guest.password);
  await g.click("button[type=submit]");

  await g.waitForURL(/\/board\/\d+/, { timeout: 15000 });
  check("guest lands on the shared board", g.url() === boardUrl);
  await g.waitForSelector(".react-flow", { timeout: 10000 });
  await g.screenshot({ path: `${SHOTS}/share-03-guest-board.png` });

  // ---- guest edits, owner sees it live ----
  await g.waitForSelector(".conn-status--connected", { timeout: 15000 });
  const before = await o.locator(".react-flow__node").count();
  await g.click('.btn-cluster button[title="Text note"]');
  await o.waitForFunction(
    (n) => document.querySelectorAll(".react-flow__node").length > n,
    before,
    { timeout: 10000 }
  );
  check("guest's note syncs live to the owner", (await o.locator(".react-flow__node").count()) > before);

  // ---- owner sees guest in the member list ----
  await o.click(".share-btn");
  await o.waitForSelector(".shd-members li");
  const memberText = await o.locator(".shd-members").innerText();
  check("guest appears in member list", memberText.includes(guest.email));
  check("guest joined as editor", (await o.locator(".shd-members .shd-role").first().inputValue()) === "editor");
  await o.screenshot({ path: `${SHOTS}/share-04-members.png` });

  // ---- guest's own view: read-only sharing panel ----
  await g.click(".share-btn");
  await g.waitForSelector(".shd");
  check("guest sees no invite form", (await g.locator(".shd-invite").count()) === 0);
  check("guest sees no link controls", (await g.locator(".shd-linkinput").count()) === 0);
  check("guest still sees the member list", (await g.locator(".shd-members li").count()) > 0);
  await g.screenshot({ path: `${SHOTS}/share-05-guest-dialog.png` });
  await g.click(".shd-close");

  // ---- dashboard: shared with you ----
  await g.goto(BASE + "/");
  await g.waitForSelector(".ws-item:has-text('Shared with you')", { timeout: 10000 });
  await g.click(".ws-item:has-text('Shared with you')");
  await g.waitForSelector(".board-card");
  const sharedText = await g.locator(".board-grid").innerText();
  check("shared board listed on dashboard", sharedText.includes("Shared Board") && sharedText.includes("Owner"));
  await g.screenshot({ path: `${SHOTS}/share-06-shared-dashboard.png` });

  // ---- revoke: link stops working for a third visitor ----
  await o.click('button:has-text("Revoke")');
  await o.waitForSelector('button:has-text("Create link")');
  const t = await browser.newContext();
  const third = await t.newPage();
  await signup(third, { name: "Third", email: `third${stamp}@test.dev`, password: "password123" });
  await third.waitForURL(BASE + "/");
  await third.goto(inviteUrl);
  await third.waitForSelector(".auth-error", { timeout: 10000 });
  check("revoked link no longer joins", await third.isVisible(".auth-error"));
  await third.screenshot({ path: `${SHOTS}/share-07-revoked.png` });

  // ---- remove member ----
  log(`remove buttons visible: ${await o.locator(".shd-remove").count()}`);
  await o.click(".shd-remove");
  await o.waitForTimeout(1500);
  await o.screenshot({ path: `${SHOTS}/share-08-removed.png` });
  if (await o.locator(".shd-error").count()) log(`remove error: ${await o.locator(".shd-error").innerText()}`);
  check("member removed", (await o.locator(".shd-members li").count()) === 0);
} finally {
  await browser.close();
}
