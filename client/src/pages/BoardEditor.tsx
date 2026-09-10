import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ViewportPortal,
  useReactFlow,
  useViewport,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type CoordinateExtent,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, ApiError, type Board } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useYjsBoard } from "../collab/useYjsBoard";
import { BoardSettingsContext } from "../collab/BoardSettingsContext";
import { BoardSidebar } from "./BoardSidebar";
import { generateShuffleLayout, computeLayoutArea, insetRectsUniformly, DEFAULT_SHUFFLE_SETTINGS, type ShuffleSettings } from "../canvas/shuffleLayout";
import { TEMPLATES, templateRectsForCount, fracRectToArea, type TemplateId } from "../canvas/templates";
import { DEFAULT_PRESENTATION_SETTINGS, type PresentationSettings } from "../canvas/presentationSettings";
import { computeTileNeighborAdjustments } from "../canvas/tileResize";
import {
  computeMetrics,
  spanToRect,
  spansOverlap,
  spanContains,
  resizeSpan,
  findFreeSpan,
  shuffleGridLayout,
  gridBackgroundCss,
  DEFAULT_GRID_TEMPLATE,
  type GridMetrics,
  type CellSpan,
  type ResizeDir,
} from "../canvas/gridBoard";
import { PresentationView } from "./PresentationView";
import { exportBoardImage } from "../canvas/exportImage";
import { exportBoardVideo, type VideoResolution } from "../canvas/exportVideo";
import "../notes/noteCorners.css";
import { TextNote, type TextNoteData } from "../notes/TextNote";
import { ImageNote, type ImageNoteData } from "../notes/ImageNote";
import { DEFAULT_MEDIA_TRANSFORM, type MediaTransform } from "../notes/mediaTransform";
import { LinkNote, type LinkNoteData } from "../notes/LinkNote";
import { ChecklistNote, type ChecklistNoteData } from "../notes/ChecklistNote";
import { ColumnNote, type ColumnNoteData } from "../notes/ColumnNote";
import { BoardNote, type BoardNoteData } from "../notes/BoardNote";
import { ShapeNote, SHAPE_COLORS, SHAPES, type ShapeNoteData } from "../notes/ShapeNote";
import { DrawingNote, type DrawingNoteData } from "../notes/DrawingNote";
import { appendSmoothed, boundingBox, buildSmoothPath, type Point } from "../notes/drawingPath";
import { withNoteChrome, NoteChromeContext, NoteActionsContext, type NoteChromeInfo, type NoteActions } from "../notes/NoteChrome";
import {
  FitViewIcon,
  SearchIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CloseIcon,
  LockIcon,
  UnlockIcon,
  DuplicateIcon,
  TrashIcon,
  ColumnsIcon,
  PlayIcon,
  TextGlyphIcon,
  ShapeGlyphIcon,
  ImageGlyphIcon,
  LinkGlyphIcon,
  ChecklistGlyphIcon,
  AlignLeftIcon,
  AlignCenterHIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignMiddleVIcon,
  AlignBottomIcon,
  DistributeHIcon,
  DistributeVIcon,
  BringToFrontIcon,
  SendToBackIcon,
  BringForwardIcon,
  SendBackwardIcon,
  BoardGlyphIcon,
  UndoIcon,
  RedoIcon,
} from "./toolbarIcons";
import { ShuffleIcon } from "./sidebarIcons";
import "./BoardEditor.css";

type NoteNode = (
  | Node<TextNoteData, "textNote">
  | Node<ImageNoteData, "imageNote">
  | Node<LinkNoteData, "linkNote">
  | Node<ChecklistNoteData, "checklistNote">
  | Node<ColumnNoteData, "columnNote">
  | Node<BoardNoteData, "boardNote">
  | Node<ShapeNoteData, "shapeNote">
  | Node<DrawingNoteData, "drawingNote">
) & {
  tagColor?: string;
  gridCol1?: number;
  gridRow1?: number;
  gridCol2?: number;
  gridRow2?: number;
};

const TAG_COLORS = ["#f0607a", "#e8a33d", "#3fb27f", "#3fa7d6", "#6d6bfa", "#a78bfa"];

const nodeTypes = {
  textNote: withNoteChrome(TextNote),
  imageNote: withNoteChrome(ImageNote),
  linkNote: withNoteChrome(LinkNote),
  checklistNote: withNoteChrome(ChecklistNote),
  columnNote: withNoteChrome(ColumnNote),
  boardNote: withNoteChrome(BoardNote),
  shapeNote: withNoteChrome(ShapeNote),
  drawingNote: withNoteChrome(DrawingNote),
};

function noteSearchText(n: NoteNode): string {
  switch (n.type) {
    case "textNote":
      return n.data.text ?? "";
    case "imageNote":
      return "";
    case "linkNote":
      return `${n.data.title ?? ""} ${n.data.url ?? ""}`;
    case "checklistNote":
      return `${n.data.title ?? ""} ${(n.data.items ?? []).map((i) => i.text).join(" ")}`;
    case "columnNote":
      return `${n.data.title ?? ""} ${(n.data.items ?? []).map((i) => i.text).join(" ")}`;
    case "boardNote":
      return n.data.title ?? "";
    case "shapeNote":
      return "";
    case "drawingNote":
      return "";
    default:
      return "";
  }
}

const PEN_DRAW_PADDING = 16;

const MIN_DRAW_SIZE = 24;

export default function BoardEditor() {
  return (
    <ReactFlowProvider>
      <BoardEditorInner />
    </ReactFlowProvider>
  );
}

