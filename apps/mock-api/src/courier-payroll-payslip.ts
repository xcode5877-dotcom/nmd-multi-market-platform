/**
 * RTL HTML payslip for payroll settlements (print / save as PDF via browser).
 */

import type { CourierPayrollSettlement } from '@prisma/client';

export type PayslipCourier = { name: string; phone?: string | null };

export type PayslipSnapshot = {
  hoursWorked?: number;
  hourlyPay?: number;
  hourlyRate?: number;
  deliveryEarnings?: number;
  commissionEarnings?: number;
  bonuses?: number;
};

function fmt(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '₪0.00';
  return `₪${n.toFixed(2)}`;
}

export function parseSettlementSnapshot(raw: string | null | undefined): PayslipSnapshot {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PayslipSnapshot;
  } catch {
    return {};
  }
}

export function buildSettlementPayslipHtml(
  settlement: CourierPayrollSettlement,
  courier: PayslipCourier
): string {
  const snap = parseSettlementSnapshot(settlement.snapshot);
  const period = `${settlement.periodStart} — ${settlement.periodEnd}`;
  const created = new Date(settlement.createdAt).toLocaleDateString('ar-IL');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>قسيمة راتب — ${escapeHtml(courier.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      color: #0f172a;
      direction: rtl;
    }
    .sheet {
      max-width: 640px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 24px rgba(15,23,42,0.08);
    }
    h1 { margin: 0 0 4px; font-size: 1.5rem; color: #0d9488; }
    .sub { color: #64748b; font-size: 0.9rem; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 10px 12px; text-align: right; border-bottom: 1px solid #f1f5f9; }
    th { color: #64748b; font-weight: 600; font-size: 0.85rem; }
    td.amount { font-weight: 600; text-align: left; direction: ltr; }
    .net {
      margin-top: 20px;
      padding: 16px;
      background: linear-gradient(135deg, #0d9488, #0f766e);
      color: #fff;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 1.25rem;
      font-weight: 800;
    }
    .notes { margin-top: 16px; font-size: 0.9rem; color: #475569; }
    .print-btn {
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 12px;
      background: #0d9488;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: none; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>قسيمة راتب السائق</h1>
    <p class="sub">Now Market · ${escapeHtml(created)}</p>

    <table>
      <tr><th>السائق</th><td>${escapeHtml(courier.name)}</td></tr>
      ${courier.phone ? `<tr><th>الهاتف</th><td dir="ltr">${escapeHtml(courier.phone)}</td></tr>` : ''}
      <tr><th>الفترة</th><td>${escapeHtml(period)}</td></tr>
    </table>

    <table>
      <thead>
        <tr><th>البند</th><th style="text-align:left">المبلغ</th></tr>
      </thead>
      <tbody>
        <tr><td>ساعات العمل</td><td class="amount">${(snap.hoursWorked ?? 0).toFixed(1)} س</td></tr>
        <tr><td>أجر ساعي</td><td class="amount">${fmt(snap.hourlyPay)}</td></tr>
        <tr><td>أرباح التوصيل</td><td class="amount">${fmt(snap.deliveryEarnings)}</td></tr>
        <tr><td>العمولات</td><td class="amount">${fmt(snap.commissionEarnings)}</td></tr>
        <tr><td>المكافآت</td><td class="amount">${fmt(snap.bonuses)}</td></tr>
        <tr><td>إجمالي المستحق (قبل المصاريف)</td><td class="amount">${fmt(settlement.grossAmount)}</td></tr>
        <tr><td>المصاريف المعتمدة</td><td class="amount">−${fmt(settlement.expensesAmount)}</td></tr>
      </tbody>
    </table>

    <div class="net">
      <span>صافي الراتب</span>
      <span>${fmt(settlement.netAmount)}</span>
    </div>

    ${settlement.notes ? `<p class="notes"><strong>ملاحظات:</strong> ${escapeHtml(settlement.notes)}</p>` : ''}

    <button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Test helper: verify payslip contains required labels and amounts. */
export function payslipContainsRequiredFields(html: string, settlement: CourierPayrollSettlement): boolean {
  const required = [
    'قسيمة راتب',
    settlement.periodStart,
    settlement.periodEnd,
    settlement.netAmount.toFixed(2),
    'أرباح التوصيل',
    'العمولات',
  ];
  return required.every((r) => html.includes(r));
}
