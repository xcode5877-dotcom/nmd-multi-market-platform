#!/usr/bin/env npx tsx
/**
 * Static checks: Admin statement + Courier earnings UI preserve duration + actions.
 * Run: pnpm --filter mock-api exec tsx ../nmd-admin/../mock-api/scripts/verify-driver-hours-ui.ts
 * Or:  pnpm exec tsx apps/mock-api/scripts/verify-driver-hours-ui.ts (from repo root)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('verify-driver-hours-ui');

const statement = read('apps/nmd-admin/src/pages/drivers/DriverStatementPage.tsx');
assert(statement.includes('durationLabel'), 'Admin statement renders durationLabel');
assert(statement.includes('ساعات العمل'), 'Admin statement has ساعات العمل column');
assert(statement.includes('قيد الدوام الآن'), 'Admin statement active-shift label');
assert(statement.includes("tab === 'earnings'"), 'Admin preserves earnings tab');
assert(statement.includes("tab === 'expenses'"), 'Admin preserves expenses tab');
assert(statement.includes("tab === 'bonuses'"), 'Admin preserves bonuses tab');
assert(statement.includes("tab === 'settlements'"), 'Admin preserves settlements tab');
assert(statement.includes('openPayslipPdf'), 'Admin preserves payslip/PDF action');
assert(statement.includes('min-w-[640px]'), 'Admin shifts table keeps horizontal scroll for mobile');
assert(statement.includes('text-right'), 'Admin RTL text-right columns present');

const earnings = read('apps/courier/src/pages/CourierEarningsPage.tsx');
assert(earnings.includes('/courier/shifts'), 'Courier UI loads shift history');
assert(earnings.includes('سجل الدوام'), 'Courier UI has attendance log section');
assert(earnings.includes('durationLabel'), 'Courier UI shows durationLabel');
assert(earnings.includes('قيد الدوام الآن') || earnings.includes('durationLabel'), 'Courier active duration path');
assert(earnings.includes('بدء الدوام'), 'Courier preserves start shift action');
assert(earnings.includes('إنهاء الدوام'), 'Courier preserves end shift action');
assert(earnings.includes('hoursWorked'), 'Courier preserves hoursWorked summary card');

// Regression: unrelated admin surfaces still present in tree
const payrollFinance = read('apps/nmd-admin/src/pages/drivers/DriverPayrollFinancePage.tsx');
assert(payrollFinance.includes('hoursWorked'), 'Payroll finance hours column still present');
assert(payrollFinance.includes('/admin/driver-payroll'), 'Payroll finance API path preserved');

const collections = read('apps/nmd-admin/src/pages/drivers/DriverCollectionsPage.tsx');
assert(collections.includes('activeShiftStart') || collections.includes('shiftLabel'), 'Driver collections page preserved');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
