import { WebSocketServer } from "ws";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Room } from "./room";
import { verifyToken, AUTH_COOKIE_NAME } from "../auth/jwt";
import { getBoardAccess, canEditRole } from "../db/ownership";

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

const rooms = new Map<string, Room>();

function getRoom(docName: string): Room {
  let room = rooms.get(docName);
  if (!room) {
    room = new Room(docName);
    rooms.set(docName, room);
  }
  return room;
}

export function attachCollabServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    handleUpgrade(req, socket, head, wss).catch(() => {
      socket.destroy();
    });
  });
}

async function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, wss: WebSocketServer) {
  const url = new URL(req.url ?? "", "http://localhost");
  const match = /^\/yjs\/board-(\d+)$/.exec(url.pathname);
  if (!match) {
    socket.destroy();
    return;
  }
  const boardId = Number(match[1]);

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[AUTH_COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    socket.destroy();
    return;
  }

  const access = getBoardAccess(boardId, payload.userId);
  if (!access) {
    socket.destroy();
    return;
  }
  const canEdit = canEditRole(access.role);

  wss.handleUpgrade(req, req.socket, head, (ws) => {
    const room = getRoom(`board-${boardId}`);
    room.init(ws);

    ws.on("message", (data: Buffer) => {
      room.handleMessage(ws, new Uint8Array(data), canEdit);
    });
    ws.on("close", () => room.removeConnection(ws));
    ws.on("error", () => room.removeConnection(ws));
  });
}
