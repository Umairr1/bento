import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { wsUrl } from "../api/config";
import type { Node } from "@xyflow/react";
import type { CornerStyle } from "./cornerStyles";
import { DEFAULT_GRID_CANVAS, type AspectRatioPreset } from "../canvas/gridBoard";

const LOCAL_ORIGIN = "local";

const PRESENCE_COLORS = ["#f0607a", "#6d6bfa", "#3fb27f", "#e8a33d", "#a78bfa", "#3fa7d6"];

export type PresenceUser = {
  clientId: number;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
};

export type BoardSettings = {
  snapEnabled: boolean;
  gridSize: number;
  showGrid: boolean;
  cornerStyle: CornerStyle;
  cornerRadius: number;
  lockAspectRatio: boolean;
  gridMode: boolean;
  gridCanvasWidth: number;
  gridCanvasHeight: number;
  gridCols: number;
  gridRowCount: number;
  gridGapX: number;
  gridGapY: number;
  gridOuterPadding: number;
  gridAspectRatio: AspectRatioPreset;
  gridBgType: "solid" | "gradient" | "transparent";
  gridBackground: string;
  gridBgFrom: string;
  gridBgTo: string;
  gridBgAngle: number;
  gridGuides: boolean;
  boxLabels: boolean;
  contentOnlySwap: boolean;
};

const DEFAULT_SETTINGS: BoardSettings = {
  snapEnabled: false,
  gridSize: 130,
  showGrid: true,
  cornerStyle: "rounded",
  cornerRadius: 16,
  lockAspectRatio: false,
  gridMode: false,
  gridCanvasWidth: DEFAULT_GRID_CANVAS.width,
  gridCanvasHeight: DEFAULT_GRID_CANVAS.height,
  gridCols: DEFAULT_GRID_CANVAS.cols,
  gridRowCount: DEFAULT_GRID_CANVAS.rows,
  gridGapX: DEFAULT_GRID_CANVAS.hGap,
  gridGapY: DEFAULT_GRID_CANVAS.vGap,
  gridOuterPadding: DEFAULT_GRID_CANVAS.outerPadding,
  gridAspectRatio: "free",
  gridBgType: "solid",
  gridBackground: "#141420",
  gridBgFrom: "#2a2a55",
  gridBgTo: "#6d6bfa",
  gridBgAngle: 145,
  gridGuides: true,
  boxLabels: true,
  contentOnlySwap: false,
};

type GridNodeFields = { gridCol1?: number; gridRow1?: number; gridCol2?: number; gridRow2?: number };

