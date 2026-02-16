import { useState } from 'react';
import { Card, Button } from '@nmd/ui';
import { listTemplates, listTenants, updateTenant } from '@nmd/mock';
import type { Template } from '@nmd/core';

const STYLE_LABELS: Record<string, string> = {
  minimal: 'بسيط',
  cozy: 'مريح',
  bold: 'واضح',
  modern: 'حديث',
  default: 'افتراضي',
  compact: 'مضغوط',
  spacious: 'فسيح',
};

const TEMPLATE_COLORS: Record<string, string> = {
  minimal: '#6b7280',
  cozy: '#059669',
  bold: '#dc2626',
  modern: '#2563eb',
  default: '#0f766e',
  compact: '#7c3aed',
  spacious: '#d97706',
};

export default function SystemTemplatesPage() {
  const templates = listTemplates();
  const tenants = listTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const handleAssign = () => {
    if (!selectedTenantId || !selectedTemplateId) return;
    updateTenant(selectedTenantId, { templateId: selectedTemplateId });
    setSelectedTenantId('');
    setSelectedTemplateId('');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">قوالب النظام</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-lg mb-4">معرض القوالب</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {templates.map((t) => (
              <TemplatePreviewCard
                key={t.id}
                template={t}
                isSelected={selectedTemplateId === t.id}
                onSelect={() => setSelectedTemplateId(t.id)}
              />
            ))}
          </div>
        </div>

        <Card>
          <div className="p-6">
            <h2 className="font-semibold text-lg mb-4">تعيين قالب لمستأجر</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المستأجر</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">اختر المستأجر</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">القالب</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">اختر القالب</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({STYLE_LABELS[t.layoutStyle] ?? t.layoutStyle})
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={handleAssign} disabled={!selectedTenantId || !selectedTemplateId}>
                تعيين
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function TemplatePreviewCard({
  template,
  isSelected,
  onSelect,
}: {
  template: Template;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = TEMPLATE_COLORS[template.layoutStyle] ?? '#0f766e';
  return (
    <Card
      className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <div className="p-3">
        <div
          className="h-8 rounded-t-lg flex items-center justify-between px-3"
          style={{ backgroundColor: color }}
        >
          <span className="text-white text-xs font-medium">المتجر</span>
          <span className="w-2 h-2 rounded-full bg-white/80" />
        </div>
        <div className="border border-t-0 rounded-b-lg p-3 border-gray-200">
          <div className="flex gap-2 mb-2">
            <div className="w-12 h-12 rounded bg-gray-100" />
            <div className="flex-1">
              <div className="h-2 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-2 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
          <button
            type="button"
            className="w-full py-1.5 text-xs font-medium text-white rounded"
            style={{ backgroundColor: color }}
          >
            أضف للسلة
          </button>
        </div>
        <p className="text-sm font-medium text-gray-900 mt-2">{template.name}</p>
        <p className="text-xs text-gray-500">{STYLE_LABELS[template.layoutStyle] ?? template.layoutStyle}</p>
      </div>
    </Card>
  );
}