function BoardEditorInner() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);
  const { screenToFlowPosition, setCenter, fitView, fitBounds } = useReactFlow();
  const { user } = useAuth();
  const viewport = useViewport();

  const [board, setBoard] = useState<Board & { parentTitle: string | null }>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawRect, setDrawRect] = useState<{
    startClientX: number;
    startClientY: number;
    curClientX: number;
    curClientY: number;
  } | null>(null);
  const [pendingDraw, setPendingDraw] = useState<{
    flowX: number;
    flowY: number;
    flowW: number;
    flowH: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [penMode, setPenMode] = useState(false);
  const [penPoints, setPenPoints] = useState<Point[] | null>(null);
  const [penColor, setPenColor] = useState("#eceaf0");
  const [penWidth, setPenWidth] = useState(3);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; screenX: number; screenY: number } | null>(null);
  const [shuffleUnlockedOnly, setShuffleUnlockedOnly] = useState(false);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [customRows, setCustomRows] = useState("");
  const [customCols, setCustomCols] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [shuffleSettings, setShuffleSettings] = useState<ShuffleSettings>(DEFAULT_SHUFFLE_SETTINGS);
  const [presentationSettings, setPresentationSettings] = useState<PresentationSettings>(DEFAULT_PRESENTATION_SETTINGS);
  const [presenting, setPresenting] = useState(false);
  const [exportFilename, setExportFilename] = useState("board");
  const [exportScale, setExportScale] = useState<1 | 2 | 3 | 4>(2);
  const [exportTransparent, setExportTransparent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [videoResolution, setVideoResolution] = useState<VideoResolution>("1080p");
  const [videoFps, setVideoFps] = useState<24 | 30 | 60>(30);
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const lastCursorSentRef = useRef(0);
  const clipboardRef = useRef<NoteNode[]>([]);

  const { nodes, setNodes, status, synced, presence, settings, updateSettings, setCursor, undo, redo } = useYjsBoard<NoteNode>(
    boardId,
    user?.name ?? "Someone"
  );

  const nodesRef = useRef<NoteNode[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const gridMetrics: GridMetrics = useMemo(
    () =>
      computeMetrics({
        width: settings.gridCanvasWidth,
        height: settings.gridCanvasHeight,
        cols: settings.gridCols,
        rows: settings.gridRowCount,
        hGap: settings.gridGapX,
        vGap: settings.gridGapY,
        outerPadding: settings.gridOuterPadding,
      }),
    [
      settings.gridCanvasWidth,
      settings.gridCanvasHeight,
      settings.gridCols,
      settings.gridRowCount,
      settings.gridGapX,
      settings.gridGapY,
      settings.gridOuterPadding,
    ]
  );

  function spanOf(n: NoteNode): CellSpan {
    return { col1: n.gridCol1 ?? 0, row1: n.gridRow1 ?? 0, col2: n.gridCol2 ?? (n.gridCol1 ?? 0) + 1, row2: n.gridRow2 ?? (n.gridRow1 ?? 0) + 1 };
  }

  const [gridDraggingId, setGridDraggingId] = useState<string | null>(null);
  // Dashed outline showing where a grid drag/resize will land. Ref holds the span a live resize
  // gesture last previewed, so the end event can commit it (that event carries no position delta).
  const [gridPreview, setGridPreview] = useState<CellSpan | null>(null);
  const resizePreviewRef = useRef<{ id: string; span: CellSpan } | null>(null);

  // In Grid canvas mode, a note's position/size is DERIVED from its cell span + the shared cell
  // metrics, not stored directly — every cell is the exact same size (Bento Studio's model, not a
  // resizable-table model), so there's nothing to keep in sync, just arithmetic. The dragged note keeps
  // its live raw position so the drag still feels responsive; every other note snaps to its cell rect.
  const displayNodes = useMemo(() => {
    if (!settings.gridMode) return nodes;
    const W = settings.gridCanvasWidth;
    const H = settings.gridCanvasHeight;
    // Keeps a note inside the canvas DURING the drag, not just snapped back after it. React Flow
    // clamps the node's whole BOX against this extent (not its top-left corner), so it must be the
    // plain canvas rect — subtracting the node's own size here double-counts it and shoves tall
    // notes far outside (a 1416-tall note landed at y = (H-h)-h = -1332).
    const canvasExtent: CoordinateExtent = [
      [0, 0],
      [W, H],
    ];
    return nodes.map((n) => {
      // Exempt from cell-snapping only while BOTH our own drag state and React Flow's `dragging`
      // flag agree — relying on either alone leaves a note stranded at a raw position if that one
      // goes stale (e.g. a pointerup swallowed by image adjust mode). Its raw position is clamped
      // regardless, so even a stale flag can't render a note outside the canvas.
      if (n.id === gridDraggingId && n.dragging) {
        const w = n.width ?? 0;
        const h = n.height ?? 0;
        return {
          ...n,
          position: {
            x: Math.max(0, Math.min(Math.max(0, W - w), n.position.x)),
            y: Math.max(0, Math.min(Math.max(0, H - h), n.position.y)),
          },
          extent: canvasExtent,
        };
      }
      const rect = spanToRect(spanOf(n), gridMetrics);
      return {
        ...n,
        position: { x: rect.x, y: rect.y },
        width: rect.w,
        height: rect.h,
        extent: canvasExtent,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, settings.gridMode, gridMetrics, gridDraggingId, settings.gridCanvasWidth, settings.gridCanvasHeight]);

  // Safety net: the dragged note is the one node exempt from cell-snapping, so if React Flow's
  // onNodeDragStop never fires (e.g. the pointerup is swallowed by a handler that stops propagation,
  // like image adjust mode) the note would stay floating outside the grid on top of its neighbours.
  // A global pointerup guarantees it always falls back into a cell.
  useEffect(() => {
    if (!gridDraggingId) return;
    // Deferred a tick so React Flow's own onNodeDragStop (which performs the cell swap) still runs
    // first on the same pointerup; this only takes effect when that never arrived.
    const clear = () => {
      setTimeout(() => {
        setGridDraggingId(null);
        setGridPreview(null);
      }, 0);
    };
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, [gridDraggingId]);

  // A brand-new grid board opens on the default bento starter instead of an empty canvas. Guarded by
  // a ref so emptying the board yourself doesn't immediately regenerate it.
  const gridSeededRef = useRef<number | null>(null);
  useEffect(() => {
    if (!settings.gridMode || !synced) return;
    if (gridSeededRef.current === boardId) return;
    if (nodes.length > 0) {
      gridSeededRef.current = boardId;
      return;
    }
    const spans = shuffleGridLayout(settings.gridCols, settings.gridRowCount, DEFAULT_GRID_TEMPLATE.cfg, {
      seed: DEFAULT_GRID_TEMPLATE.seed,
    });
    gridSeededRef.current = boardId;
    setNodes(
      spans.map((span) => ({
        id: crypto.randomUUID(),
        type: "imageNote" as const,
        position: { x: 0, y: 0 },
        width: 160,
        height: 160,
        data: { url: null },
        gridCol1: span.col1,
        gridRow1: span.row1,
        gridCol2: span.col2,
        gridRow2: span.row2,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.gridMode, synced, boardId, nodes.length]);

  // Frame the whole canvas (including its outer padding) when a grid board opens, so you land on the
  // full composition rather than wherever the viewport happened to be.
  const gridFittedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!settings.gridMode || !synced) return;
    if (gridFittedRef.current === boardId) return;
    gridFittedRef.current = boardId;
    const t = setTimeout(
      () => fitBounds({ x: 0, y: 0, width: settings.gridCanvasWidth, height: settings.gridCanvasHeight }, { padding: 0.08, duration: 300 }),
      120
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.gridMode, synced, boardId]);

  // Changing the column/row count re-partitions the grid: the old spans no longer tile it (and may
  // even fall outside it), so re-split into exactly as many spans as there are notes. Content is
  // preserved — only the spans change — and the grid stays completely filled.
  const gridShapeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settings.gridMode || !synced) return;
    const shape = `${settings.gridCols}x${settings.gridRowCount}`;
    const prev = gridShapeRef.current;
    gridShapeRef.current = shape;
    if (prev === null || prev === shape) return;
    if (nodesRef.current.length === 0) return;

    const spans = shuffleGridLayout(settings.gridCols, settings.gridRowCount, DEFAULT_GRID_TEMPLATE.cfg, {
      seed: shuffleSettings.seed,
      targetCount: nodesRef.current.length,
    });
    setNodes((nds) =>
      nds.map((n, i) => {
        const span = spans[i];
        return span ? { ...n, gridCol1: span.col1, gridRow1: span.row1, gridCol2: span.col2, gridRow2: span.row2 } : n;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.gridMode, synced, settings.gridCols, settings.gridRowCount]);

  // Whenever grid mode is on, give a cell to any note that doesn't have one yet. Empty cells are left
  // EMPTY — bento shows dashed guide outlines there and only creates boxes on draw/drop/template/
  // shuffle, so auto-populating every cell (which this used to do) produced a wall of identical
  // placeholders instead of a bento layout.
  useEffect(() => {
    if (!settings.gridMode) return;
    const cols = settings.gridCols;
    const rows = settings.gridRowCount;

    const unassigned = nodes.filter((n) => n.gridCol1 === undefined || n.gridRow1 === undefined);
    if (!unassigned.length) return;

    const occupied: CellSpan[] = nodes.filter((n) => n.gridCol1 !== undefined && n.gridRow1 !== undefined).map(spanOf);
    const assignments = new Map<string, CellSpan>();
    for (const n of unassigned) {
      const span = findFreeSpan(occupied, cols, rows);
      if (span.row1 >= rows) continue; // grid is genuinely full — leave this note unassigned rather than overflow
      assignments.set(n.id, span);
      occupied.push(span);
    }

    if (!assignments.size) return;
    setNodes((nds) =>
      nds.map((n) => {
        const span = assignments.get(n.id);
        return span ? { ...n, gridCol1: span.col1, gridRow1: span.row1, gridCol2: span.col2, gridRow2: span.row2 } : n;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.gridMode, settings.gridCols, settings.gridRowCount, nodes.length]);

  const updateShuffleSettings = useCallback((update: Partial<ShuffleSettings>) => {
    setShuffleSettings((prev) => ({ ...prev, ...update }));
  }, []);

  const updatePresentationSettings = useCallback((update: Partial<PresentationSettings>) => {
    setPresentationSettings((prev) => ({ ...prev, ...update }));
  }, []);

  const handleExportImage = useCallback(async () => {
    const viewportEl = canvasWrapperRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewportEl) return;
    setExporting(true);
    try {
      await exportBoardImage(viewportEl, nodes, {
        scale: exportScale,
        transparent: exportTransparent,
        filename: exportFilename,
      });
      setToast("Exported PNG");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [nodes, exportScale, exportTransparent, exportFilename]);

  const handleExportVideo = useCallback(async () => {
    setVideoExporting(true);
    setVideoProgress(0);
    try {
      await exportBoardVideo(
        nodes,
        presentationSettings,
        { resolution: videoResolution, fps: videoFps, filename: exportFilename },
        setVideoProgress
      );
      setToast("Exported video");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Video export failed");
    } finally {
      setVideoExporting(false);
      setVideoProgress(0);
    }
  }, [nodes, presentationSettings, videoResolution, videoFps, exportFilename]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const handleShuffle = useCallback(() => {
    const target = shuffleUnlockedOnly ? nodes.filter((n) => n.draggable !== false) : nodes;

    // Grid canvas mode shuffles in CELL space: split the grid into balanced spans, then re-assign
    // notes to them. On an empty board the density setting decides how many boxes to generate (and
    // empty image placeholders are created to fill them, like bento); with notes already present the
    // count matches the notes so nothing of the user's is created or destroyed.
    if (settings.gridMode) {
      const cols = settings.gridCols;
      const rows = settings.gridRowCount;
      const lockedSpans = shuffleUnlockedOnly ? nodes.filter((n) => n.draggable === false).map(spanOf) : [];
      const cfg = {
        density: shuffleSettings.density,
        symmetry: shuffleSettings.symmetry,
        heroSize: shuffleSettings.heroSize,
        minCols: shuffleSettings.minCols,
        minRows: shuffleSettings.minRows,
        orientation: shuffleSettings.orientation,
      };
      const leaves = shuffleGridLayout(cols, rows, cfg, {
        seed: shuffleSettings.seed,
        lockedSpans,
        targetCount: target.length > 0 ? target.length : undefined,
      });
      if (!leaves.length) {
        setToast("No room left to shuffle into");
        return;
      }

      const targetIds = new Set(target.map((n) => n.id));
      const extras: NoteNode[] = leaves.slice(target.length).map((span) => ({
        id: crypto.randomUUID(),
        type: "imageNote" as const,
        position: { x: 0, y: 0 },
        width: 160,
        height: 160,
        data: { url: null },
        gridCol1: span.col1,
        gridRow1: span.row1,
        gridCol2: span.col2,
        gridRow2: span.row2,
      }));

      setNodes((nds) => {
        const reassigned = nds.map((n) => {
          if (!targetIds.has(n.id)) return n;
          const span = leaves[target.findIndex((t) => t.id === n.id)];
          if (!span) return n;
          return { ...n, gridCol1: span.col1, gridRow1: span.row1, gridCol2: span.col2, gridRow2: span.row2 };
        });
        return extras.length ? [...reassigned, ...extras] : reassigned;
      });
      setToast(`Generated ${leaves.length} balanced box${leaves.length === 1 ? "" : "es"}`);
      return;
    }

    if (target.length < 2) {
      setToast(shuffleUnlockedOnly ? "Need at least 2 unlocked notes to shuffle" : "Add at least 2 notes to shuffle");
      return;
    }
    const area = computeLayoutArea(target, shuffleSettings.minWidth, shuffleSettings.minHeight);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const leaves = generateShuffleLayout(area, target.length, shuffleSettings, seed);
    const inset = insetRectsUniformly(leaves, shuffleSettings.spacing);
    const targetIds = new Set(target.map((n) => n.id));

    setNodes((nds) =>
      nds.map((n) => {
        if (!targetIds.has(n.id)) return n;
        const idx = target.findIndex((t) => t.id === n.id);
        const r = inset[idx];
        if (!r) return n;
        return { ...n, position: { x: r.x1, y: r.y1 }, width: r.x2 - r.x1, height: r.y2 - r.y1 };
      })
    );
    setToast(
      shuffleUnlockedOnly
        ? `Shuffled ${target.length} unlocked note${target.length === 1 ? "" : "s"}, locked notes stayed put`
        : `Shuffled ${target.length} notes into a new layout`
    );
  }, [nodes, setNodes, shuffleSettings, shuffleUnlockedOnly, settings.gridMode, settings.gridCols, settings.gridRowCount]);

  const handleApplyTemplate = useCallback(
    (templateId: TemplateId) => {
      if (nodes.length < 1) return;
      const area = computeLayoutArea(nodes, shuffleSettings.minWidth, shuffleSettings.minHeight);
      const fracs = templateRectsForCount(templateId, nodes.length);
      const rects = fracs.map((f) => fracRectToArea(f, area));
      const inset = insetRectsUniformly(rects, shuffleSettings.spacing);

      setNodes((nds) =>
        nds.map((n, i) => {
          const r = inset[i];
          if (!r) return n;
          return { ...n, position: { x: r.x1, y: r.y1 }, width: r.x2 - r.x1, height: r.y2 - r.y1 };
        })
      );
      const tpl = TEMPLATES.find((t) => t.id === templateId);
      setToast(`Applied "${tpl?.name ?? templateId}" to ${Math.min(rects.length, nodes.length)} notes`);
    },
    [nodes, setNodes, shuffleSettings]
  );

  // Notes arranged via Shuffle/Templates/Grid sit `shuffleSettings.spacing` px apart (insetRect), not
  // touching at 0px, so the "are these edges touching" check needs enough slack to still catch a
  // normal gap — too tight and grid-arranged neighbors never trigger the auto-adjust below.
  const tileResizeTolerance = Math.max(10, Math.min(20, shuffleSettings.spacing + 6));

  const onNodesChange = useCallback(
    (changes: NodeChange<NoteNode>[]) => {
      if (settings.gridMode) {
        // Grid resize is previewed, not applied, while the gesture runs: the box stays put and a
        // dashed outline shows the cells it will take, then it commits on release. Applying every
        // cell-step live made the box jump around under the cursor.
        const dimChanges = changes.filter(
          (c): c is Extract<NodeChange<NoteNode>, { type: "dimensions" }> => c.type === "dimensions"
        );
        const passthrough = changes.filter((c) => c.type !== "dimensions");
        if (passthrough.length) setNodes((nds) => applyNodeChanges(passthrough, nds));
        if (!dimChanges.length) return;

        const posById = new Map<string, { x: number; y: number }>();
        for (const c of changes) if (c.type === "position" && c.position) posById.set(c.id, c.position);

        const live = nodesRef.current;
        const spanUpdates = new Map<string, CellSpan>();
        const absorbedIds = new Set<string>();
        let previewSpan: CellSpan | null = null;
        let gestureEnded = false;

        for (const change of dimChanges) {
          // Only a live resize gesture carries a `resizing` flag. React Flow also emits dimension
          // changes for its own initial DOM measurement, and treating those as a resize shrank
          // multi-cell boxes on mount (a 4-wide box measured pre-layout reads as -3 cells).
          if (change.resizing === undefined) continue;

          if (change.resizing === false) {
            // The end event carries no position change, so a west/north drag would look like an
            // east/south one here — commit whatever the gesture last previewed instead.
            gestureEnded = true;
            const pending = resizePreviewRef.current;
            if (pending && pending.id === change.id) {
              const others = live.filter((n) => n.id !== change.id).map((n) => [n.id, spanOf(n)] as const);
              const collisions = others.filter(([, sp]) => spansOverlap(pending.span, sp));
              if (!collisions.some(([, sp]) => !spanContains(pending.span, sp))) {
                for (const [id] of collisions) absorbedIds.add(id);
                spanUpdates.set(change.id, pending.span);
              }
            }
            resizePreviewRef.current = null;
            continue;
          }

          const before = live.find((n) => n.id === change.id);
          const newDims = change.dimensions;
          if (!before || !newDims || before.gridCol1 === undefined) continue;

          const span = spanOf(before);
          const oldRect = spanToRect(span, gridMetrics);
          const pos = posById.get(change.id) ?? { x: oldRect.x, y: oldRect.y };
          const dLeft = pos.x - oldRect.x;
          const dTop = pos.y - oldRect.y;
          const dRight = pos.x + newDims.width - (oldRect.x + oldRect.w);
          const dBottom = pos.y + newDims.height - (oldRect.y + oldRect.h);

          let dir: ResizeDir | null = null;
          let deltaPx = 0;
          let cellSize = 0;
          let gap = 0;
          if (Math.abs(dLeft) > 0.5 && Math.abs(dLeft) >= Math.abs(dRight)) {
            dir = "w";
            deltaPx = dLeft;
            cellSize = gridMetrics.cellW;
            gap = gridMetrics.hGap;
          } else if (Math.abs(dRight) > 0.5) {
            dir = "e";
            deltaPx = dRight;
            cellSize = gridMetrics.cellW;
            gap = gridMetrics.hGap;
          } else if (Math.abs(dTop) > 0.5 && Math.abs(dTop) >= Math.abs(dBottom)) {
            dir = "n";
            deltaPx = dTop;
            cellSize = gridMetrics.cellH;
            gap = gridMetrics.vGap;
          } else if (Math.abs(dBottom) > 0.5) {
            dir = "s";
            deltaPx = dBottom;
            cellSize = gridMetrics.cellH;
            gap = gridMetrics.vGap;
          }
          if (!dir) continue;

          const deltaCells = Math.round(deltaPx / (cellSize + gap));
          const candidate = resizeSpan(span, dir, deltaCells, settings.gridCols, settings.gridRowCount);

          // Growing over a neighbour ABSORBS it (bento blocks instead, but with the grid filled
          // edge-to-edge that would make every resize a no-op). A neighbour only gets swallowed once
          // it is FULLY inside the new span — a partial overlap still blocks.
          const others = live.filter((n) => n.id !== change.id).map((n) => spanOf(n));
          if (others.some((sp) => spansOverlap(candidate, sp) && !spanContains(candidate, sp))) continue;

          resizePreviewRef.current = { id: change.id, span: candidate };
          previewSpan = candidate;
        }

        if (previewSpan) setGridPreview(previewSpan);
        else if (gestureEnded) setGridPreview(null);

        if (spanUpdates.size || absorbedIds.size) {
          setNodes((nds) => {
            const kept = absorbedIds.size ? nds.filter((n) => !absorbedIds.has(n.id)) : nds;
            return kept.map((n) => {
              const sp = spanUpdates.get(n.id);
              return sp ? { ...n, gridCol1: sp.col1, gridRow1: sp.row1, gridCol2: sp.col2, gridRow2: sp.row2 } : n;
            });
          });
        }
        return;
      }

      setNodes((nds) => {
        const beforeMap = new Map(nds.map((n) => [n.id, n]));

        let next = applyNodeChanges(changes, nds);

        const dimChanges = changes.filter(
          (c): c is Extract<NodeChange<NoteNode>, { type: "dimensions" }> => c.type === "dimensions"
        );
        if (!dimChanges.length) return next;

        for (const change of dimChanges) {
          const before = beforeMap.get(change.id);
          const after = next.find((n) => n.id === change.id);
          if (!before || !after) continue;

          const oldRect = { x: before.position.x, y: before.position.y, w: before.width ?? 200, h: before.height ?? 150 };
          const newRect = { x: after.position.x, y: after.position.y, w: after.width ?? 200, h: after.height ?? 150 };

          const rects = new Map(next.map((n) => [n.id, { x: n.position.x, y: n.position.y, w: n.width ?? 200, h: n.height ?? 150 }]));
          const { resizedRect, updates } = computeTileNeighborAdjustments(rects, change.id, oldRect, newRect, { tolerance: tileResizeTolerance });
          next = next.map((n) => {
            if (n.id === change.id) {
              return { ...n, position: { x: resizedRect.x, y: resizedRect.y }, width: resizedRect.w, height: resizedRect.h };
            }
            const u = updates.get(n.id);
            return u ? { ...n, position: { x: u.x, y: u.y }, width: u.w, height: u.h } : n;
          });
        }

        return next;
      });
    },
    [setNodes, tileResizeTolerance, settings.gridMode, settings.gridCols, settings.gridRowCount, gridMetrics]
  );

  const [selectedImageNoteId, setSelectedImageNoteId] = useState<string | null>(null);
  const onSelectionChange = useCallback(({ nodes: selected }: { nodes: NoteNode[] }) => {
    const img = selected.find((n) => n.type === "imageNote");
    setSelectedImageNoteId(img ? img.id : null);
  }, []);
  const selectedImageNote = nodes.find((n) => n.id === selectedImageNoteId && n.type === "imageNote") as
    | Node<ImageNoteData, "imageNote">
    | undefined;

  const updateImageTransform = useCallback(
    (update: Partial<MediaTransform>) => {
      if (!selectedImageNoteId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedImageNoteId && n.type === "imageNote"
            ? { ...n, data: { ...n.data, transform: { ...DEFAULT_MEDIA_TRANSFORM, ...n.data.transform, ...update } } }
            : n
        )
      );
    },
    [selectedImageNoteId, setNodes]
  );

  const selectedShapeNotes = nodes.filter((n): n is Node<ShapeNoteData, "shapeNote"> => n.type === "shapeNote" && !!n.selected);
  const selectedCount = nodes.filter((n) => n.selected).length;

  const patchSelectedShapes = useCallback(
    (update: Partial<ShapeNoteData>) => {
      const ids = new Set(selectedShapeNotes.map((n) => n.id));
      setNodes((nds) => nds.map((n) => (n.type === "shapeNote" && ids.has(n.id) ? { ...n, data: { ...n.data, ...update } } : n)));
    },
    [selectedShapeNotes, setNodes]
  );

  const uploadShapeImage = useCallback(
    (file: File) => {
      api
        .uploadFile(file)
        .then(({ url }) => patchSelectedShapes({ image: url }))
        .catch(() => setToast("Image upload failed"));
    },
    [patchSelectedShapes]
  );

  const viewportCenterFlow = useCallback(() => {
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    return screenToFlowPosition({ x: cx, y: cy });
  }, [screenToFlowPosition]);

  const viewportCenterPosition = useCallback(() => {
    const jitterX = (Math.random() - 0.5) * 60;
    const jitterY = (Math.random() - 0.5) * 60;
    const base = viewportCenterFlow();
    return { x: base.x - 100 + jitterX, y: base.y - 70 + jitterY };
  }, [viewportCenterFlow]);

  useEffect(() => {
    let cancelled = false;
    api
      .getBoard(boardId)
      .then((b) => {
        if (cancelled) return;
        setBoard(b);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load this board"));
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  const cloneNode = useCallback((n: NoteNode, offset: number): NoteNode => {
    return {
      ...n,
      id: crypto.randomUUID(),
      position: { x: n.position.x + offset, y: n.position.y + offset },
      selected: true,
      data: JSON.parse(JSON.stringify(n.data)),
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      const inField = activeTag === "input" || activeTag === "textarea";

      if (e.key === "Escape") {
        setPendingDraw(null);
        setContextMenu(null);
        closeSearch();
        if (!inField) setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (inField) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if (mod && key === "a") {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
        return;
      }

      if (mod && key === "c") {
        const selected = nodesRef.current.filter((n) => n.selected);
        if (selected.length) {
          clipboardRef.current = selected.map((n) => JSON.parse(JSON.stringify(n)));
          setToast(`Copied ${selected.length} note${selected.length === 1 ? "" : "s"}`);
        }
        return;
      }

      if (mod && (key === "v" || key === "d")) {
        e.preventDefault();
        const isDuplicate = key === "d";
        const source = isDuplicate ? nodesRef.current.filter((n) => n.selected) : clipboardRef.current;
        if (!source.length) return;
        const clones = source.map((n) => cloneNode(n, 24));
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...clones]);
        setToast(isDuplicate ? `Duplicated ${clones.length} note${clones.length === 1 ? "" : "s"}` : `Pasted ${clones.length} note${clones.length === 1 ? "" : "s"}`);
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!nodesRef.current.some((n) => n.selected && n.draggable !== false)) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setNodes((nds) =>
          nds.map((n) =>
            n.selected && n.draggable !== false ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n
          )
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, setNodes, cloneNode, closeSearch]);

  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const dragAxisRef = useRef<"x" | "y" | null>(null);

  const onNodeDragStart = useCallback(
    (event: { altKey?: boolean }, node: NoteNode) => {
      if (settings.gridMode) {
        setGridDraggingId(node.id);
        return;
      }

      if (event.altKey) {
        const clone = cloneNode(node, 0);
        clone.selected = false;
        setNodes((nds) => [...nds, clone]);
      }

      dragAnchorRef.current = { x: node.position.x, y: node.position.y };
      dragAxisRef.current = null;
      const snapshot = new Map<string, { x: number; y: number }>();
      const moving = nodesRef.current.filter((n) => n.selected && n.draggable !== false);
      for (const n of moving.length ? moving : [node]) {
        snapshot.set(n.id, { x: n.position.x, y: n.position.y });
      }
      snapshot.set(node.id, { x: node.position.x, y: node.position.y });
      dragStartPositionsRef.current = snapshot;
    },
    [setNodes, cloneNode, settings.gridMode]
  );

  const AXIS_LOCK_THRESHOLD = 4;

  const onNodeDrag = useCallback(
    (event: { shiftKey?: boolean }, node: NoteNode) => {
      if (settings.gridMode) {
        const m = gridMetrics;
        const mySpan = spanOf(node);
        const centerX = node.position.x + (node.width ?? 0) / 2;
        const centerY = node.position.y + (node.height ?? 0) / 2;
        const w = mySpan.col2 - mySpan.col1;
        const h = mySpan.row2 - mySpan.row1;
        const col = Math.max(0, Math.min(settings.gridCols - w, Math.round((centerX - m.pad) / (m.cellW + m.hGap))));
        const row = Math.max(0, Math.min(settings.gridRowCount - h, Math.round((centerY - m.pad) / (m.cellH + m.vGap))));
        setGridPreview({ col1: col, row1: row, col2: col + w, row2: row + h });
        return;
      }
      const anchor = dragAnchorRef.current;
      const starts = dragStartPositionsRef.current;
      if (!anchor || !starts.size) return;

      if (!event.shiftKey) {
        dragAxisRef.current = null;
        return;
      }

      const dx = node.position.x - anchor.x;
      const dy = node.position.y - anchor.y;

      if (!dragAxisRef.current) {
        if (Math.abs(dx) < AXIS_LOCK_THRESHOLD && Math.abs(dy) < AXIS_LOCK_THRESHOLD) return;
        dragAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }

      const axis = dragAxisRef.current;
      const lockedDx = axis === "x" ? dx : 0;
      const lockedDy = axis === "y" ? dy : 0;

      setNodes((nds) =>
        nds.map((n) => {
          const start = starts.get(n.id);
          if (!start) return n;
          return { ...n, position: { x: start.x + lockedDx, y: start.y + lockedDy } };
        })
      );
    },
    [setNodes, settings.gridMode, gridMetrics, settings.gridCols, settings.gridRowCount]
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, node: NoteNode) => {
      if (settings.gridMode) {
        setGridDraggingId(null);
        setGridPreview(null);
        const m = gridMetrics;
        const centerX = node.position.x + (node.width ?? 0) / 2;
        const centerY = node.position.y + (node.height ?? 0) / 2;
        const targetCol = Math.max(0, Math.min(settings.gridCols - 1, Math.round((centerX - m.pad) / (m.cellW + m.hGap))));
        const targetRow = Math.max(0, Math.min(settings.gridRowCount - 1, Math.round((centerY - m.pad) / (m.cellH + m.vGap))));
        const targetCell: CellSpan = { col1: targetCol, row1: targetRow, col2: targetCol + 1, row2: targetRow + 1 };
        const mySpan = spanOf(node);
        if (targetCol === mySpan.col1 && targetRow === mySpan.row1) return;

        setNodes((nds) => {
          const dragged = nds.find((n) => n.id === node.id);
          const occupant = nds.find((n) => n.id !== node.id && spansOverlap(spanOf(n), targetCell));

          // Content-only swap trades the two notes' CONTENT and leaves both spans where they are, so
          // the layout you composed stays put while the media moves (bento's contentOnlySwap toggle).
          if (settings.contentOnlySwap && dragged && occupant) {
            return nds.map((n) => {
              if (n.id === dragged.id) return { ...n, type: occupant.type, data: occupant.data } as NoteNode;
              if (n.id === occupant.id) return { ...n, type: dragged.type, data: dragged.data } as NoteNode;
              return n;
            });
          }

          return nds.map((n) => {
            if (n.id === node.id) {
              const shift = { col1: targetCol, row1: targetRow, col2: targetCol + (mySpan.col2 - mySpan.col1), row2: targetRow + (mySpan.row2 - mySpan.row1) };
              return { ...n, gridCol1: shift.col1, gridRow1: shift.row1, gridCol2: shift.col2, gridRow2: shift.row2 };
            }
            if (occupant && n.id === occupant.id) {
              return { ...n, gridCol1: mySpan.col1, gridRow1: mySpan.row1, gridCol2: mySpan.col2, gridRow2: mySpan.row2 };
            }
            return n;
          });
        });
        return;
      }
      dragAnchorRef.current = null;
      dragAxisRef.current = null;
      dragStartPositionsRef.current = new Map();
    },
    [settings.gridMode, gridMetrics, settings.gridCols, settings.gridRowCount, settings.contentOnlySwap, setNodes]
  );

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: NoteNode) => {
    event.preventDefault();
    setContextMenu({ nodeId: node.id, screenX: event.clientX, screenY: event.clientY });
  }, []);

  const contextNode = nodes.find((n) => n.id === contextMenu?.nodeId);

  // Same actions as the right-click menu, but addressed by id — these back the per-note hover toolbar.
  const noteActions = useMemo<NoteActions>(
    () => ({
      onReplaceMedia: (id) => {
        const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"] .image-note-dropzone, .react-flow__node[data-id="${id}"] .image-note-replace`);
        if (el) el.click();
        else setToast("Only image notes can hold media");
      },
      onToggleLock: (id) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, draggable: n.draggable === false } : n))),
      onDuplicate: (id) => {
        const node = nodesRef.current.find((n) => n.id === id);
        if (!node) return;
        const clone = cloneNode(node, 24);
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), clone]);
      },
      onDelete: (id) => setNodes((nds) => nds.filter((n) => n.id !== id)),
    }),
    [setNodes, cloneNode]
  );

  const toggleLockContextNode = useCallback(() => {
    if (!contextMenu) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === contextMenu.nodeId ? { ...n, draggable: n.draggable === false } : n))
    );
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  const setContextNodeTag = useCallback(
    (color: string | undefined) => {
      if (!contextMenu) return;
      setNodes((nds) => nds.map((n) => (n.id === contextMenu.nodeId ? { ...n, tagColor: color } : n)));
      setContextMenu(null);
    },
    [contextMenu, setNodes]
  );

  const duplicateContextNode = useCallback(() => {
    if (!contextMenu) return;
    const node = nodesRef.current.find((n) => n.id === contextMenu.nodeId);
    if (!node) return;
    const clone = cloneNode(node, 24);
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), clone]);
    setContextMenu(null);
  }, [contextMenu, cloneNode, setNodes]);

  const deleteContextNode = useCallback(() => {
    if (!contextMenu) return;
    setNodes((nds) => nds.filter((n) => n.id !== contextMenu.nodeId));
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  // z-order: React Flow stacks nodes by array order, later = on top, so these just reorder `nodes`.
  const bringToFront = useCallback(() => {
    if (!contextMenu) return;
    const { nodeId } = contextMenu;
    setNodes((nds) => {
      const idx = nds.findIndex((n) => n.id === nodeId);
      if (idx < 0 || idx === nds.length - 1) return nds;
      const copy = nds.slice();
      const [item] = copy.splice(idx, 1);
      copy.push(item);
      return copy;
    });
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  const sendToBack = useCallback(() => {
    if (!contextMenu) return;
    const { nodeId } = contextMenu;
    setNodes((nds) => {
      const idx = nds.findIndex((n) => n.id === nodeId);
      if (idx <= 0) return nds;
      const copy = nds.slice();
      const [item] = copy.splice(idx, 1);
      copy.unshift(item);
      return copy;
    });
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  const bringForward = useCallback(() => {
    if (!contextMenu) return;
    const { nodeId } = contextMenu;
    setNodes((nds) => {
      const idx = nds.findIndex((n) => n.id === nodeId);
      if (idx < 0 || idx === nds.length - 1) return nds;
      const copy = nds.slice();
      [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
      return copy;
    });
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  const sendBackward = useCallback(() => {
    if (!contextMenu) return;
    const { nodeId } = contextMenu;
    setNodes((nds) => {
      const idx = nds.findIndex((n) => n.id === nodeId);
      if (idx <= 0) return nds;
      const copy = nds.slice();
      [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]];
      return copy;
    });
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  type AlignMode = "left" | "centerH" | "right" | "top" | "middleV" | "bottom";

  const alignSelected = useCallback(
    (mode: AlignMode) => {
      const selected = nodes.filter((n) => n.selected);
      if (selected.length < 2) return;
      const minX = Math.min(...selected.map((n) => n.position.x));
      const minY = Math.min(...selected.map((n) => n.position.y));
      const maxX = Math.max(...selected.map((n) => n.position.x + (n.width ?? 200)));
      const maxY = Math.max(...selected.map((n) => n.position.y + (n.height ?? 150)));
      const ids = new Set(selected.map((n) => n.id));

      setNodes((nds) =>
        nds.map((n) => {
          if (!ids.has(n.id)) return n;
          const w = n.width ?? 200;
          const h = n.height ?? 150;
          let x = n.position.x;
          let y = n.position.y;
          if (mode === "left") x = minX;
          else if (mode === "centerH") x = (minX + maxX) / 2 - w / 2;
          else if (mode === "right") x = maxX - w;
          else if (mode === "top") y = minY;
          else if (mode === "middleV") y = (minY + maxY) / 2 - h / 2;
          else if (mode === "bottom") y = maxY - h;
          return { ...n, position: { x, y } };
        })
      );
    },
    [nodes, setNodes]
  );

  const distributeSelected = useCallback(
    (axis: "horizontal" | "vertical") => {
      const selected = nodes.filter((n) => n.selected);
      if (selected.length < 3) return;

      if (axis === "horizontal") {
        const sorted = selected.slice().sort((a, b) => a.position.x - b.position.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const span = last.position.x + (last.width ?? 200) - first.position.x;
        const totalWidth = sorted.reduce((s, n) => s + (n.width ?? 200), 0);
        const gap = (span - totalWidth) / (sorted.length - 1);
        const updates = new Map<string, number>();
        let cursor = first.position.x;
        for (const n of sorted) {
          updates.set(n.id, cursor);
          cursor += (n.width ?? 200) + gap;
        }
        setNodes((nds) => nds.map((n) => (updates.has(n.id) ? { ...n, position: { x: updates.get(n.id)!, y: n.position.y } } : n)));
      } else {
        const sorted = selected.slice().sort((a, b) => a.position.y - b.position.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const span = last.position.y + (last.height ?? 150) - first.position.y;
        const totalHeight = sorted.reduce((s, n) => s + (n.height ?? 150), 0);
        const gap = (span - totalHeight) / (sorted.length - 1);
        const updates = new Map<string, number>();
        let cursor = first.position.y;
        for (const n of sorted) {
          updates.set(n.id, cursor);
          cursor += (n.height ?? 150) + gap;
        }
        setNodes((nds) => nds.map((n) => (updates.has(n.id) ? { ...n, position: { x: n.position.x, y: updates.get(n.id)! } } : n)));
      }
    },
    [nodes, setNodes]
  );

  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [contextMenu]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((n) => noteSearchText(n).toLowerCase().includes(q));
  }, [nodes, searchQuery]);

  useEffect(() => {
    setSearchMatchIndex(0);
  }, [searchQuery]);

  const goToMatch = useCallback(
    (index: number) => {
      const match = searchMatches[index];
      if (!match) return;
      const w = match.width ?? 200;
      const h = match.height ?? 120;
      setCenter(match.position.x + w / 2, match.position.y + h / 2, { zoom: 1, duration: 400 });
    },
    [searchMatches, setCenter]
  );

  useEffect(() => {
    if (searchMatches.length > 0) goToMatch(searchMatchIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMatchIndex, searchMatches.length]);

  const chromeMap = useMemo(() => {
    const map = new Map<string, NoteChromeInfo>();
    const currentMatchId = searchMatches[searchMatchIndex]?.id;
    nodes.forEach((n, i) => {
      const isMatch = searchQuery.trim().length > 0 && searchMatches.some((m) => m.id === n.id);
      const gridLabel =
        settings.gridMode && settings.boxLabels
          ? `${i + 1} · ${(n.gridCol2 ?? 1) - (n.gridCol1 ?? 0)}x${(n.gridRow2 ?? 1) - (n.gridRow1 ?? 0)}`
          : undefined;
      if (n.draggable === false || n.tagColor || isMatch || gridLabel) {
        map.set(n.id, {
          tagColor: n.tagColor,
          locked: n.draggable === false,
          matched: isMatch,
          current: isMatch && n.id === currentMatchId,
          gridLabel,
        });
      }
    });
    return map;
  }, [nodes, searchMatches, searchMatchIndex, searchQuery, settings.gridMode, settings.boxLabels]);

  const addTextNote = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      { id: crypto.randomUUID(), type: "textNote", position: viewportCenterPosition(), width: 220, height: 140, data: { text: "" } },
    ]);
  }, [setNodes, viewportCenterPosition]);

  const addImageNote = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      { id: crypto.randomUUID(), type: "imageNote", position: viewportCenterPosition(), width: 220, height: 160, data: { url: null } },
    ]);
  }, [setNodes, viewportCenterPosition]);

  const addLinkNote = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "linkNote",
        position: viewportCenterPosition(),
        width: 240,
        height: 140,
        data: { url: "", title: null, description: null, image: null, loading: false, error: null },
      },
    ]);
  }, [setNodes, viewportCenterPosition]);

  const addChecklistNote = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "checklistNote",
        position: viewportCenterPosition(),
        width: 240,
        height: 200,
        data: { title: "", items: [] },
      },
    ]);
  }, [setNodes, viewportCenterPosition]);

  const arrangeIntoGrid = useCallback(
    (rows: number, cols: number) => {
      const r = Math.max(1, Math.min(12, Math.round(rows) || 1));
      const c = Math.max(1, Math.min(12, Math.round(cols) || 1));
      const selected = nodes.filter((n) => n.selected);
      const target = (selected.length ? selected : nodes)
        .slice()
        .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
      if (target.length < 1) {
        setToast("No notes to arrange");
        setColumnPickerOpen(false);
        return;
      }

      const area = computeLayoutArea(target, shuffleSettings.minWidth, shuffleSettings.minHeight);
      const cellW = (area.x2 - area.x1) / c;
      const cellH = (area.y2 - area.y1) / r;
      const targetIds = new Set(target.map((n) => n.id));
      const cells = target.slice(0, r * c).map((_, idx) => {
        const row = Math.floor(idx / c);
        const col = idx % c;
        return {
          x1: area.x1 + col * cellW,
          y1: area.y1 + row * cellH,
          x2: area.x1 + (col + 1) * cellW,
          y2: area.y1 + (row + 1) * cellH,
        };
      });
      const insetCells = insetRectsUniformly(cells, shuffleSettings.spacing);

      setNodes((nds) =>
        nds.map((n) => {
          if (!targetIds.has(n.id)) return n;
          const idx = target.findIndex((t) => t.id === n.id);
          const rect = insetCells[idx];
          if (!rect) return n;
          return { ...n, position: { x: rect.x1, y: rect.y1 }, width: rect.x2 - rect.x1, height: rect.y2 - rect.y1 };
        })
      );
      setToast(`Arranged ${Math.min(target.length, r * c)} note${target.length === 1 ? "" : "s"} into a ${r}×${c} grid`);
      setColumnPickerOpen(false);
    },
    [nodes, setNodes, shuffleSettings]
  );

  const addBoardNote = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "boardNote",
        position: viewportCenterPosition(),
        width: 200,
        height: 120,
        data: { parentBoardId: boardId, boardId: null, title: "", creating: false, error: null },
      },
    ]);
  }, [setNodes, viewportCenterPosition, boardId]);

  const addShapeNote = useCallback(() => {
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "shapeNote",
        position: viewportCenterPosition(),
        width: 140,
        height: 140,
        data: { shape: "rectangle", color: "#6d6bfa" },
      },
    ]);
  }, [setNodes, viewportCenterPosition]);

  const uploadIntoNewImageNote = useCallback(
    (file: File, position: { x: number; y: number }) => {
      const nodeId = crypto.randomUUID();
      setNodes((nds) => [
        ...nds,
        { id: nodeId, type: "imageNote", position, width: 220, height: 160, data: { url: null } },
      ]);
      api
        .uploadFile(file)
        .then(({ url, kind }) => {
          setNodes((nds) =>
            nds.map((n) => (n.id === nodeId && n.type === "imageNote" ? { ...n, data: { ...n.data, url, kind } } : n))
          );
        })
        .catch(() => {
          // leave the note as an empty dropzone so the user can retry
        });
    },
    [setNodes]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );
      if (files.length === 0) return;
      const basePos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      files.forEach((file, i) => uploadIntoNewImageNote(file, { x: basePos.x + i * 30, y: basePos.y + i * 30 }));
    },
    [screenToFlowPosition, uploadIntoNewImageNote]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const now = Date.now();
      if (now - lastCursorSentRef.current >= 40) {
        lastCursorSentRef.current = now;
        setCursor(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      }
      setDrawRect((r) => (r ? { ...r, curClientX: e.clientX, curClientY: e.clientY } : r));
      setPenPoints((pts) => (pts ? appendSmoothed(pts, { x: e.clientX, y: e.clientY }) : pts));
    },
    [screenToFlowPosition, setCursor]
  );

  const handleCanvasMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      setPendingDraw(null);
      if (e.button !== 0) return;
      if (penMode) {
        setPenPoints([{ x: e.clientX, y: e.clientY }]);
        return;
      }
      if (!drawMode) return;
      setDrawRect({ startClientX: e.clientX, startClientY: e.clientY, curClientX: e.clientX, curClientY: e.clientY });
    },
    [drawMode, penMode]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (penPoints) {
      const points = penPoints;
      setPenPoints(null);
      if (points.length < 2) return;

      const box = boundingBox(points);
      const x1 = box.minX - PEN_DRAW_PADDING;
      const y1 = box.minY - PEN_DRAW_PADDING;
      const x2 = box.maxX + PEN_DRAW_PADDING;
      const y2 = box.maxY + PEN_DRAW_PADDING;
      const topLeft = screenToFlowPosition({ x: x1, y: y1 });
      const bottomRight = screenToFlowPosition({ x: x2, y: y2 });
      const flowW = bottomRight.x - topLeft.x;
      const flowH = bottomRight.y - topLeft.y;
      const normalized = points.map((p) => ({
        x: (p.x - x1) / (x2 - x1),
        y: (p.y - y1) / (y2 - y1),
      }));

      setNodes((nds) => [
        ...nds,
        {
          id: crypto.randomUUID(),
          type: "drawingNote",
          position: topLeft,
          width: flowW,
          height: flowH,
          data: { points: normalized, color: penColor, strokeWidth: penWidth },
        },
      ]);
      return;
    }

    if (!drawRect) return;
    const x1 = Math.min(drawRect.startClientX, drawRect.curClientX);
    const y1 = Math.min(drawRect.startClientY, drawRect.curClientY);
    const x2 = Math.max(drawRect.startClientX, drawRect.curClientX);
    const y2 = Math.max(drawRect.startClientY, drawRect.curClientY);
    setDrawRect(null);
    if (x2 - x1 < MIN_DRAW_SIZE || y2 - y1 < MIN_DRAW_SIZE) return;

    const topLeft = screenToFlowPosition({ x: x1, y: y1 });
    const bottomRight = screenToFlowPosition({ x: x2, y: y2 });
    setPendingDraw({
      flowX: topLeft.x,
      flowY: topLeft.y,
      flowW: bottomRight.x - topLeft.x,
      flowH: bottomRight.y - topLeft.y,
      screenX: x1,
      screenY: y1,
    });
  }, [drawRect, penPoints, penColor, penWidth, screenToFlowPosition, setNodes]);

  const createDrawnText = useCallback(() => {
    if (!pendingDraw) return;
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "textNote",
        position: { x: pendingDraw.flowX, y: pendingDraw.flowY },
        width: pendingDraw.flowW,
        height: pendingDraw.flowH,
        data: { text: "" },
      },
    ]);
    setPendingDraw(null);
  }, [pendingDraw, setNodes]);

  const createDrawnShape = useCallback(() => {
    if (!pendingDraw) return;
    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      {
        id: crypto.randomUUID(),
        type: "shapeNote",
        position: { x: pendingDraw.flowX, y: pendingDraw.flowY },
        width: pendingDraw.flowW,
        height: pendingDraw.flowH,
        data: { shape: "rectangle", color: "#6d6bfa" },
        selected: true,
      },
    ]);
    setPendingDraw(null);
  }, [pendingDraw, setNodes]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;
      const imageItem = Array.from(items).find((it) => it.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      uploadIntoNewImageNote(file, viewportCenterPosition());
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [viewportCenterPosition, uploadIntoNewImageNote]);

  const memoNodeTypes = useMemo(() => nodeTypes, []);

  const wrapperRect = canvasWrapperRef.current?.getBoundingClientRect();
  const previewStyle = drawRect
    ? {
        left: Math.min(drawRect.startClientX, drawRect.curClientX) - (wrapperRect?.left ?? 0),
        top: Math.min(drawRect.startClientY, drawRect.curClientY) - (wrapperRect?.top ?? 0),
        width: Math.abs(drawRect.curClientX - drawRect.startClientX),
        height: Math.abs(drawRect.curClientY - drawRect.startClientY),
      }
    : null;
  const pendingDrawStyle = pendingDraw
    ? { left: pendingDraw.screenX - (wrapperRect?.left ?? 0), top: pendingDraw.screenY - (wrapperRect?.top ?? 0) }
    : null;

  if (loadError) {
    return (
      <div className="board-editor-error">
        <p>{loadError}</p>
        <Link to="/">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="board-editor" style={{ "--corner-radius": `${settings.cornerRadius}px` } as CSSProperties}>
      <header className="board-editor-header">
        <Link to="/" className="btn small">
          ← Dashboard
        </Link>
        {board?.parent_board_id && (
          <Link to={`/board/${board.parent_board_id}`} className="btn small">
            ↑ {board.parentTitle}
          </Link>
        )}
        <h1>{board?.title ?? "Loading…"}</h1>

        {searchOpen ? (
          <div className="board-search">
            <input
              autoFocus
              className="board-search-input"
              placeholder="Search notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!searchMatches.length) return;
                  const dir = e.shiftKey ? -1 : 1;
                  setSearchMatchIndex((i) => (i + dir + searchMatches.length) % searchMatches.length);
                } else if (e.key === "Escape") {
                  closeSearch();
                }
              }}
            />
            <span className="board-search-count">
              {searchQuery.trim() ? `${searchMatches.length ? searchMatchIndex + 1 : 0}/${searchMatches.length}` : ""}
            </span>
            <button
              className="btn small icon-btn"
              disabled={!searchMatches.length}
              onClick={() => setSearchMatchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length)}
              title="Previous match (Shift+Enter)"
            >
              <ChevronUpIcon />
            </button>
            <button
              className="btn small icon-btn"
              disabled={!searchMatches.length}
              onClick={() => setSearchMatchIndex((i) => (i + 1) % searchMatches.length)}
              title="Next match (Enter)"
            >
              <ChevronDownIcon />
            </button>
            <button className="btn small icon-btn" onClick={closeSearch} title="Close (Esc)">
              <CloseIcon />
            </button>
          </div>
        ) : (
          <button className="btn small" onClick={() => setSearchOpen(true)} title="Search notes (Ctrl+F)">
            <SearchIcon /> Search
          </button>
        )}

        <div className="board-editor-actions">
          <div className="presence-list">
            {presence.map((p) => (
              <div key={p.clientId} className="presence-dot" style={{ background: p.color }} title={p.name}>
                {p.name.slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
          <span className={`conn-status conn-status--${status}`}>
            {status === "connected" && "Live"}
            {status === "connecting" && "Connecting…"}
            {status === "disconnected" && "Offline"}
          </span>
          <button className="btn small icon-btn" onClick={undo} title="Undo (Ctrl+Z)">
            <UndoIcon />
          </button>
          <button className="btn small icon-btn" onClick={redo} title="Redo (Ctrl+Shift+Z)">
            <RedoIcon />
          </button>
          <button className="btn small" onClick={() => fitView({ duration: 400, padding: 0.15 })} title="Fit all notes in view">
            <FitViewIcon /> Fit view
          </button>
          <button
            className="btn small"
            onClick={handleShuffle}
            title={settings.gridMode ? "Re-split the grid into a fresh balanced layout" : "Shuffle notes into a fresh layout"}
          >
            <ShuffleIcon /> Shuffle
          </button>
          <button className="btn small" onClick={addTextNote}>
            <TextGlyphIcon /> Text
          </button>
          <button className="btn small" onClick={addImageNote}>
            <ImageGlyphIcon /> Image
          </button>
          <button className="btn small" onClick={addLinkNote}>
            <LinkGlyphIcon /> Link
          </button>
          <button className="btn small" onClick={addChecklistNote}>
            <ChecklistGlyphIcon /> Checklist
          </button>
          <div className="column-picker-wrap">
            <button
              className="btn small"
              onClick={() => setColumnPickerOpen((v) => !v)}
              disabled={settings.gridMode}
              title={settings.gridMode ? "Already in Grid canvas mode" : "Arrange notes into a grid"}
            >
              <ColumnsIcon /> Grid
            </button>
            {columnPickerOpen && (
              <>
                <div className="popover-backdrop" onClick={() => setColumnPickerOpen(false)} />
                <div className="column-picker-menu" onMouseDown={(e) => e.stopPropagation()}>
                  <p className="column-picker-hint">Arrange selected notes (or all, if none selected) into a grid</p>
                  <div className="column-picker-presets">
                    {[
                      [1, 2],
                      [2, 2],
                      [2, 3],
                      [3, 2],
                      [3, 3],
                      [1, 4],
                    ].map(([r, c]) => (
                      <button key={`${r}x${c}`} className="column-picker-item" onClick={() => arrangeIntoGrid(r, c)}>
                        {r}×{c}
                      </button>
                    ))}
                  </div>
                  <div className="column-picker-custom">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="column-picker-input"
                      placeholder="Rows"
                      value={customRows}
                      onChange={(e) => setCustomRows(e.target.value)}
                    />
                    <span className="column-picker-x">×</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="column-picker-input"
                      placeholder="Cols"
                      value={customCols}
                      onChange={(e) => setCustomCols(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const r = parseInt(customRows, 10) || 1;
                          const c = parseInt(customCols, 10) || 1;
                          arrangeIntoGrid(r, c);
                        }
                      }}
                    />
                    <button
                      className="btn small"
                      onClick={() => {
                        const r = parseInt(customRows, 10) || 1;
                        const c = parseInt(customCols, 10) || 1;
                        arrangeIntoGrid(r, c);
                      }}
                    >
                      Arrange
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button className="btn small" onClick={addBoardNote}>
            <BoardGlyphIcon /> Board
          </button>
          <button className="btn small" onClick={addShapeNote}>
            <ShapeGlyphIcon /> Shape
          </button>
          <button className="btn small primary" onClick={() => setPresenting(true)} disabled={nodes.length < 1}>
            <PlayIcon /> Present
          </button>
        </div>
      </header>

      <div className="board-editor-body">
        <BoardSidebar
          settings={settings}
          onUpdateSettings={updateSettings}
          drawMode={drawMode}
          onToggleDrawMode={() => {
            setDrawMode((v) => !v);
            setPenMode(false);
          }}
          penMode={penMode}
          onTogglePenMode={() => {
            setPenMode((v) => !v);
            setDrawMode(false);
          }}
          penColor={penColor}
          onUpdatePenColor={setPenColor}
          penWidth={penWidth}
          onUpdatePenWidth={setPenWidth}
          shuffleSettings={shuffleSettings}
          onUpdateShuffleSettings={updateShuffleSettings}
          onShuffle={handleShuffle}
          shuffleUnlockedOnly={shuffleUnlockedOnly}
          onUpdateShuffleUnlockedOnly={setShuffleUnlockedOnly}
          onApplyTemplate={handleApplyTemplate}
          presentationSettings={presentationSettings}
          onUpdatePresentationSettings={updatePresentationSettings}
          onPresent={() => setPresenting(true)}
          exportFilename={exportFilename}
          onUpdateExportFilename={setExportFilename}
          exportScale={exportScale}
          onUpdateExportScale={setExportScale}
          exportTransparent={exportTransparent}
          onUpdateExportTransparent={setExportTransparent}
          onExportImage={handleExportImage}
          exporting={exporting}
          videoResolution={videoResolution}
          onUpdateVideoResolution={setVideoResolution}
          videoFps={videoFps}
          onUpdateVideoFps={setVideoFps}
          onExportVideo={handleExportVideo}
          videoExporting={videoExporting}
          videoProgress={videoProgress}
          selectedImage={selectedImageNote?.data ?? null}
          onUpdateImageTransform={updateImageTransform}
          noteCount={nodes.length}
        />

        <div
          ref={canvasWrapperRef}
          className={`board-editor-canvas ${dragOver ? "drag-over" : ""} ${drawMode || penMode ? "drawing" : ""} ${
            settings.gridMode ? "grid-mode" : ""
          }`}
          style={{ "--counter-zoom": 1 / Math.max(viewport.zoom, 0.0001) } as CSSProperties}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onMouseMove={handleMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
        >
          <BoardSettingsContext.Provider value={settings}>
            <NoteChromeContext.Provider value={chromeMap}>
              <NoteActionsContext.Provider value={noteActions}>
              <ReactFlow
                nodes={displayNodes}
                edges={[]}
                onNodesChange={onNodesChange}
                onSelectionChange={onSelectionChange}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onNodeDragStart={onNodeDragStart}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={() => setContextMenu(null)}
                onMoveStart={() => setContextMenu(null)}
                nodeTypes={memoNodeTypes}
                deleteKeyCode={["Backspace", "Delete"]}
                multiSelectionKeyCode="Shift"
                selectionKeyCode="Shift"
                minZoom={0.2}
                maxZoom={2}
                colorMode="dark"
                onlyRenderVisibleElements
                nodesDraggable={!drawMode && !penMode}
                panOnDrag={!drawMode && !penMode}
                snapToGrid={settings.snapEnabled}
                snapGrid={[settings.gridSize, settings.gridSize]}
              >
                {settings.showGrid &&
                  (settings.gridMode ? (
                    // Matches Bento Studio's actual stage background exactly: a fine 22px dot grid
                    // behind the bounded canvas, not the bigger box-like Lines pattern.
                    <Background gap={22} size={1} color="#3a3942" variant={BackgroundVariant.Dots} />
                  ) : (
                    <Background gap={settings.gridSize} color="#232228" variant={BackgroundVariant.Lines} />
                  ))}
                {settings.gridMode && (
                  <ViewportPortal>
                    <div
                      className="grid-canvas-frame"
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: settings.gridCanvasWidth,
                        height: settings.gridCanvasHeight,
                        background: gridBackgroundCss(settings),
                      }}
                    >
                      {settings.gridGuides && (
                        <svg className="grid-guides" width={settings.gridCanvasWidth} height={settings.gridCanvasHeight}>
                          {Array.from({ length: settings.gridRowCount }, (_, r) =>
                            Array.from({ length: settings.gridCols }, (_, c) => (
                              <rect
                                key={`${c},${r}`}
                                x={gridMetrics.pad + c * (gridMetrics.cellW + gridMetrics.hGap)}
                                y={gridMetrics.pad + r * (gridMetrics.cellH + gridMetrics.vGap)}
                                width={gridMetrics.cellW}
                                height={gridMetrics.cellH}
                                fill="none"
                                stroke="rgba(255,255,255,.18)"
                                strokeWidth={1}
                                strokeDasharray="3,3"
                              />
                            ))
                          )}
                        </svg>
                      )}
                      {nodes.length === 0 && (
                        <div className="grid-empty-state">
                          <h4>Empty canvas</h4>
                          <p>Add notes from the toolbar, drop media anywhere, or hit Shuffle to generate a layout.</p>
                        </div>
                      )}
                    </div>
                    {gridPreview &&
                      (() => {
                        const r = spanToRect(gridPreview, gridMetrics);
                        return <div className="grid-drop-preview" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
                      })()}
                  </ViewportPortal>
                )}
                <Controls />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(n) => (n as NoteNode).tagColor ?? "#3a3850"}
                  maskColor="rgba(10,10,14,0.7)"
                  style={{ background: "#111114" }}
                />
              </ReactFlow>
              </NoteActionsContext.Provider>
            </NoteChromeContext.Provider>
          </BoardSettingsContext.Provider>

          {contextMenu && contextNode && (
            <div
              className="note-context-menu"
              style={{ left: contextMenu.screenX, top: contextMenu.screenY }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button className="note-context-item" onClick={toggleLockContextNode}>
                {contextNode.draggable === false ? (
                  <>
                    <UnlockIcon /> Unlock note
                  </>
                ) : (
                  <>
                    <LockIcon /> Lock in place
                  </>
                )}
              </button>
              <button className="note-context-item" onClick={duplicateContextNode}>
                <DuplicateIcon /> Duplicate
              </button>
              <button className="note-context-item note-context-item--danger" onClick={deleteContextNode}>
                <TrashIcon /> Delete
              </button>
              <div className="note-context-divider" />
              <div className="note-context-zorder">
                <button className="note-context-icon-btn" onClick={bringToFront} title="Bring to front">
                  <BringToFrontIcon />
                </button>
                <button className="note-context-icon-btn" onClick={bringForward} title="Bring forward">
                  <BringForwardIcon />
                </button>
                <button className="note-context-icon-btn" onClick={sendBackward} title="Send backward">
                  <SendBackwardIcon />
                </button>
                <button className="note-context-icon-btn" onClick={sendToBack} title="Send to back">
                  <SendToBackIcon />
                </button>
              </div>
              <div className="note-context-divider" />
              <div className="note-context-tags">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`note-context-swatch ${contextNode.tagColor === c ? "active" : ""}`}
                    style={{ background: c }}
                    onClick={() => setContextNodeTag(c)}
                    title="Tag color"
                  />
                ))}
                <button
                  className="note-context-swatch note-context-swatch--none"
                  onClick={() => setContextNodeTag(undefined)}
                  title="Remove tag"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {previewStyle && <div className="draw-rect-preview" style={previewStyle} />}

          {penPoints && penPoints.length > 1 && (
            <svg className="pen-preview-svg">
              <path
                d={buildSmoothPath(
                  penPoints.map((p) => ({ x: p.x - (wrapperRect?.left ?? 0), y: p.y - (wrapperRect?.top ?? 0) }))
                )}
                fill="none"
                stroke={penColor}
                strokeWidth={penWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {pendingDrawStyle && (
            <div className="draw-choice-menu" style={pendingDrawStyle} onMouseDown={(e) => e.stopPropagation()}>
              <button className="draw-choice-btn" onClick={createDrawnText}>
                <TextGlyphIcon />
                Text
              </button>
              <button className="draw-choice-btn" onClick={createDrawnShape}>
                <ShapeGlyphIcon />
                Shape
              </button>
              <button className="draw-choice-cancel" onClick={() => setPendingDraw(null)} title="Cancel">
                ×
              </button>
            </div>
          )}

          {selectedCount >= 2 && (
            <div className="align-toolbar" onMouseDown={(e) => e.stopPropagation()}>
              <button className="align-toolbar-btn" onClick={() => alignSelected("left")} title="Align left">
                <AlignLeftIcon />
              </button>
              <button className="align-toolbar-btn" onClick={() => alignSelected("centerH")} title="Align center">
                <AlignCenterHIcon />
              </button>
              <button className="align-toolbar-btn" onClick={() => alignSelected("right")} title="Align right">
                <AlignRightIcon />
              </button>
              <div className="align-toolbar-divider" />
              <button className="align-toolbar-btn" onClick={() => alignSelected("top")} title="Align top">
                <AlignTopIcon />
              </button>
              <button className="align-toolbar-btn" onClick={() => alignSelected("middleV")} title="Align middle">
                <AlignMiddleVIcon />
              </button>
              <button className="align-toolbar-btn" onClick={() => alignSelected("bottom")} title="Align bottom">
                <AlignBottomIcon />
              </button>
              {selectedCount >= 3 && (
                <>
                  <div className="align-toolbar-divider" />
                  <button className="align-toolbar-btn" onClick={() => distributeSelected("horizontal")} title="Distribute horizontally">
                    <DistributeHIcon />
                  </button>
                  <button className="align-toolbar-btn" onClick={() => distributeSelected("vertical")} title="Distribute vertically">
                    <DistributeVIcon />
                  </button>
                </>
              )}
              <div className="align-toolbar-count">{selectedCount} selected</div>
            </div>
          )}

          {selectedShapeNotes.length > 0 && (
            <div className="shape-panel" onMouseDown={(e) => e.stopPropagation()}>
              <div className="shape-panel-title">
                {selectedShapeNotes.length > 1 ? `${selectedShapeNotes.length} shapes` : "Shape"}
              </div>
              <div className="shape-panel-types">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    className={`shape-panel-type-btn ${selectedShapeNotes[0].data.shape === s.id ? "active" : ""}`}
                    onClick={() => patchSelectedShapes({ shape: s.id })}
                    title={s.id}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="shape-panel-colors">
                {SHAPE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`shape-panel-color-btn ${selectedShapeNotes[0].data.color === c ? "active" : ""}`}
                    style={{ background: c }}
                    onClick={() => patchSelectedShapes({ color: c })}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  className="shape-panel-color-custom"
                  value={selectedShapeNotes[0].data.color}
                  onChange={(e) => patchSelectedShapes({ color: e.target.value })}
                  title="Custom color"
                />
              </div>
              <div className="shape-panel-image-row">
                <label className="shape-panel-image-btn">
                  <ImageGlyphIcon />
                  {selectedShapeNotes[0].data.image ? "Replace image" : "Add image"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) uploadShapeImage(file);
                    }}
                  />
                </label>
                {selectedShapeNotes[0].data.image && (
                  <button className="shape-panel-image-remove" onClick={() => patchSelectedShapes({ image: null })} title="Remove image">
                    <TrashIcon />
                  </button>
                )}
              </div>
              <p className="shape-panel-hint">You can also drag an image file straight onto a shape.</p>
            </div>
          )}

          {toast && <div className="board-toast">{toast}</div>}

          {presence.map(
            (p) =>
              p.cursor && (
                <div
                  key={p.clientId}
                  className="remote-cursor"
                  style={{
                    left: p.cursor.x * viewport.zoom + viewport.x,
                    top: p.cursor.y * viewport.zoom + viewport.y,
                    color: p.color,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill={p.color}>
                    <path d="M1 1l5.5 13L8 8l6-1.5z" />
                  </svg>
                  <span style={{ background: p.color }}>{p.name}</span>
                </div>
              )
          )}
        </div>
      </div>

      {presenting && (
        <PresentationView nodes={nodes} settings={presentationSettings} onClose={() => setPresenting(false)} />
      )}
    </div>
  );
}
