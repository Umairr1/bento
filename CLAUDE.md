# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Boards** — a free, self-hosted, real-time collaborative visual canvas (Milanote-style) for designers.
Multi-tenant from day one: open signup, each user owns workspaces/boards, boards shared via roles.

Two npm packages, no workspace tooling. Client on `:5173`, server on `:4000`.

## Commands

```bash
npm run dev                      # both, via concurrently (run from repo root)
npm run dev:server               # server only    npm run dev:client
```

```bash
cd client && npx tsc -b          # PRIMARY verification gate — run after every change
cd client && npm run lint        # oxlint
cd client && npm run build       # tsc -b && vite build
cd server && npx tsc --noEmit    # server typecheck
```

There is **no test framework**. Verification convention used throughout this codebase:

1. `npx tsc -b` (client) / `npx tsc --noEmit` (server) — must be clean.
2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health` and `:5173/` — both 200.
3. For pure logic (layout math, grid geometry, template tiling), write a throwaway
   `src/canvas/__verify_*.ts` and run it with `npx tsx <path>`, then **delete it**. Several
   subtle layout bugs were only caught this way; prefer it over reasoning about the math.

The dev servers drop frequently (and any `npm install` while they run corrupts Vite's dep cache).
When curl fails, just relaunch `npm run dev` from the root in the background.

### Driving the real app

Playwright is installed but its CDN is unreachable from this environment — the browser binary
**cannot** be downloaded. Use the system Chrome instead:

```js
chromium.launch({ channel: "chrome", headless: true })
```

`client/drive-grid.mjs` is a working end-to-end driver (signup → workspace → board → grid mode →
screenshots into `drive-shots/`). Adapt it rather than writing a driver from scratch.

## Architecture

### Real-time layer (the load-bearing part)

The Yjs websocket protocol is **hand-rolled** in `server/src/collab/room.ts` on `y-protocols` +
`lib0`. This is deliberate: `@y/websocket-server` bundles a nested `yjs@14` prerelease, which would
put two Yjs module instances in one process — a real runtime correctness hazard, not just a type
error. Keep a single `yjs` version end-to-end.

- WS path is `/yjs/board-<id>`. The client's `wsBase()` **must** include the `/yjs` prefix or the
  upgrade regex rejects it and the socket is destroyed (symptom: "Connecting…" forever, while local
  edits still appear because React state updates regardless).
- Auth happens at HTTP upgrade: JWT from the httpOnly cookie → `getBoardAccess()` → `canEditRole()`.
  Non-editors connect read-only; `handleMessage(conn, msg, canEdit)` silently drops sync-step2 and
  update messages from them.
- Persistence: `board_snapshots` (binary Yjs state), debounced 2s after changes plus a final save
  when the last connection leaves.

### The Yjs document shape

Two top-level maps per board:

- `"nodes"` — `id → sanitized node`. **`sanitizeNode()` in `client/src/collab/useYjsBoard.ts` is an
  allowlist.** Any new top-level node field (`tagColor`, `draggable`, the `grid*` span fields…) must
  be added there or it silently will not sync between clients or survive reload.
- `"settings"` — `BoardSettings`, shared board-wide (grid, snap, corner style/radius, grid-canvas
  config). Flows to note components via `BoardSettingsContext` → `useBoardSettings()`.

`isWellFormedNode()` defensively filters malformed entries on read — a malformed node once crashed
React Flow's `adoptUserNodes`. Don't remove it.

Local node changes are debounced 40ms before diff+transact, so dragging doesn't fight the render loop.

### Canvas

React Flow (`@xyflow/react`) with DOM nodes — chosen over canvas/WebGL because notes hold real HTML
(rich text, images, embeds). Eight note types in `client/src/notes/`, registered in `nodeTypes` in
`BoardEditor.tsx`, each wrapped by `withNoteChrome()` (tag dot, lock badge, search highlight, grid
label overlay).

`BoardEditor.tsx` is the orchestrator — it owns node CRUD, keyboard shortcuts, selection, drag/resize
interception, and both canvas modes.

**Two canvas modes, distinct models:**

| | Freeform (default) | Grid canvas (`settings.gridMode`) |
|---|---|---|
| Position source of truth | node `position`/`width`/`height` | `gridCol1/Row1/Col2/Row2` cell span |
| Resize | free pixels; neighbours auto-adjust via `canvas/tileResize.ts` | span grows/shrinks in whole cells; **absorbs** a fully-covered neighbour, blocks on partial overlap |
| Drag | free | drop on another note swaps spans |

In grid mode the pixel rect is **derived, never persisted** — `displayNodes` (a memo) maps each note
through `spanToRect()` and feeds that to `<ReactFlow nodes={…}>`. Because of this the raw stored
`position`/`width` are stale in grid mode: compute "before" rects from the span, not from stored
fields, or delta math will be wrong.

`canvas/tileResize.ts` (freeform only) infers neighbour relationships from pixel geometry. It is a
heuristic and known to be fragile on irregular Shuffle output — coincidentally-close boundaries can't
always be distinguished from real shared edges. It clamps the drag to what neighbours can absorb and
has a final overlap guard that drops any update which would ship an overlap.

### Grid canvas mode is a port — `bento-studio (12).html` is the spec

The root-level `bento-studio (12).html` is the original single-file prototype and the **source of
truth** for Grid canvas mode. Read it before changing grid behaviour; guessing from screenshots
produced a wrong model twice.

Its actual model (mirrored in `client/src/canvas/gridBoard.ts`):

- Fixed-size canvas (`width`×`height`, default 1500×1500) divided into **uniform** cells.
  `cellW = (width - 2*pad - hGap*(cols-1)) / cols`. There is **no per-track sizing** — a
  resizable-table model is the wrong mental picture.
- Everything anchors top-left at `pad + index*(cell + gap)` — boxes, grid guides and draw-preview all
  use that one formula. **Nothing is centered.**
- A box owns a half-open cell span `{col1,row1,col2,row2}`; resize only ever changes that box's own
  span. **Deliberate divergence:** bento rejects any overlapping resize outright, but since Boards'
  grid starts filled edge-to-edge that would make every resize a no-op — so growing over a neighbour
  absorbs it once it's *fully* inside the new span (partial overlap still blocks, and it's undoable).
- Shuffle/templates work in **cell space**, recursively splitting the grid rect into leaf spans.

- Empty cells stay **empty** — they render as dashed guide outlines (`renderGuides`), and boxes are
  only created by draw-to-create, media drop, template, or shuffle. Do not auto-populate cells.

Relevant functions to read there: `getMetrics`, `cellRectToPx`, `renderGuides`, `startResize`,
`startBoxInteraction`, `shuffleLayout`, `placeholderCss`, `cornerStyleFor`.

`shuffleGridLayout()` in `gridBoard.ts` is the cell-space port of `shuffleLayout` (density →
target count, recursive split, hero corner, locked-span exclusion, seeded via mulberry32). Boards
passes `targetCount = note count` when the board already has notes, so a shuffle re-spans the
user's notes instead of creating/destroying them the way bento does.

Grid-mode invariants worth preserving: a new board seeds `DEFAULT_GRID_TEMPLATE` (fixed seed, fully
covers the grid), the viewport `fitBounds` to the canvas on open, and changing cols/rows re-splits
into exactly `nodes.length` spans so the grid stays completely filled without creating or destroying
notes. Per-note hover actions come from `NoteActionsContext` (bento's `.b-toolbar`), rendered by
`withNoteChrome` for every note type.

Still not ported: draw-to-create in cell space.

## UI conventions that bite

- **Counter-zoom**: React Flow scales the whole node subtree with canvas zoom, so any per-node popup
  (colour picker, text toolbar) must apply `transform: scale(var(--counter-zoom))` where
  `--counter-zoom = 1/zoom` from `useViewport()` — otherwise it's illegible at high/low zoom.
- **Never put `overflow:hidden` (or `clip-path`/`mask`) on the same element that hosts
  `<NodeResizer>`** — it clips the resize handles. Corner styles therefore require a separate inner
  `-shape` wrapper div on every note type (`notes/noteCorners.css`).
- Note-level drop handlers must `stopPropagation()`, or the canvas-level handler also fires and
  creates a duplicate note.
- Plain CSS only — `:global()` is CSS-Modules syntax and silently does nothing here.
- Popovers inside the scrollable sidebar get clipped; portal them to `document.body` with fixed
  coordinates (see `ShortcutsHelp.tsx`).
- Anything that must pan/zoom with the canvas but isn't a node goes through `<ViewportPortal>`, and
  needs `z-index: -1` to sit behind nodes (see `.grid-canvas-frame`).

## Working style

The user wants **one step at a time** on large builds — implement, verify, hand back. Don't chain
several features silently. Replies: what changed, what's left, what they need to do.
