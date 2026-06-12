import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NativeBridgeProvider } from './contexts/NativeBridgeContext';
import { getApiBaseUrl } from './api';
import LoginPage from './pages/LoginPage';
import CourierDashboard from './pages/CourierDashboard';
import CourierOrdersPage from './pages/CourierOrdersPage';
import CourierRoutePage from './pages/CourierRoutePage';
import CourierProfilePage from './pages/CourierProfilePage';
import DriverExternalOrderPage from './pages/DriverExternalOrderPage';
import DriverExpensesPage from './pages/DriverExpensesPage';
import CourierEarningsPage from './pages/CourierEarningsPage';
import CourierNativeLayout from './components/CourierNativeLayout';

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
    <NativeBridgeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<CourierGuard><CourierNativeLayout /></CourierGuard>}>
            <Route index element={<CourierDashboard />} />
            <Route path="earnings" element={<CourierEarningsPage />} />
            <Route path="orders" element={<CourierOrdersPage />} />
            <Route path="route" element={<CourierRoutePage />} />
            <Route path="profile" element={<CourierProfilePage />} />
            <Route path="external-order" element={<DriverExternalOrderPage />} />
            <Route path="expenses" element={<DriverExpensesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </NativeBridgeProvider>
  );
}
