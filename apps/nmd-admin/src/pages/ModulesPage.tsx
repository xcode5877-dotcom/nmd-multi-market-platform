import { Card } from '@nmd/ui';

const MODULES = ['Commerce', 'Restaurant', 'Apparel', 'Inventory', 'Analytics'];

export default function ModulesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Modules</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {MODULES.map((name) => (
          <Card key={name} className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED] font-bold">
                {name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-gray-500">Module placeholder</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
