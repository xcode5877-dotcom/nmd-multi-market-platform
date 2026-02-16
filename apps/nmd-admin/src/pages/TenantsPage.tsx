import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, DataTable } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { LayoutDashboard, Store, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
const api = new MockApiClient();
const ADMIN_URL = import.meta.env?.DEV ? 'http://localhost:5174' : '/admin';
const STOREFRONT_URL = import.meta.env?.DEV ? 'http://localhost:5173' : '/storefront';

/** Global Tenants page: READ-ONLY monitoring for ROOT_ADMIN. MARKET_ADMIN is redirected. */
export default function TenantsPage() {
  const navigate = useNavigate();
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  });

  const rows = tenants.map((t) => {
    const marketId = (t as { marketId?: string }).marketId;
    return {
    name: (
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
          style={{ backgroundColor: t.primaryColor }}
        >
          {t.name.charAt(0)}
        </div>
        <div>
          <span className="font-medium">{t.name}</span>
          <span className="text-gray-500 text-sm me-2">/{t.slug}</span>
          {!t.enabled && <span className="text-red-500 text-xs">(معطل)</span>}
        </div>
      </div>
    ),
    status: (
      <span className={`inline-flex h-6 w-11 items-center rounded-full ${t.enabled ? 'bg-primary' : 'bg-gray-200'}`}>
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white ${
            t.enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    ),
    actions: (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {marketId && (
          <Link
            to={`/markets/${marketId}/tenants/${t.id}`}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            title="فتح في سياق السوق"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
        <a
          href={`${ADMIN_URL}/?tenant=${t.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title="لوحة التحكم"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <LayoutDashboard className="w-4 h-4" />
        </a>
        <a
          href={`${STOREFRONT_URL}?tenant=${t.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title="المتجر"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <Store className="w-4 h-4" />
        </a>
      </div>
    ),
  };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">المستأجرون (مراقبة)</h1>
        <p className="text-sm text-gray-500 mt-1">عرض فقط. لإنشاء أو تعديل مستأجر، انتقل إلى صفحة السوق.</p>
      </div>
      <Card>
        {tenants.length === 0 ? (
          <div className="p-12 text-center text-gray-500">لا يوجد مستأجرون</div>
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'المستأجر' },
              { key: 'status', label: 'مفعّل', className: 'w-24' },
              { key: 'actions', label: 'إجراءات', className: 'w-48' },
            ]}
            rows={rows}
            onRowClick={(_row, index) => navigate(`/tenants/${tenants[index].id}`)}
          />
        )}
      </Card>
    </div>
  );
}
