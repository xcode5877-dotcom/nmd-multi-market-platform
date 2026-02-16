import { Card } from '@nmd/ui';
import { Copy, Key } from 'lucide-react';

export default function ApiIntegrationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">API & Integrations</h1>
      <p className="text-sm text-gray-500 mb-6">API-ready. Built for scale.</p>
      <div className="space-y-6">
        <Card>
          <div className="p-6">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Key className="w-5 h-5" />
              Access Token
            </h2>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-100 font-mono text-sm">
              <span className="text-gray-600">nmd_••••••••••••••••••••••••••••••••</span>
              <button type="button" className="p-1 rounded hover:bg-gray-200">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Webhooks</h2>
            <div className="h-20 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 text-sm">
              Webhook placeholder
            </div>
          </div>
        </Card>
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Integrations</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {['Stripe', 'WhatsApp', 'Analytics'].map((name) => (
              <Card key={name} className="p-4 hover:border-[#7C3AED]/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm">
                    {name.charAt(0)}
                  </div>
                  <span className="font-medium">{name}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
