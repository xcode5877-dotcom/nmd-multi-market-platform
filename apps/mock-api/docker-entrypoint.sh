#!/bin/sh
set -e
# When using PostgreSQL, run pending migrations before starting the app.
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrate deploy..."
  npx prisma migrate deploy --schema=prisma/schema.prisma || true
fi
exec "$@"
