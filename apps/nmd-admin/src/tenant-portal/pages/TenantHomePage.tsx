import { Card } from '@nmd/ui';
import { useTenant } from '../contexts/TenantContext';

export default function TenantHomePage() {
  const { tenantId, tenant } = useTenant();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">لوحة المستأجر</h1>
      <Card className="p-6 max-w-lg">
        <p className="text-sm text-gray-500 mb-2">tenantId (من الرمز): {tenantId ?? '—'}</p>
        <p className="text-sm text-gray-600">المستأجر: {tenant?.name ?? 'جاري التحميل...'}</p>
        <p className="text-xs text-gray-400 mt-4">Coming next: إحصائيات، طلبات حديثة، إلخ.</p>
      </Card>
    </div>
  );
}
