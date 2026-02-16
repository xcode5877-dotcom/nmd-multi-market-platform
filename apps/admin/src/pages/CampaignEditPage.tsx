import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getCampaign,
  createCampaign,
  updateCampaign,
} from '@nmd/mock';
import type { Campaign } from '@nmd/core';
import { Card, Button, Input, Select } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useAdminData } from '../hooks/useAdminData';

export default function CampaignEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useAdminContext();
  const adminData = useAdminData(tenantId);
  const categories = adminData.getCategories();
  const products = adminData.getProducts();

  const [form, setForm] = useState({
    name: '',
    status: 'draft' as Campaign['status'],
    type: 'PERCENT' as Campaign['type'],
    value: 0,
    appliesTo: 'ALL' as Campaign['appliesTo'],
    categoryIds: [] as string[],
    productIds: [] as string[],
    startAt: '',
    endAt: '',
    stackable: false,
    priority: 0,
  });

  useEffect(() => {
    if (id) {
      const c = getCampaign(id);
      if (c) {
        setForm({
          name: c.name,
          status: c.status,
          type: c.type,
          value: c.value,
          appliesTo: c.appliesTo ?? 'ALL',
          categoryIds: c.categoryIds ?? [],
          productIds: c.productIds ?? [],
          startAt: c.startAt ?? '',
          endAt: c.endAt ?? '',
          stackable: c.stackable ?? false,
          priority: c.priority ?? 0,
        });
      }
    }
  }, [id]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      tenantId,
      name: form.name,
      status: form.status,
      type: form.type,
      value: form.value,
      appliesTo: form.appliesTo,
      categoryIds: form.appliesTo === 'CATEGORIES' ? form.categoryIds : undefined,
      productIds: form.appliesTo === 'PRODUCTS' ? form.productIds : undefined,
      startAt: form.startAt || undefined,
      endAt: form.endAt || undefined,
      stackable: form.stackable,
      priority: form.priority ?? 0,
    };
    if (id) {
      updateCampaign(id, payload);
    } else {
      createCampaign(payload);
    }
    navigate('/campaigns');
  };

  const toggleCategory = (catId: string) => {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(catId)
        ? f.categoryIds.filter((x) => x !== catId)
        : [...f.categoryIds, catId],
    }));
  };
  const toggleProduct = (prodId: string) => {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(prodId)
        ? f.productIds.filter((x) => x !== prodId)
        : [...f.productIds, prodId],
    }));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {id ? 'تعديل الحملة' : 'إضافة حملة'}
        </h1>
        <Link to="/campaigns">
          <Button variant="ghost">إلغاء</Button>
        </Link>
      </div>
      <Card className="p-6 max-w-2xl">
        <div className="space-y-4">
          <Input
            label="الاسم"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="الحالة"
            options={[
              { value: 'draft', label: 'مسودة' },
              { value: 'active', label: 'نشطة' },
              { value: 'paused', label: 'متوقفة' },
            ]}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Campaign['status'] }))}
          />
          <Select
            label="النوع"
            options={[
              { value: 'PERCENT', label: 'نسبة مئوية' },
              { value: 'FIXED', label: 'مبلغ ثابت' },
            ]}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Campaign['type'] }))}
          />
          <Input
            label="القيمة"
            type="number"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: +e.target.value }))}
          />
          <Select
            label="ينطبق على"
            options={[
              { value: 'ALL', label: 'الكل' },
              { value: 'CATEGORIES', label: 'تصنيفات' },
              { value: 'PRODUCTS', label: 'منتجات' },
            ]}
            value={form.appliesTo}
            onChange={(e) =>
              setForm((f) => ({ ...f, appliesTo: e.target.value as Campaign['appliesTo'] }))
            }
          />
          {form.appliesTo === 'CATEGORIES' && (
            <div>
              <label className="block text-sm font-medium mb-2">التصنيفات</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={`px-3 py-1 rounded-lg text-sm border ${
                      form.categoryIds.includes(c.id) ? 'bg-primary text-white border-primary' : 'border-gray-300'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {form.appliesTo === 'PRODUCTS' && (
            <div>
              <label className="block text-sm font-medium mb-2">المنتجات</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className={`px-3 py-1 rounded-lg text-sm border ${
                      form.productIds.includes(p.id) ? 'bg-primary text-white border-primary' : 'border-gray-300'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input
            label="بداية (اختياري)"
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
          />
          <Input
            label="نهاية (اختياري)"
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.stackable}
              onChange={(e) => setForm((f) => ({ ...f, stackable: e.target.checked }))}
            />
            قابلة للتراكم
          </label>
        </div>
        <div className="mt-6">
          <Button onClick={handleSave}>حفظ</Button>
        </div>
      </Card>
    </div>
  );
}
