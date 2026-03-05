# Deploy nmd.marketing on Hostinger VPS

These steps get the unified stack (Nginx + 4 frontends + mock-api) live **without losing your existing `data.json`**.

## 1. Backup existing data (do this first)

On your **local** machine (or wherever `data.json` currently lives):

```bash
cp apps/mock-api/data.json apps/mock-api/data.json.backup
```

Keep this backup safe. You will copy it to the VPS in step 4.

## 2. Push code to your repo

Ensure all changes (including `nginx.conf`, `Dockerfile.web`, `docker-compose.yml`, and `DATA_FILE` in mock-api) are committed and pushed so the VPS can pull them.

```bash
git add -A && git commit -m "Docker & Nginx production: unified web-gateway + mock-api with data volume" && git push
```

## 3. On the VPS: clone/pull and prepare data directory

SSH into your Hostinger VPS, then:

```bash
cd /opt
sudo mkdir -p nmd
cd nmd
sudo git clone https://YOUR_REPO_URL.git .   # or: git pull if already cloned
```

Create the data directory and give your user write access so Docker can mount it:

```bash
sudo mkdir -p data
sudo chown "$USER:$USER" data
```

## 4. Put your backup data.json on the VPS (no data loss)

Copy your backup from your **local** machine to the VPS (replace `user` and `your-vps-ip`):

```bash
scp apps/mock-api/data.json user@your-vps-ip:/opt/nmd/data/data.json
```

Or, if you already have `data.json` on the VPS from a previous deploy, move it into the new data dir:

```bash
cp /path/to/old/data.json /opt/nmd/data/data.json
```

## 5. Build and run with Docker Compose

Still on the VPS, in `/opt/nmd`:

```bash
cd /opt/nmd
docker compose build --no-cache
docker compose up -d
```

Optional: use your real domain for build-time API URLs (default is `https://nmd.marketing`):

```bash
docker compose build --no-cache --build-arg VITE_PUBLIC_ORIGIN=https://nmd.marketing
docker compose up -d
```

## 6. Verify

- **Site:** open `http://YOUR_VPS_IP` (or `https://nmd.marketing` once DNS/SSL point here).
- **Paths:** `/` (storefront), `/courier/`, `/merchant/`, `/market-admin/`, `/api/` (proxy to mock-api).
- **API health:** `curl http://localhost:5190/health` or `curl http://YOUR_VPS_IP/api/health`.
- **Data:** your existing tenants/markets/orders should be there because `data.json` is in `./data/` and mounted into the mock-api container.

## 7. Point domain and SSL (Hostinger)

- In Hostinger (or your DNS), set an **A record** for `nmd.marketing` to your VPS public IP.
- On the VPS, use Certbot (or Hostinger’s SSL) so Nginx serves HTTPS.  
  If you switch to a reverse proxy in front of Docker (e.g. Nginx on host with Certbot), then:
  - Either keep Docker Nginx on 80 and put the host Nginx in front proxying to `127.0.0.1:80`,  
  - Or expose only `127.0.0.1:80` for the compose stack and have the host Nginx handle 443 and proxy to `127.0.0.1:80`.

## Updates without losing data

After future code changes:

```bash
cd /opt/nmd
git pull
docker compose build --no-cache
docker compose up -d
```

The `./data` directory (and thus `data.json`) is unchanged; only code and images are updated.

## Troubleshooting

- **502 on /api/:** mock-api may not be ready. Wait a few seconds and retry, or run `docker compose logs mock-api`.
- **Empty data:** ensure `/opt/nmd/data/data.json` exists and has content before `docker compose up`.
- **Port 80 in use:** stop any other web server (e.g. `sudo systemctl stop nginx`) or change the host port in `docker-compose.yml` (e.g. `"8080:80"`).
