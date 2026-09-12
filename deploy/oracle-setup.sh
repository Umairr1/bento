#!/usr/bin/env bash
#
# One-shot setup for a fresh Oracle Cloud (or any Ubuntu/Debian) VM.
# Installs Docker, fetches the app, generates a JWT secret, and starts the stack.
#
# Fully unattended when you pass the tunnel token:
#   curl -fsSL https://raw.githubusercontent.com/Umairr1/bento/main/deploy/oracle-setup.sh \
#     | TUNNEL_TOKEN=eyJhIjoi... bash
#
# Without it, the script stops after setup and prints what's left to do.
# Safe to re-run: it skips what's done and never overwrites an existing secret.

set -euo pipefail

REPO="${REPO:-https://github.com/Umairr1/bento.git}"
DIR="${DIR:-$HOME/bento}"
TUNNEL_TOKEN="${TUNNEL_TOKEN:-}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mError: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] && die "Run as your normal user (usually 'ubuntu'), not root."

say "Installing prerequisites"
# Oracle's Ubuntu cloud image ships neither git nor openssl, so install them before use rather
# than failing on the first clone.
MISSING=()
for c in git openssl; do command -v "$c" >/dev/null 2>&1 || MISSING+=("$c"); done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Installing: ${MISSING[*]}"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${MISSING[@]}"
else
  echo "git and openssl already present."
fi

say "Installing Docker"
if command -v docker >/dev/null 2>&1; then
  echo "Already installed."
else
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  NEW_GROUP=1
fi

say "Fetching the app"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

say "Configuring"
# Preserve an existing secret — regenerating it would invalidate everyone's login session.
if [ -f .env ] && grep -q '^JWT_SECRET=.\+' .env; then
  JWT_SECRET="$(grep '^JWT_SECRET=' .env | cut -d= -f2-)"
  echo "Reusing the existing JWT_SECRET."
else
  JWT_SECRET="$(openssl rand -hex 48)"
  echo "Generated a new JWT_SECRET."
fi

# Keep a previously saved token if this run didn't supply one.
if [ -z "$TUNNEL_TOKEN" ] && [ -f .env ]; then
  TUNNEL_TOKEN="$(grep '^TUNNEL_TOKEN=' .env 2>/dev/null | cut -d= -f2- || true)"
fi

umask 077
printf 'JWT_SECRET=%s\nTUNNEL_TOKEN=%s\n' "$JWT_SECRET" "$TUNNEL_TOKEN" > .env
chmod 600 .env

if [ -z "$TUNNEL_TOKEN" ]; then
  cat <<'NEXT'

------------------------------------------------------------------
Setup done, but there's no Cloudflare Tunnel token yet.

  Cloudflare → Zero Trust → Networks → Tunnels
    → Create a tunnel → Cloudflared → name it "bento"
    → copy the token from the install command
    → Public Hostname:  bento . premiummarkup.com
                        HTTP  ->  app:4000

Then finish with:
  cd ~/bento && nano .env      # paste into TUNNEL_TOKEN=
  docker compose up -d --build
------------------------------------------------------------------
NEXT
  exit 0
fi

say "Starting the stack (first ARM build takes a few minutes — better-sqlite3 compiles from source)"
# The docker group change doesn't apply until a new login session, so this first run needs sudo.
DOCKER="docker"
if [ "${NEW_GROUP:-0}" = "1" ] || ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi
$DOCKER compose up -d --build

say "Waiting for the app to report healthy"
for i in $(seq 1 60); do
  if $DOCKER compose exec -T app node -e \
      "fetch('http://localhost:4000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
    say "Up. https://bento.premiummarkup.com should be live within a few seconds."
    $DOCKER compose ps
    exit 0
  fi
  sleep 5
done

die "App didn't become healthy in 5 minutes. Check: $DOCKER compose logs app"
