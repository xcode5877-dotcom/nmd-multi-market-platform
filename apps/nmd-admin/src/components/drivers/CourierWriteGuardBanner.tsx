import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { useEmergencyMode } from '../../contexts/EmergencyModeContext';

const api = new MockApiClient();

/** ROOT_ADMIN must enable emergency mode with a reason before courier writes (matches MarketDispatchPage). */
export function CourierWriteGuardBanner() {
  const emergency = useEmergencyMode();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.getMe() });
  const isRootOnly = me?.role === 'ROOT_ADMIN';
  const canWrite = me?.role === 'SUPER_ADMIN' || (isRootOnly && !!emergency?.enabled && !!emergency?.reason?.trim());

  if (!me || canWrite) return null;

  return (
    <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm">
      <p className="font-medium">وضع القراءة فقط</p>
      <p className="mt-1 text-amber-800">
        لتعديل السائقين كمسؤول الجذر، فعّل <strong>وضع الطوارئ</strong> من الشريط الجانبي وأدخل سبباً للتعديل.
      </p>
    </div>
  );
}

export function useCourierWriteAccess() {
  const emergency = useEmergencyMode();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.getMe() });
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const isRootAdmin = me?.role === 'ROOT_ADMIN';
  const canWrite =
    isSuperAdmin || (isRootAdmin && !!emergency?.enabled && !!(emergency?.reason ?? '').trim());
  return { canWrite, me, isRootAdmin, isSuperAdmin };
}
