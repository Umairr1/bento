# Deploying Boards free on Oracle Cloud

An Always Free Oracle VM runs this permanently at no cost. The app reaches the internet through a
**Cloudflare Tunnel**, which means no ports are opened and no TLS certificates are managed — the
tunnel dials out to Cloudflare, so Oracle's security lists and the instance's own iptables rules
never come into it. That firewall layer is where most OCI deployments get stuck.

```
bento.premiummarkup.com
   └── Cloudflare edge (TLS terminates here)
        └── Tunnel ── outbound only ──▶ cloudflared container
                                          └── app:4000  (Express + WebSocket)
                                               └── /data volume (SQLite + uploads)
```

---

## 1. Create the VM

Oracle Cloud → **Compute → Instances → Create instance**

| Setting | Value |
|---|---|
| Image | Canonical Ubuntu 24.04 |
| Shape | **Ampere A1 (ARM)** — `VM.Standard.A1.Flex` |
| OCPUs / Memory | 2 OCPU / 12 GB (the current Always Free ceiling) |
| Boot volume | 50 GB is plenty |
| SSH keys | Upload your public key, or let it generate one — **save the private key** |

Make sure every field says **"Always Free eligible"** before you create it.

> **"Out of host capacity"** is common on the ARM shape and is not your mistake — Oracle genuinely
> runs out. Try a different Availability Domain, try again later, or pick a less busy home region.
> Switching your account to Pay As You Go removes the capacity restriction while keeping the same
> Always Free allowance.

Then SSH in:

```bash
chmod 600 your-key.key
ssh -i your-key.key ubuntu@<the instance's public IP>
```

## 2. Run the setup script

If you already have the tunnel token from step 3, pass it and the whole thing completes unattended:

```bash
curl -fsSL https://raw.githubusercontent.com/Umairr1/bento/main/deploy/oracle-setup.sh   | TUNNEL_TOKEN=eyJhIjoi... bash
```

Without a token it installs Docker, clones to `~/bento`, generates a `JWT_SECRET`, and stops there
so you can add the token afterwards. Re-running is safe — it keeps the existing secret rather than
regenerating it, which would log everyone out.

## 3. Create the Cloudflare Tunnel

Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**

- Name it `bento`
- On the install screen, copy the long token out of the command shown (the part after `--token`)
- Add a **Public Hostname**:

| Field | Value |
|---|---|
| Subdomain | `bento` |
| Domain | `premiummarkup.com` |
| Type | `HTTP` |
| URL | `app:4000` |

`app:4000` is the container's name on the compose network, not a public address — cloudflared
resolves it internally.

## 4. Start it

```bash
nano ~/bento/.env        # paste the token into TUNNEL_TOKEN=
cd ~/bento
docker compose up -d --build
docker compose logs -f
```

The first build takes several minutes on ARM — `better-sqlite3` compiles its native addon from
source. Later builds are cached.

When the logs show `Boards server listening on :4000` and cloudflared reports a registered
connection, open **https://bento.premiummarkup.com**.

---

## Day-to-day

```bash
cd ~/bento
git pull && docker compose up -d --build   # deploy an update
docker compose logs -f app                 # tail logs
docker compose restart app                 # restart
docker compose ps                          # what's running
```

## Backups

Everything that matters — the SQLite database and every uploaded image — lives in the `boards-data`
volume.

```bash
# back up
docker run --rm -v bento_boards-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/boards-backup-$(date +%F).tar.gz -C /data .

# restore
docker run --rm -v bento_boards-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/boards-backup-YYYY-MM-DD.tar.gz -C /data"
```

Copy those tarballs off the VM. Oracle halved the Always Free allowance in June 2026 with no
announcement and terminated over-limit instances — treat the VM as replaceable, not as the only
copy of your team's work.

> **Never run `docker compose down -v`.** The `-v` deletes the volume, and with it the database and
> every uploaded file. Plain `docker compose down` is safe.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `permission denied` on docker | The group change needs a new session — log out and back in. |
| Container restart-loops instantly | `JWT_SECRET` is empty in `.env`. The server refuses to start without one, by design. |
| Site loads but stays "Connecting…" | The tunnel's Public Hostname isn't pointing at `app:4000`, or its type isn't HTTP. |
| Everything gone after a redeploy | The volume was removed (`down -v`). Restore from a backup. |
