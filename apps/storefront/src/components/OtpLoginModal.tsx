import { useState } from 'react';
import { Modal, Button, Input } from '@nmd/ui';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';

interface OtpLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OtpLoginModal({ open, onClose, onSuccess }: OtpLoginModalProps) {
  const { start, verify } = useCustomerAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = async () => {
    setError('');
    if (!phone.trim()) {
      setError('أدخل رقم الجوال');
      return;
    }
    setLoading(true);
    const result = await start(phone.trim());
    setLoading(false);
    if (result.ok) {
      setStep('code');
      setCode('');
    } else {
      setError(result.error ?? 'حدث خطأ');
    }
  };

  const handleCodeSubmit = async () => {
    setError('');
    if (!code.trim()) {
      setError('أدخل رمز التحقق');
      return;
    }
    setLoading(true);
    const result = await verify(phone.trim(), code.trim());
    setLoading(false);
    if (result.ok) {
      onSuccess?.();
      onClose();
      setStep('phone');
      setPhone('');
      setCode('');
    } else {
      setError(result.error ?? 'رمز غير صحيح');
    }
  };

  const handleClose = () => {
    setStep('phone');
    setPhone('');
    setCode('');
    setError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="تسجيل الدخول" size="sm">
      <div className="space-y-4" dir="rtl">
        {step === 'phone' ? (
          <>
            <Input
              label="رقم الجوال"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              dir="ltr"
              className="text-left"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" onClick={handlePhoneSubmit} loading={loading} disabled={loading}>
              إرسال رمز التحقق
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">تم إرسال رمز التحقق إلى {phone}</p>
            <Input
              label="رمز التحقق"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              dir="ltr"
              className="text-left"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep('phone')} disabled={loading}>
                تغيير الرقم
              </Button>
              <Button className="flex-1" onClick={handleCodeSubmit} loading={loading} disabled={loading}>
                تأكيد
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
