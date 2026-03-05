import { useState, useEffect } from 'react';
import { Modal, Button, Input, useToast } from '@nmd/ui';
import { useCustomerAuth, type Customer } from './CustomerAuthContext';

const OTP_RESEND_COOLDOWN_SEC = 60;

/** Global Identity: single phone → Send Code → 6-digit OTP → Verify. Session (nmd-customer-token) shared across Market, Store, Pro. */
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
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
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
    const result = await start(phoneTrimmed);
    setLoading(false);
    if (result.ok) {
      if (result.devCode) {
        if (showOtpInToast) addToast(`رمز التحقق (تجريبي): ${result.devCode}`, 'info');
        if (typeof console !== 'undefined' && console.log) console.log('[OTP] رمز التحقق (للتجربة):', result.devCode);
      }
      setStep('code');
      setCode('');
      setResendCountdown(OTP_RESEND_COOLDOWN_SEC);
    } else {
      setError(result.error ?? 'حدث خطأ');
    }
  };

  const handleCodeSubmit = async () => {
    setError('');
    if (!code.trim() || code.trim().length !== 6) {
      setError('أدخل رمز التحقق (6 أرقام)');
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
    setStep('phone');
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
                <Button variant="ghost" className="flex-1" onClick={() => setStep('phone')} disabled={loading}>
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
