import { useState, useEffect } from 'react';
import { Modal, Button, Input, useToast } from '@nmd/ui';
import { useCustomerAuth, type Customer } from '../contexts/CustomerAuthContext';

const OTP_RESEND_COOLDOWN_SEC = 60;

/**
 * Global Identity (NMD ID): single phone → Send Code → 6-digit OTP → Verify.
 * Resend is disabled for 60s after sending. Session (nmd-customer-token) is shared across Market, Store, Pro.
 */
interface OtpLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (customer: Customer) => void;
  showOtpInToast?: boolean; // ignored: OTP is only sent via WhatsApp, never shown in UI
}

function isValidIsraelPhone(v: string): boolean {
  const digits = v.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('05');
}

type AuthMode = 'LOGIN' | 'SIGNUP';
type Step = 'phone' | 'code' | 'profile';

export function OtpLoginModal({ open, onClose, onSuccess, showOtpInToast: _showOtpInToast }: OtpLoginModalProps) {
  const { checkPhone, start, verify, updateProfile } = useCustomerAuth();
  const { addToast } = useToast();
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
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
    if (mode === 'SIGNUP' && !name.trim()) {
      setError('أدخل الاسم الكامل');
      return;
    }
    setLoading(true);
    if (mode === 'LOGIN') {
      const { exists } = await checkPhone(phoneTrimmed);
      if (!exists) {
        setLoading(false);
        setError('رقم غير مسجل. اضغط "إنشاء حساب جديد" للتسجيل.');
        return;
      }
    }
    const startResult = await start(phoneTrimmed);
    setLoading(false);
    if (!startResult.ok) {
      setError(startResult.error ?? 'حدث خطأ');
      return;
    }
    addToast('تم إرسال الرمز إلى جوالك', 'info');
    setStep('code');
    setCode('');
    setResendCountdown(OTP_RESEND_COOLDOWN_SEC);
  };

  const handleCodeSubmit = async () => {
    setError('');
    if (!code.trim() || code.trim().length !== 6) {
      setError('أدخل رمز التحقق (6 أرقام)');
      return;
    }
    if (mode === 'SIGNUP' && !name.trim()) {
      setError('الاسم الكامل مطلوب');
      return;
    }
    setLoading(true);
    const nameToSend = mode === 'SIGNUP' ? name.trim() : undefined;
    const result = await verify(phone.trim(), code.trim(), nameToSend);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'رمز غير صحيح');
      return;
    }
    if (result.customer && result.customer.name && result.customer.name.trim()) {
      onSuccess?.(result.customer);
      onClose();
      reset();
      return;
    }
    if (result.isNewUser && result.customer) {
      setName(result.customer.name?.trim() ?? '');
      setStep('profile');
      setError('');
      return;
    }
    onSuccess?.(result.customer!);
    onClose();
    reset();
  };

  const handleProfileSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('أدخل الاسم الكامل');
      return;
    }
    setLoading(true);
    const result = await updateProfile(name.trim());
    setLoading(false);
    if (result.ok && result.customer) {
      onSuccess?.(result.customer);
      onClose();
      reset();
    } else {
      setError(result.error ?? 'حدث خطأ');
    }
  };

  const reset = () => {
    setMode('LOGIN');
    setStep('phone');
    setPhone('');
    setName('');
    setCode('');
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

  const modalTitle = mode === 'SIGNUP' ? 'إنشاء حساب جديد' : 'تسجيل الدخول';

  return (
    <Modal open={open} onClose={handleClose} title={modalTitle} size="sm">
      <div className="space-y-4" dir="rtl">
        {step === 'phone' && (
          <>
            <Input
              label="رقم الجوال"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05x-xxxxxxx"
              dir="ltr"
              className="text-left"
            />
            {mode === 'SIGNUP' && (
              <Input
                label="الاسم الكامل (مطلوب)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم الكامل"
              />
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              className="w-full"
              onClick={handleSendCode}
              loading={loading}
              disabled={loading || (mode === 'SIGNUP' && !name.trim())}
            >
              إرسال الرمز
            </Button>
            {mode === 'LOGIN' ? (
              <button
                type="button"
                onClick={() => { setMode('SIGNUP'); setError(''); }}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                إنشاء حساب جديد
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setMode('LOGIN'); setError(''); setName(''); }}
                className="w-full text-center text-sm text-gray-600 hover:underline"
              >
                لديك حساب؟ تسجيل الدخول
              </button>
            )}
          </>
        )}

        {step === 'code' && (
          <>
            <p className="text-sm text-gray-600">
              أدخل الرمز المرسل إلى {phone}
              <span className="block mt-1 text-xs text-amber-600">(تحقق من الواتساب)</span>
            </p>
            {mode === 'SIGNUP' && name.trim() && (
              <p className="text-sm text-gray-500">الاسم: {name}</p>
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
                <Button
                  className="flex-1"
                  onClick={handleCodeSubmit}
                  loading={loading}
                  disabled={loading || (mode === 'SIGNUP' && !name.trim())}
                >
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

        {step === 'profile' && (
          <>
            <p className="text-sm text-gray-600">أكمل اسمك للمتابعة</p>
            <Input
              label="الاسم الكامل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم الكامل"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" onClick={handleProfileSubmit} loading={loading} disabled={loading || !name.trim()}>
              حفظ والمتابعة
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
