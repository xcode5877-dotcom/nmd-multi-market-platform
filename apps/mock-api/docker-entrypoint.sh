#!/bin/sh
set -e
# Ensure uploads dir exists and is readable by app + publicly readable for GET /uploads (755)
mkdir -p /app/uploads /app/uploads/banners
if [ -d /app/uploads ]; then
  chmod -R 755 /app/uploads 2>/dev/null || true
fi

# Data persistence: when host file is missing, Docker bind-mount creates a *directory* with that name,
# so the app gets EISDIR and never persists (data lost on rebuild). Fix by ensuring these are files.
DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
ensure_json_file() {
  local path="$1"
  local initial="$2"
  if [ -d "$path" ]; then
    rmdir "$path" 2>/dev/null || true
  fi
  if [ ! -f "$path" ]; then
    printf '%s\n' "$initial" > "$path"
    echo "[entrypoint] Created initial file: $path"
  elif [ ! -s "$path" ]; then
    printf '%s\n' "$initial" > "$path"
    echo "[entrypoint] File was empty, wrote initial content: $path"
  fi
}
ensure_json_file "$DATA_DIR/data.json" '{}'
ensure_json_file "$DATA_DIR/orders.json" '[]'
ensure_json_file "$DATA_DIR/market-config.json" '{}'
ensure_json_file "$DATA_DIR/push-subscriptions.json" '{}'

# Firebase: if FIREBASE_SERVICE_ACCOUNT_PATH is set and points to a directory (e.g. Docker created it when host path was missing), fail fast to avoid EISDIR.
if [ -n "$FIREBASE_SERVICE_ACCOUNT_PATH" ] && [ -d "$FIREBASE_SERVICE_ACCOUNT_PATH" ]; then
  echo "[entrypoint] ERROR: FIREBASE_SERVICE_ACCOUNT_PATH is a directory (EISDIR risk). Ensure the host file is present and the volume in docker-compose points to the JSON file (e.g. now-market-59841-firebase-adminsdk-fbsvc-949643eb84.json). Remove any directory at that path on the host."
  exit 1
fi

# When using PostgreSQL, run pending migrations before starting the app.
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrate deploy..."
  npx prisma migrate deploy --schema=prisma/schema.prisma || true
fi

# Run from app dir so relative paths (e.g. prisma/schema.prisma) resolve correctly
cd /app/apps/mock-api
exec "$@"
