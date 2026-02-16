import { useNavigate } from 'react-router-dom';
import { Button } from '@nmd/ui';
import { ArrowLeft } from 'lucide-react';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-md">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="text-lg font-semibold mb-2">403 ممنوع</h2>
        <p className="text-sm mb-4">لا يمكنك الوصول إلى هذا المورد.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Button>
      </div>
    </div>
  );
}
