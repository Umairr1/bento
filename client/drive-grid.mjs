import { chromium } from "playwright";
import { writeFileSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";

// self-contained fixture so the script runs from a clean checkout
function ensureTestImage(path = "test-image.png") {
  if (existsSync(path)) return path;
  const W = 240, H = 240;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0;
    for (let x = 0; x < W; x++) {
      raw[o++] = (x * 255) / W;
      raw[o++] = (y * 255) / H;
      raw[o++] = 200;
    }
  }
  const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]));
  return path;
}
ensureTestImage();

const email = `grid-test-${Date.now()}@example.com`;
const pass = "password123";
const shot = (p, name) => p.screenshot({ path: `drive-shots/${name}.png`, fullPage: false });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto("http://localhost:5173/signup", { waitUntil: "networkidle" });
  await page.fill("#name", "Grid Tester");
  await page.fill("#email", email);
  await page.fill("#password", pass);
  await page.click("button[type=submit]");
  await page.waitForURL("http://localhost:5173/", { timeout: 15000 });
  await page.waitForTimeout(500);

  // workspace
  await page.click('.ws-panel-head button[title="New workspace"]');
  await page.fill('input[placeholder="Workspace name"]', "WS");
  await page.press('input[placeholder="Workspace name"]', "Enter");
  await page.waitForTimeout(600);

  // board
  await page.click('button:has-text("New board")');
  await page.fill('input[placeholder="Board title"]', "Grid Board");
  await page.press('input[placeholder="Board title"]', "Enter");
  await page.waitForTimeout(800);

  // Creating a board now opens it directly.
  await page.waitForSelector(".board-editor", { timeout: 15000 });
  await page.waitForTimeout(1500);
  await shot(page, "01-board-open");

  // open the Grid canvas accordion section, then toggle the checkbox
  const gridSection = page.locator(".bsb-section", { hasText: "Grid canvas" });
  await gridSection.locator(".bsb-section-head").click();
  await page.waitForTimeout(300);
  await gridSection.locator('input[type=checkbox]').first().check();
  await page.waitForTimeout(1500);
  await shot(page, "02-grid-mode-on");

  // zoom to fit so we can see the whole grid
  const fit = page.locator('.btn-cluster button[title="Fit all notes in view"]');
  if (await fit.count()) {
    await fit.first().click();
    await page.waitForTimeout(800);
    await shot(page, "03-grid-fit");
  }

  console.log("nodes on open:", await page.locator(".react-flow__node").count());

  // hover a box -> bento-style toolbar should appear
  const hoverBox = page.locator(".react-flow__node").first();
  await hoverBox.hover();
  await page.waitForTimeout(500);
  await shot(page, "03b-hover-toolbar");
  console.log("toolbar buttons visible:", await page.locator(".note-chrome-toolbar:visible .nc-tbtn").count());
  console.log("resize pills visible on hover:", await page.locator(".grid-resize-pill:visible").count());
  // move away -> pills should hide again
  await page.mouse.move(400, 500);
  await page.waitForTimeout(400);
  console.log("resize pills after un-hover:", await page.locator(".grid-resize-pill:visible").count());

  // Shuffle: generates a bento layout from the density setting on an empty board
  const shuffleSection = page.locator(".bsb-section").filter({ has: page.locator(".bsb-section-head", { hasText: /^Shuffle/ }) });
  await shuffleSection.locator(".bsb-section-head").click();
  await page.waitForTimeout(200);
  await page.waitForTimeout(300);
  await shuffleSection.locator("button:has-text('Shuffle layout')").click();
  await page.waitForTimeout(1200);
  await fit.first().click();
  await page.waitForTimeout(800);
  await shot(page, "04-after-shuffle");
  console.log("nodes after shuffle:", await page.locator(".react-flow__node").count());

  // reroll seed + shuffle again -> different layout
  await shuffleSection.locator(".bsb-seed-reroll").click();
  await page.waitForTimeout(200);
  await shuffleSection.locator("button:has-text('Shuffle layout')").click();
  await page.waitForTimeout(1200);
  await fit.first().click();
  await page.waitForTimeout(800);
  await shot(page, "05-reshuffled");

  // aspect ratio presets available
  const gridSec = page.locator(".bsb-section").filter({ has: page.locator(".bsb-section-head", { hasText: /^Grid canvas/ }) });
  await gridSec.locator(".bsb-section-head").click();
  await page.waitForTimeout(300);
  const opts = await gridSec.locator("select").first().locator("option").allTextContents();
  console.log("aspect presets:", opts.length, opts.join(" | "));

  // change rows -> grid must stay completely filled
  const rowsInput = gridSec.locator('input[type=number]').nth(3);
  await rowsInput.fill("4");
  await page.waitForTimeout(1200);
  await fit.first().click();
  await page.waitForTimeout(700);
  await shot(page, "06-rows-changed");

  // ---- preview during resize ----
  await fit.first().click();
  await page.waitForTimeout(600);
  const boxes = page.locator(".react-flow__node");
  const rects = [];
  for (let i = 0; i < (await boxes.count()); i++) rects.push({ i, b: await boxes.nth(i).boundingBox() });
  let pair = null;
  for (const a of rects) for (const c of rects) {
    if (a.i === c.i || !a.b || !c.b) continue;
    const sameRows = Math.abs(a.b.y - c.b.y) < 4 && Math.abs(a.b.height - c.b.height) < 4;
    const rightOf = c.b.x > a.b.x + a.b.width - 4 && c.b.x < a.b.x + a.b.width + 60;
    if (sameRows && rightOf) { pair = { a, c }; break; }
  }
  const before = await boxes.count();
  if (pair) {
    const { a, c } = pair;
    await boxes.nth(a.i).hover();
    await page.waitForTimeout(300);
    const hx = a.b.x + a.b.width, hy = a.b.y + a.b.height / 2;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(c.b.x + c.b.width * 2.5, hy, { steps: 24 });
    await page.waitForTimeout(400);
    console.log("preview visible mid-resize:", await page.locator(".grid-drop-preview").count());
    await shot(page, "08-resize-preview");
    await page.mouse.up();
    await page.waitForTimeout(700);
    console.log("preview after release:", await page.locator(".grid-drop-preview").count());
    console.log(`absorb: before=${before} after=${await boxes.count()}`);
  }

  // ---- preview during drag ----
  const d = await boxes.first().boundingBox();
  const empty = rects[rects.length - 1].b;
  if (d && empty) {
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    await page.mouse.down();
    await page.mouse.move(empty.x + empty.width / 2, empty.y + empty.height / 2, { steps: 20 });
    await page.waitForTimeout(400);
    console.log("preview visible mid-drag:", await page.locator(".grid-drop-preview").count());
    await shot(page, "09-drag-preview");
    await page.mouse.up();
    await page.waitForTimeout(600);
    console.log("preview after drop:", await page.locator(".grid-drop-preview").count());
  }

  // top-bar shuffle button
  // In grid mode this button's tooltip reads "Re-split…", so target it by its cluster position.
  const topShuffle = page.locator('header div[aria-label="Layout"] > button').first();
  console.log("top-bar shuffle button:", await topShuffle.count());
  if (await topShuffle.count()) {
    await topShuffle.first().click();
    await page.waitForTimeout(1000);
    await fit.first().click();
    await page.waitForTimeout(600);
    await shot(page, "10-top-shuffle");
    console.log("boxes after top shuffle:", await page.locator(".react-flow__node").count());
  }

  // ---- image import -> contextual toolbar -> pan/zoom inside the frame ----
  await fit.first().click();
  await page.waitForTimeout(600);
  const cell = page.locator(".react-flow__node").first();
  const cb = await cell.boundingBox();
  await cell.locator(".image-note-dropzone").click();
  await page.locator('input[type=file]').first().setInputFiles("test-image.png");
  await page.waitForTimeout(1800);
  await cell.click();
  await page.waitForTimeout(500);
  console.log("contextual bar:", await page.locator(".image-note-bar:visible").count(), "buttons:", await page.locator(".image-note-bar .inb-btn").count());
  await shot(page, "11-image-toolbar");

  // double-click to enter adjust mode, drag to pan, wheel to zoom
  const img = cell.locator(".image-note-fill");
  await img.dblclick();
  await page.waitForTimeout(400);
  console.log("adjust mode:", await page.locator(".image-note-fill--adjusting").count());
  const tBefore = await cell.locator("img").getAttribute("style");
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + 40, cb.y + cb.height / 2 + 25, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(500);
  const tAfter = await cell.locator("img").getAttribute("style");
  console.log("transform changed:", tBefore !== tAfter);
  console.log("after:", (tAfter || "").split("transform:")[1]?.trim().slice(0, 70));
  await shot(page, "12-image-adjust");

  // ---- containment: a note must never leave the canvas, during OR after the drag ----
  await fit.first().click();
  await page.waitForTimeout(600);
  const frame = await page.locator(".grid-canvas-frame").boundingBox();
  const n0 = page.locator(".react-flow__node").first();
  const nb = await n0.boundingBox();

  const inside = (b) =>
    b.x >= frame.x - 2 && b.y >= frame.y - 2 && b.x + b.width <= frame.x + frame.width + 2 && b.y + b.height <= frame.y + frame.height + 2;

  await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
  await page.mouse.down();
  // haul it way past the top-left corner of the canvas, sampling mid-drag
  await page.mouse.move(frame.x - 400, frame.y - 300, { steps: 18 });
  await page.waitForTimeout(250);
  const during1 = await n0.boundingBox();
  // and way past the bottom-right
  await page.mouse.move(frame.x + frame.width + 500, frame.y + frame.height + 400, { steps: 18 });
  await page.waitForTimeout(250);
  const during2 = await n0.boundingBox();
  await page.mouse.up();
  await page.waitForTimeout(900);
  const afterDrop = await n0.boundingBox();
  console.log("inside during drag (top-left haul):", inside(during1));
  console.log("inside during drag (bottom-right haul):", inside(during2));
  console.log("inside after drop:", inside(afterDrop));
  // every node must be inside the frame, not just the one we dragged
  {
    const fr = await page.locator(".grid-canvas-frame").boundingBox();
    const all = page.locator(".react-flow__node");
    const bad = [];
    for (let i = 0; i < (await all.count()); i++) {
      const b = await all.nth(i).boundingBox();
      const label = (await all.nth(i).locator(".note-chrome-grid-label").textContent().catch(() => null)) || `#${i}`;
      if (!(b.x >= fr.x - 2 && b.y >= fr.y - 2 && b.x + b.width <= fr.x + fr.width + 2 && b.y + b.height <= fr.y + fr.height + 2))
        bad.push(`${label} @ ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    console.log("frame:", `${Math.round(fr.x)},${Math.round(fr.y)} ${Math.round(fr.width)}x${Math.round(fr.height)}`);
    console.log("nodes outside frame:", bad.length, bad.join(" | "));
    // dump flow-space transforms so we can see what position each node is actually rendered at
    const dump = await all.evaluateAll((els) =>
      els.map((e) => ({
        label: e.querySelector(".note-chrome-grid-label")?.textContent ?? "?",
        t: e.style.transform,
        w: e.style.width,
        h: e.style.height,
      }))
    );
    console.log("node transforms:", JSON.stringify(dump));
    const vp = await page.locator(".react-flow__viewport").evaluate((e) => e.style.transform);
    console.log("viewport:", vp);
  }
  await shot(page, "13-containment");

  console.log("OK. console errors:", errors.length ? errors : "none");
} catch (e) {
  console.error("FAILED:", e.message);
  await shot(page, "99-failure");
  console.log("console errors:", errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
