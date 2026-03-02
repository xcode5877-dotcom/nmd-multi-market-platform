import { useState } from 'react';
import { Modal, Button, Input, useToast } from '@nmd/ui';
import { useCustomerAuth, type Customer } from '../contexts/CustomerAuthContext';

interface OtpLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (customer: Customer) => void;
  /** When true, show OTP in toast for dev/testing */
  showOtpInToast?: boolean;
}

function isValidIsraelPhone(v: string): boolean {
  const digits = v.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('05');
}

type Step = 'phone' | 'code' | 'register';

export function OtpLoginModal({ open, onClose, onSuccess, showOtpInToast = true }: OtpLoginModalProps) {
  const { checkPhone, start, verify } = useCustomerAuth();
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = async () => {
    setError('');
    const phoneTrimmed = phone.trim();
    if (!phoneTrimmed) {
      setError('أدخل رقم الجوال');
      return;
    }
    if (!isValidIsraelPhone(phoneTrimmed)) {
      setError('رقم الجوال بصيغة إسرائيلية (05x-xxxxxxx)');
      return;
    }
    setLoading(true);
    const { exists } = await checkPhone(phoneTrimmed);
    const startResult = await start(phoneTrimmed);
    setLoading(false);
    if (!startResult.ok) {
      setError(startResult.error ?? 'حدث خطأ');
      return;
    }
    if (startResult.devCode && showOtpInToast && import.meta.env?.DEV) {
      addToast(`رمز التحقق (تجريبي): ${startResult.devCode}`, 'info');
    }
    setIsExistingUser(exists);
    setStep(exists ? 'code' : 'register');
    setCode('');
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
    const nameToSend = isExistingUser ? undefined : name.trim() || undefined;
    const result = await verify(phone.trim(), code.trim(), nameToSend);
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
    setStep('phone');
    setPhone('');
    setName('');
    setCode('');
    setIsExistingUser(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const goBackToPhone = () => {
    setStep('phone');
    setCode('');
    setError('');
  };

  return (
    <Modal open={open} onClose={handleClose} title="NMD ID — تسجيل الدخول" size="sm">
      <div className="space-y-4" dir="rtl">
        {step === 'phone' ? (
          <>
            <Input
              label="رقم الجوال"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05x-xxxxxxx"
              dir="ltr"
              className="text-left"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" onClick={handlePhoneSubmit} loading={loading} disabled={loading}>
              التالي
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              {isExistingUser ? (
                <>مرحباً بعودتك! أدخل الرمز المرسل إلى {phone}</>
              ) : (
                <>أنشئ هويتك NMD للمتابعة</>
              )}
              {import.meta.env?.DEV && (
                <span className="block mt-1 text-xs text-amber-600">(تحقق من الكونسول أو التوست)</span>
              )}
            </p>
            {step === 'register' && (
              <Input
                label="الاسم الكامل"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم الكامل"
              />
            )}
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
              <Button variant="ghost" className="flex-1" onClick={goBackToPhone} disabled={loading}>
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
