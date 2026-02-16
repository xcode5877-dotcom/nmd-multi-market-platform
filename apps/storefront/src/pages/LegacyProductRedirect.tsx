import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { listEnabledTenants } from '@nmd/mock';
import { Card } from '@nmd/ui';

/**
 * Legacy route /p/:productId with no tenant in path.
 * If ?tenant=slug present, redirect to /:slug/p/:productId.
 * Else show choose-store list.
 */
export default function LegacyProductRedirect() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const tenants = listEnabledTenants();

  if (tenantSlug && productId) {
    return <Navigate to={`/${tenantSlug}/p/${productId}`} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50" dir="rtl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">اختر المتجر لعرض المنتج</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
        {tenants.map((t) => (
          <Card
            key={t.id}
            className="h-24 flex flex-col items-center justify-center p-4 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => {
              window.location.href = `/${t.slug}/p/${productId}`;
            }}
          >
            <span className="font-semibold text-gray-900 text-center">{t.name}</span>
          </Card>
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-4">
        أو أضف <code className="bg-gray-200 px-1 rounded">?tenant=pizza</code> للرابط
      </p>
    </div>
  );
}
