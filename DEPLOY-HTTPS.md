# HTTPS and Certbot for nmd.marketing

Nginx is configured to listen on **port 80** (redirect to HTTPS + ACME challenge) and **port 443** (SSL). All `/api/` requests are proxied to `http://mock-api:5190/`.

## First-time: get the certificate

Nginx will not start if the SSL certificate files are missing. **Use Option A (standalone) first** so the cert exists before starting the stack.

### Option A: Certbot standalone (simplest for first run)

1. **Do not start** `web-gateway` yet (or stop it so port 80 is free):

   ```bash
   docker compose stop web-gateway
   ```

2. **Install Certbot** on your Ubuntu VPS:

   ```bash
   sudo apt-get update
   sudo apt-get install -y certbot
   ```

3. **Obtain the certificate** (Certbot will bind to port 80):

   ```bash
   sudo certbot certonly --standalone -d nmd.marketing
   ```

   Follow the prompts (email, agree to terms). Certificates will be written to `/etc/letsencrypt/live/nmd.marketing/`.

4. **Create the webroot directory** (for future renewals with webroot):

   ```bash
   sudo mkdir -p /var/www/certbot
   ```

5. **Start the stack** (Nginx will use the mounted certs and listen on 80 and 443):

   ```bash
   docker compose up -d
   ```

### Option B: Certbot webroot (after you already have certs)

Use this for **renewals** or if you already obtained a certificate (e.g. via Option A) and want to use webroot next time. Nginx must be running so `/.well-known/acme-challenge/` is served from `/var/www/certbot`.

1. Create the webroot directory and ensure the stack is running:

   ```bash
   sudo mkdir -p /var/www/certbot
   docker compose up -d
   ```

2. Obtain or renew the certificate:

   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot -d nmd.marketing
   ```

3. Reload Nginx to pick up renewed certs:

   ```bash
   docker compose exec web-gateway nginx -s reload
   ```

## Link Certbot to the Nginx container

The `docker-compose.yml` already links Certbot to the Nginx container via volumes:

- **`/etc/letsencrypt:/etc/letsencrypt:ro`** — certificates are read by Nginx inside the container.
- **`/var/www/certbot:/var/www/certbot`** — HTTP-01 challenge files for renewals (Option B).

No extra linking step is required; ensure the stack is started **after** certificates exist (Option A) or restart `web-gateway` after the first `certonly` (Option B).

## Renewal

Renewals can use webroot so the container does not need to be stopped:

```bash
sudo certbot renew --webroot -w /var/www/certbot
docker compose exec web-gateway nginx -s reload
```

Or add a cron job:

```bash
0 3 * * * certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f /opt/nmd/docker-compose.yml exec web-gateway nginx -s reload
```

## Summary: install Certbot on Ubuntu VPS

```bash
sudo apt-get update
sudo apt-get install -y certbot
```

Then use **Option A** (standalone) for the first certificate, or **Option B** (webroot) if the stack is already running.
