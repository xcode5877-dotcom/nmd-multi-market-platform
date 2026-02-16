import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listCampaigns, toggleCampaignStatus, deleteCampaign } from '@nmd/mock';
import type { Campaign } from '@nmd/core';
import { Card, Button, Badge } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { Plus } from 'lucide-react';

export default function CampaignsPage() {
  const { tenantId } = useAdminContext();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    setCampaigns(listCampaigns(tenantId));
  }, [tenantId]);

  const refresh = () => setCampaigns(listCampaigns(tenantId));

  const handleToggle = (id: string) => {
    toggleCampaignStatus(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteCampaign(id);
    refresh();
  };

  const typeLabel = (t: Campaign['type']) => (t === 'PERCENT' ? '%' : t === 'FIXED' ? '₪' : 'حزمة');
  const statusVariant = (s: Campaign['status']) =>
    s === 'active' ? 'primary' : s === 'paused' ? 'warning' : 'default';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الحملات</h1>
        <Link to="/campaigns/new">
          <Button>
            <Plus className="w-4 h-4" />
            إضافة حملة
          </Button>
        </Link>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-start py-3 px-4">الاسم</th>
                <th className="text-start py-3 px-4">الحالة</th>
                <th className="text-start py-3 px-4">النوع</th>
                <th className="text-start py-3 px-4">القيمة</th>
                <th className="text-start py-3 px-4">النطاق</th>
                <th className="text-start py-3 px-4">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium">{c.name}</td>
                  <td className="py-3 px-4">
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="py-3 px-4">{c.type}</td>
                  <td className="py-3 px-4">
                    {c.value}
                    {typeLabel(c.type)}
                  </td>
                  <td className="py-3 px-4">{c.appliesTo}</td>
                  <td className="py-3 px-4 flex gap-2">
                    <Link to={`/campaigns/${c.id}/edit`}>
                      <Button variant="outline" size="sm">
                        تعديل
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(c.id)}
                    >
                      {c.status === 'active' ? 'إيقاف' : 'تفعيل'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleDelete(c.id)}
                    >
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {campaigns.length === 0 && (
          <div className="p-6 text-center text-gray-500">لا توجد حملات</div>
        )}
      </Card>
    </div>
  );
}
