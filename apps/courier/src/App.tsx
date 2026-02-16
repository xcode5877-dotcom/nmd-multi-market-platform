import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getApiBaseUrl } from './api';
import LoginPage from './pages/LoginPage';
import CourierDashboard from './pages/CourierDashboard';
import CourierOrdersPage from './pages/CourierOrdersPage';
import CourierRoutePage from './pages/CourierRoutePage';

function CourierGuard({ children }: { children: React.ReactNode }) {
  const { authStatus } = useAuth();
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return <>{children}</>;
  if (authStatus === 'loading') return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  if (authStatus === 'guest') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/courier" element={<CourierGuard><CourierDashboard /></CourierGuard>} />
        <Route path="/courier/orders" element={<CourierGuard><CourierOrdersPage /></CourierGuard>} />
        <Route path="/courier/route" element={<CourierGuard><CourierRoutePage /></CourierGuard>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
