import { useState, useEffect } from 'react';
import { Modal, Button, Input, useToast } from '@nmd/ui';
import { useCustomerAuth, type Customer } from '../contexts/CustomerAuthContext';

const OTP_RESEND_COOLDOWN_SEC = 60;

/** Global Identity (NMD ID): phone → Send Code → 6-digit OTP → Verify. Session (nmd-customer-token) shared across Market, Store, Pro. */
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
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setInterval(() => setResendCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);

  const handleSendCode = async () => {
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
    if (startResult.whatsAppSent === false) {
      addToast('تم إنشاء الرمز لكن لم يتم إرساله عبر واتساب. تحقق من التطبيق أو جرّب لاحقاً.', 'info');
    }
    if (startResult.devCode) {
      if (showOtpInToast) addToast(`رمز التحقق (تجريبي): ${startResult.devCode}`, 'info');
      if (typeof console !== 'undefined' && console.log) console.log('[OTP] رمز التحقق (للتجربة):', startResult.devCode);
    }
    setIsExistingUser(exists);
    setStep(exists ? 'code' : 'register');
    setCode('');
    setResendCountdown(OTP_RESEND_COOLDOWN_SEC);
  };

  const handleCodeSubmit = async () => {
    setError('');
    if (!code.trim()) {
      setError('أدخل رمز التحقق');
      return;
    }
    if (code.trim().length !== 6) {
      setError('رمز التحقق 6 أرقام');
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
            <Button className="w-full" onClick={handleSendCode} loading={loading} disabled={loading}>
              إرسال الرمز
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
              label="رمز التحقق (6 أرقام)"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              dir="ltr"
              className="text-left"
              inputMode="numeric"
              maxLength={6}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={goBackToPhone} disabled={loading}>
                  تغيير الرقم
                </Button>
                <Button className="flex-1" onClick={handleCodeSubmit} loading={loading} disabled={loading}>
                  تحقق
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSendCode}
                loading={loading && resendCountdown === 0}
                disabled={resendCountdown > 0 || loading}
              >
                {resendCountdown > 0 ? `إعادة الإرسال بعد ${resendCountdown} ثانية` : 'إعادة إرسال الرمز'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