function sanitizeNode(n: Node) {
  const g = n as Node & GridNodeFields & { tagColor?: string };
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    width: n.width,
    height: n.height,
    draggable: n.draggable,
    tagColor: g.tagColor,
    gridCol1: g.gridCol1,
    gridRow1: g.gridRow1,
    gridCol2: g.gridCol2,
    gridRow2: g.gridRow2,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isWellFormedNode(value: unknown): value is Node {
  if (!value || typeof value !== "object") return false;
  const n = value as Partial<Node>;
  return (
    typeof n.id === "string" &&
    typeof n.type === "string" &&
    !!n.position &&
    typeof n.position.x === "number" &&
    typeof n.position.y === "number"
  );
}

export function useYjsBoard<T extends Node>(boardId: number, userName: string) {
  const [nodes, setNodes] = useState<T[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [synced, setSynced] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_SETTINGS);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const yMapRef = useRef<Y.Map<unknown> | null>(null);
  const settingsMapRef = useRef<Y.Map<unknown> | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const suppressNextSyncRef = useRef(false);
  const suppressNextSettingsSyncRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorRef = useRef(PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const yMap = ydoc.getMap<unknown>("nodes");
    const settingsMap = ydoc.getMap<unknown>("settings");
    const provider = new WebsocketProvider(wsUrl(), `board-${boardId}`, ydoc);
    const undoManager = new Y.UndoManager(yMap, { trackedOrigins: new Set([LOCAL_ORIGIN]) });

    ydocRef.current = ydoc;
    yMapRef.current = yMap;
    settingsMapRef.current = settingsMap;
    providerRef.current = provider;
    undoManagerRef.current = undoManager;

    function rebuildFromMap() {
      suppressNextSyncRef.current = true;
      const valid = Array.from(yMap.values()).filter(isWellFormedNode) as T[];
      setNodes(valid);
    }

    function rebuildSettings() {
      suppressNextSettingsSyncRef.current = true;
      setSettings({ ...DEFAULT_SETTINGS, ...(settingsMap.toJSON() as Partial<BoardSettings>) });
    }

    function onMapEvent(_events: unknown, transaction: Y.Transaction) {
      if (transaction.origin === LOCAL_ORIGIN) return;
      rebuildFromMap();
    }
    yMap.observe(onMapEvent);

    function onSettingsEvent(_events: unknown, transaction: Y.Transaction) {
      if (transaction.origin === LOCAL_ORIGIN) return;
      rebuildSettings();
    }
    settingsMap.observe(onSettingsEvent);

    function onStatus({ status }: { status: "connecting" | "connected" | "disconnected" }) {
      setStatus(status);
    }
    provider.on("status", onStatus);

    function onSync(isSynced: boolean) {
      if (isSynced) {
        rebuildFromMap();
        rebuildSettings();
        setSynced(true);
      }
    }
    provider.on("sync", onSync);

    provider.awareness.setLocalStateField("user", { name: userName, color: colorRef.current });

    function onAwarenessChange() {
      const states = provider.awareness.getStates();
      const list: PresenceUser[] = [];
      states.forEach((state, clientId) => {
        if (clientId === provider.awareness.clientID) return;
        const user = (state as { user?: { name: string; color: string } }).user;
        if (!user) return;
        const cursor = (state as { cursor?: { x: number; y: number } }).cursor ?? null;
        list.push({ clientId, name: user.name, color: user.color, cursor });
      });
      setPresence(list);
    }
    provider.awareness.on("change", onAwarenessChange);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      yMap.unobserve(onMapEvent);
      settingsMap.unobserve(onSettingsEvent);
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      provider.awareness.off("change", onAwarenessChange);
      provider.awareness.setLocalState(null);
      provider.destroy();
      ydoc.destroy();
      setSynced(false);
      setNodes([]);
      setPresence([]);
      setSettings(DEFAULT_SETTINGS);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  useEffect(() => {
    if (!synced) return;
    if (suppressNextSyncRef.current) {
      suppressNextSyncRef.current = false;
      return;
    }
    // Debounced: React Flow fires onNodesChange on every drag/resize frame, and a full
    // diff + Yjs transact on each one is unnecessary work fighting the render loop. Local
    // state already updated synchronously above this hook, so the user's own dragging stays
    // instant — this only delays when the change is broadcast to collaborators/persisted.
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const yMap = yMapRef.current;
      const ydoc = ydocRef.current;
      if (!yMap || !ydoc) return;

      ydoc.transact(() => {
        const nextIds = new Set(nodes.map((n) => n.id));
        for (const id of Array.from(yMap.keys())) {
          if (!nextIds.has(id)) yMap.delete(id);
        }
        for (const n of nodes) {
          const sanitized = sanitizeNode(n);
          if (!deepEqual(yMap.get(n.id), sanitized)) {
            yMap.set(n.id, sanitized);
          }
        }
      }, LOCAL_ORIGIN);
    }, 40);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, synced]);

  useEffect(() => {
    if (!synced) return;
    if (suppressNextSettingsSyncRef.current) {
      suppressNextSettingsSyncRef.current = false;
      return;
    }
    const map = settingsMapRef.current;
    const ydoc = ydocRef.current;
    if (!map || !ydoc) return;

    ydoc.transact(() => {
      (Object.keys(settings) as (keyof BoardSettings)[]).forEach((key) => {
        if (map.get(key) !== settings[key]) map.set(key, settings[key]);
      });
    }, LOCAL_ORIGIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, synced]);

  const updateSettings = useCallback((update: Partial<BoardSettings>) => {
    setSettings((prev) => ({ ...prev, ...update }));
  }, []);

  const setCursor = useCallback((pos: { x: number; y: number } | null) => {
    providerRef.current?.awareness.setLocalStateField("cursor", pos);
  }, []);

  const undo = useCallback(() => undoManagerRef.current?.undo(), []);
  const redo = useCallback(() => undoManagerRef.current?.redo(), []);

  return { nodes, setNodes, status, synced, presence, settings, updateSettings, setCursor, undo, redo };
}
