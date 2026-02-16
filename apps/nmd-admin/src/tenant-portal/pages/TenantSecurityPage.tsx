import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const MIN_PASSWORD_LENGTH = 8;

export default function TenantSecurityPage() {
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState('');

  const changePasswordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      addToast('تم تغيير كلمة المرور بنجاح', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setClientError('');
    },
    onError: (e) => {
      addToast(e instanceof Error ? e.message : 'فشل تغيير كلمة المرور', 'error');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError('');

    if (newPassword !== confirmPassword) {
      setClientError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setClientError(`كلمة المرور الجديدة يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
      return;
    }
    if (!currentPassword.trim()) {
      setClientError('أدخل كلمة المرور الحالية');
      return;
    }

    changePasswordMutation.mutate();
  }

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">الأمان</h1>
        <Card className="p-6">
          <p className="text-sm text-gray-500">يتطلب الاتصال بواجهة برمجة التطبيقات</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">الأمان</h1>
      <Card className="p-6 max-w-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">تغيير كلمة المرور</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="كلمة المرور الحالية"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={changePasswordMutation.isPending}
          />
          <Input
            type="password"
            label="كلمة المرور الجديدة"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`${MIN_PASSWORD_LENGTH} أحرف على الأقل`}
            autoComplete="new-password"
            disabled={changePasswordMutation.isPending}
          />
          <Input
            type="password"
            label="تأكيد كلمة المرور الجديدة"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={changePasswordMutation.isPending}
          />
          {clientError && <p className="text-sm text-red-600">{clientError}</p>}
          <Button type="submit" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
