import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { useAuth } from '../contexts/AuthContext';
import { MockApiClient } from '@nmd/mock';
import { Shield } from 'lucide-react';

const api = new MockApiClient();
const MIN_PASSWORD_LENGTH = 6;

export default function ChangePasswordPage() {
  const { refetchUser } = useAuth();
  const addToast = useToast().addToast;
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!currentPassword.trim()) {
      setError('أدخل كلمة المرور الحالية');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`كلمة المرور الجديدة يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      addToast('تم تغيير كلمة المرور بنجاح', 'success');
      await refetchUser();
      navigate('/', { replace: true });
    } catch {
      addToast('فشل تغيير كلمة المرور — تحقق من كلمة المرور الحالية', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50" dir="rtl">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-8 h-8 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900">تغيير كلمة المرور مطلوب</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          تم تعيين كلمة مرور مؤقتة لك. يرجى تغييرها الآن قبل المتابعة.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="كلمة المرور الحالية"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loading}
          />
          <Input
            type="password"
            label="كلمة المرور الجديدة"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`${MIN_PASSWORD_LENGTH} أحرف على الأقل`}
            autoComplete="new-password"
            disabled={loading}
          />
          <Input
            type="password"
            label="تأكيد كلمة المرور الجديدة"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'جاري الحفظ...' : 'تغيير كلمة المرور والمتابعة'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
