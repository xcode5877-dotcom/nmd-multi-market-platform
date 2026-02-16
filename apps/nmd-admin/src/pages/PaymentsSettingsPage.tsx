import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Modal } from '@nmd/ui';
import { ArrowLeft, Banknote, CreditCard, Lock, Check } from 'lucide-react';

export default function PaymentsSettingsPage() {
  const navigate = useNavigate();
  const [earlyAccessModalOpen, setEarlyAccessModalOpen] = useState(false);

  const handleRequestEarlyAccess = () => {
    setEarlyAccessModalOpen(true);
    // Placeholder: log for future integration
    console.log('[Payments] Request early access clicked');
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">Payment methods and capabilities</p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3">
            <Banknote className="w-6 h-6 text-emerald-600" />
            <div>
              <div className="font-medium text-gray-900">Cash</div>
              <div className="text-sm text-gray-600">Enabled</div>
            </div>
          </div>
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">
            <Check className="w-3.5 h-3.5" /> Enabled
          </span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200 opacity-75">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-gray-400" />
            <div>
              <div className="font-medium text-gray-700">Card</div>
              <div className="text-sm text-gray-500">Coming soon</div>
            </div>
            <Lock className="w-4 h-4 text-gray-400" />
          </div>
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
            <Lock className="w-3.5 h-3.5" /> Coming soon
          </span>
        </div>

        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={handleRequestEarlyAccess}>
            Request early access
          </Button>
        </div>
      </Card>

      <Modal open={earlyAccessModalOpen} onClose={() => setEarlyAccessModalOpen(false)} title="Request early access" size="sm">
        <p className="text-sm text-gray-600">Card payments are coming soon. We&apos;ll notify you when early access is available.</p>
      </Modal>
    </div>
  );
}
