#!/usr/bin/env node
/**
 * Generate SQL to backfill Tenant.pillarId and subCategoryId from data.json.
 * Run from host: node scripts/generate-pillar-backfill-sql.cjs [data.json]
 * Then apply: psql "$DATABASE_URL" -f scripts/pillar-backfill.sql
 * No tsx/Node modules required; use from host or any env with Node.
 */
const fs = require('fs');
const path = require('path');

const dataPath = process.argv[2] || path.join(__dirname, '..', 'data.json');
if (!fs.existsSync(dataPath)) {
  console.error('File not found:', dataPath);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const tenants = data.tenants || [];
const outPath = path.join(__dirname, 'pillar-backfill.sql');

function esc(s) {
  if (s == null || s === '') return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

const lines = [
  '-- Backfill Tenant.pillarId and subCategoryId from data.json',
  `-- Generated from ${dataPath} (${tenants.length} tenants)`,
  '',
];
let count = 0;
for (const t of tenants) {
  if (!t.id) continue;
  const pillarId = t.pillarId != null ? String(t.pillarId) : null;
  const subCategoryId = t.subCategoryId != null ? String(t.subCategoryId) : null;
  const idEsc = esc(t.id);
  const pillarEsc = esc(pillarId);
  const subEsc = esc(subCategoryId);
  lines.push(`UPDATE "Tenant" SET "pillarId" = ${pillarEsc}, "subCategoryId" = ${subEsc} WHERE id = ${idEsc};`);
  count++;
}
lines.push('');
lines.push(`-- ${count} UPDATE statements`);

fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log('Wrote', count, 'UPDATE statements to', outPath);
console.log('Run: psql "$DATABASE_URL" -f scripts/pillar-backfill.sql');
