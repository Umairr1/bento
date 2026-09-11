# syntax=docker/dockerfile:1
#
# One image serving the whole app: Express handles /api and the /yjs WebSocket, and also serves the
# built client. Single origin means the auth cookie stays first-party and there is no CORS to set up.

# ---------- build the client ----------
FROM node:22-bookworm-slim AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# No VITE_API_BASE: the production default is same-origin, which is exactly this layout.
RUN npm run build

# ---------- build the server ----------
FROM node:22-bookworm-slim AS server
WORKDIR /app/server
# better-sqlite3 ships a native addon; if there's no prebuild for this platform it compiles here.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---------- runtime ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server /app/server/node_modules ./server/node_modules
COPY --from=server /app/server/dist        ./server/dist
COPY --from=server /app/server/package.json ./server/package.json
COPY --from=client /app/client/dist        ./client/dist

# Must be a mounted volume in production — a container filesystem is rebuilt on every deploy, which
# would otherwise take the SQLite database and every uploaded image with it.
ENV DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
