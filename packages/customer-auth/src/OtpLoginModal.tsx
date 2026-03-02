import { useState } from 'react';
import { Modal, Button, Input, useToast } from '@nmd/ui';
import { useCustomerAuth, type Customer } from './CustomerAuthContext';

interface OtpLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (customer: Customer) => void;
  showOtpInToast?: boolean;
}

function isValidIsraelPhone(v: string): boolean {
  const digits = v.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('05');
}

export function OtpLoginModal({ open, onClose, onSuccess, showOtpInToast = true }: OtpLoginModalProps) {
  const { start, verify } = useCustomerAuth();
  const { addToast } = useToast();
  const [step, setStep] = useState<'name-phone' | 'code'>('name-phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNamePhoneSubmit = async () => {
    setError('');
    const nameTrimmed = name.trim();
    const phoneTrimmed = phone.trim();
    if (!nameTrimmed) {
      setError('أدخل الاسم الكامل');
      return;
    }
    if (!phoneTrimmed) {
      setError('أدخل رقم الجوال');
      return;
    }
    if (!isValidIsraelPhone(phoneTrimmed)) {
      setError('رقم الجوال بصيغة إسرائيلية (05x-xxxxxxx)');
      return;
    }
    setLoading(true);
    const result = await start(phoneTrimmed);
    setLoading(false);
    if (result.ok) {
      if (result.devCode && showOtpInToast && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        addToast(`رمز التحقق (تجريبي): ${result.devCode}`, 'info');
      }
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
    if (code.trim().length !== 4) {
      setError('رمز التحقق 4 أرقام');
      return;
    }
    setLoading(true);
    const result = await verify(phone.trim(), code.trim(), name.trim());
    setLoading(false);
    if (result.ok && result.customer) {
      onSuccess?.(result.customer);
      onClose();
      reset();
    } else if (result.ok) {
      onClose();
      reset();
    } else {
      setError(result.error ?? 'رمز غير صحيح');
    }
  };

  const reset = () => {
    setStep('name-phone');
    setName('');
    setPhone('');
    setCode('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="NMD ID — تسجيل الدخول" size="sm">
      <div className="space-y-4" dir="rtl">
        {step === 'name-phone' ? (
          <>
            <Input label="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" />
            <Input
              label="رقم الجوال"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05x-xxxxxxx"
              dir="ltr"
              className="text-left"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" onClick={handleNamePhoneSubmit} loading={loading} disabled={loading}>
              إرسال رمز التحقق
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              تم إرسال رمز التحقق إلى {phone}
              {(import.meta as { env?: { DEV?: boolean } }).env?.DEV && <span className="block mt-1 text-xs text-amber-600">(تحقق من الكونسول أو التوست)</span>}
            </p>
            <Input
              label="رمز التحقق (4 أرقام)"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              dir="ltr"
              className="text-left"
              inputMode="numeric"
              maxLength={4}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep('name-phone')} disabled={loading}>
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
