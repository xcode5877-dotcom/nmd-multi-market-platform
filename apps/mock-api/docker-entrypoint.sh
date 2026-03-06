#!/bin/sh
set -e
# Ensure mounted uploads dir is writable so new uploads and real-time image sync work
if [ -d /app/uploads ]; then
  chmod -R 777 /app/uploads 2>/dev/null || true
fi
# When using PostgreSQL, run pending migrations before starting the app.
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrate deploy..."
  npx prisma migrate deploy --schema=prisma/schema.prisma || true
fi
exec "$@"
