import { Link } from 'react-router-dom';
import { Card } from '@nmd/ui';
import { CreditCard } from 'lucide-react';

export default function SystemSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إعدادات النظام</h1>
      <Card className="p-6">
        <Link
          to="/settings/payments"
          className="flex items-center gap-3 p-4 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <CreditCard className="w-5 h-5 text-gray-600" />
          <div>
            <div className="font-medium text-gray-900">المدفوعات</div>
            <div className="text-sm text-gray-500">طرق الدفع والبوابات</div>
          </div>
        </Link>
      </Card>
    </div>
  );
}
