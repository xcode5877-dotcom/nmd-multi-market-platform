import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../contexts/NativeBridgeContext';
import { LogOut, User } from 'lucide-react';

export default function CourierProfilePage() {
  const { user, logout } = useAuth();
  const { isNativeApp } = useNativeBridge();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {!isNativeApp && (
        <header className="bg-teal-600 text-white p-4 shadow">
          <h1 className="text-lg font-bold">حسابي</h1>
        </header>
      )}
      <main className="p-4 max-w-md mx-auto">
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.courier?.name ?? user.email}</p>
            <p className="text-sm text-gray-500">{user.market?.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </main>
    </div>
  );
}
