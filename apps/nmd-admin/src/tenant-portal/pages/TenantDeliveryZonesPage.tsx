import { Card } from '@nmd/ui';
import { useTenant } from '../contexts/TenantContext';

export default function TenantDeliveryZonesPage() {
  const { tenantId } = useTenant();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">مناطق التوصيل</h1>
      <Card className="p-6">
        <p className="text-sm text-gray-500">tenantId: {tenantId ?? '—'}</p>
        <p className="text-sm text-gray-400 mt-4">Coming next: إدارة مناطق التوصيل</p>
      </Card>
    </div>
  );
}
