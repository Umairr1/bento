#!/usr/bin/env bash
#
# First-run setup for a fresh Oracle Cloud (or any Ubuntu/Debian) VM.
# Installs Docker, fetches the app, and generates a JWT secret.
#
#   curl -fsSL https://raw.githubusercontent.com/Umairr1/bento/main/deploy/oracle-setup.sh | bash
#
# Safe to re-run: it skips anything already done and never overwrites an existing .env.

set -euo pipefail

REPO="${REPO:-https://github.com/Umairr1/bento.git}"
DIR="${DIR:-$HOME/bento}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this as your normal user (the 'ubuntu' user), not root." >&2
  exit 1
fi

say "Installing Docker"
if command -v docker >/dev/null 2>&1; then
  echo "Docker already installed — skipping."
else
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

say "Fetching the app"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

say "Configuring"
if [ -f .env ]; then
  echo "Keeping the existing .env (delete it if you want a fresh one)."
else
  SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null \
            || openssl rand -hex 48)"
  cat > .env <<ENVEOF
JWT_SECRET=$SECRET
TUNNEL_TOKEN=
ENVEOF
  chmod 600 .env
  echo "Wrote .env with a freshly generated JWT_SECRET."
fi

cat <<'NEXT'

------------------------------------------------------------------
Almost there. Two things left:

1. Create the Cloudflare Tunnel
     Cloudflare dashboard → Zero Trust → Networks → Tunnels
       → Create a tunnel → Cloudflared → name it "bento"
       → copy the token out of the install command they show
       → Public Hostname:
             subdomain : bento
             domain    : premiummarkup.com
             service   : HTTP  ->  app:4000

2. Paste the token into .env, then start it:
     nano ~/bento/.env          # set TUNNEL_TOKEN=...
     cd ~/bento
     docker compose up -d --build

   (If docker says "permission denied", log out and back in once —
    the group change from the install needs a new session.)

Watch it come up:   docker compose logs -f
------------------------------------------------------------------
NEXT
