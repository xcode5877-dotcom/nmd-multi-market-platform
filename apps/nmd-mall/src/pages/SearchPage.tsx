import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchProductsAcrossTenants, getTenantById } from '@nmd/mock';
import { formatMoney } from '@nmd/core';
import { Card, Button } from '@nmd/ui';
import { ExternalLink } from 'lucide-react';

const STOREFRONT_URL = import.meta.env.DEV ? 'http://localhost:5173' : '/storefront';

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/30 text-gray-900 px-0.5 rounded">{part}</mark>
    ) : (
      part
    )
  );
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [results, setResults] = useState<Array<{ tenantId: string; product: import('@nmd/core').Product }>>([]);

  useEffect(() => {
    setResults(searchProductsAcrossTenants(query));
  }, [query]);

  const byTenant = results.reduce<Record<string, typeof results>>((acc, r) => {
    if (!acc[r.tenantId]) acc[r.tenantId] = [];
    acc[r.tenantId].push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        نتائج البحث {query && <>عنت "<span className="text-primary">{query}</span>"</>}
      </h1>
      {!query ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">ابحث عن منتج أو محل في السوق</p>
        </div>
      ) : Object.keys(byTenant).length === 0 ? (
        <div className="py-16 text-center rounded-xl bg-white border border-gray-200 shadow-sm">
          <p className="text-4xl mb-4">🔍</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">لا توجد نتائج</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            لم نجد شيئاً عن &quot;{query}&quot;. جرّب كلمة أخرى أو تصفح المحلات.
          </p>
          <Link to="/stores" className="text-[#D97706] font-medium hover:underline">
            تصفح المحلات ←
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(byTenant).map(([tenantId, items]) => {
            const tenant = getTenantById(tenantId);
            const slug = tenant?.slug ?? tenantId;
            const storeUrl = `${STOREFRONT_URL}?tenant=${slug}`;
            return (
              <div key={tenantId} className="border-b border-gray-200 pb-8 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">{tenant?.name ?? tenantId}</h2>
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="w-4 h-4" />
                      فتح المتجر
                    </Button>
                  </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {items.map(({ product }) => (
                    <a
                      key={product.id}
                      href={`${STOREFRONT_URL}/p/${product.id}?tenant=${slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Card className="overflow-hidden h-48 flex flex-col hover:shadow-lg transition-shadow">
                        <div className="aspect-square w-full bg-gray-100 flex-shrink-0">
                          <img
                            src={product.images?.[0]?.url ?? product.imageUrl ?? 'https://placehold.co/400x400?text=No+Image'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3 flex flex-col flex-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {highlightMatch(product.name, query)}
                          </h3>
                          <p className="text-primary font-bold mt-auto">{formatMoney(product.basePrice)}</p>
                        </div>
                      </Card>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
