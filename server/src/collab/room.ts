import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { WebSocket } from "ws";
import { loadSnapshot, saveSnapshot } from "./persistence";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// Sync sub-message types per y-protocols/sync — step2 and update both mutate the doc.
const SYNC_STEP2 = 1;
const SYNC_UPDATE = 2;

function peekSyncSubType(message: Uint8Array): number | null {
  const decoder = decoding.createDecoder(message);
  const outer = decoding.readVarUint(decoder);
  if (outer !== MESSAGE_SYNC) return null;
  return decoding.readVarUint(decoder);
}

function send(conn: WebSocket, message: Uint8Array) {
  if (conn.readyState !== conn.OPEN) return;
  try {
    conn.send(message);
  } catch {
    conn.close();
  }
}

export class Room {
  name: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>> = new Map();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(name: string) {
    this.name = name;
    this.doc = new Y.Doc();
    loadSnapshot(name, this.doc);
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.doc.on("update", (update: Uint8Array, origin: WebSocket | null) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      this.conns.forEach((_ids, conn) => {
        if (conn !== origin) send(conn, message);
      });
      this.scheduleSave();
    });

    this.awareness.on(
      "update",
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: WebSocket | null
      ) => {
        const changedClients = added.concat(updated, removed);
        if (origin && this.conns.has(origin)) {
          const controlled = this.conns.get(origin)!;
          added.forEach((id) => controlled.add(id));
          removed.forEach((id) => controlled.delete(id));
        }
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        );
        const message = encoding.toUint8Array(encoder);
        this.conns.forEach((_ids, conn) => {
          if (conn !== origin) send(conn, message);
        });
      }
    );
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveSnapshot(this.name, this.doc), 2000);
  }

  init(conn: WebSocket) {
    this.conns.set(conn, new Set());

    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, this.doc);
    send(conn, encoding.toUint8Array(syncEncoder));

    const states = this.awareness.getStates();
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(states.keys()))
      );
      send(conn, encoding.toUint8Array(awarenessEncoder));
    }
  }

  removeConnection(conn: WebSocket) {
    const controlled = this.conns.get(conn);
    this.conns.delete(conn);
    if (controlled) {
      awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(controlled), null);
    }
    if (this.conns.size === 0) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      saveSnapshot(this.name, this.doc);
    }
  }

  handleMessage(conn: WebSocket, message: Uint8Array, canEdit: boolean) {
    if (!canEdit) {
      const subType = peekSyncSubType(message);
      if (subType === SYNC_STEP2 || subType === SYNC_UPDATE) {
        // Read-only role (viewer/commenter) tried to write — silently drop the change.
        return;
      }
    }

    const decoder = decoding.createDecoder(message);
    const encoder = encoding.createEncoder();
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC: {
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, conn);
        if (encoding.length(encoder) > 1) send(conn, encoding.toUint8Array(encoder));
        break;
      }
      case MESSAGE_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(this.awareness, update, conn);
        break;
      }
    }
  }
}
