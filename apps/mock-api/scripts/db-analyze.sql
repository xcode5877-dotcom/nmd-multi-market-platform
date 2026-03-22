-- Safe DB optimization for launch: update PostgreSQL statistics only (no data change).
-- Run: cd apps/mock-api && DATABASE_URL=... pnpm exec prisma db execute --file scripts/db-analyze.sql
ANALYZE;
