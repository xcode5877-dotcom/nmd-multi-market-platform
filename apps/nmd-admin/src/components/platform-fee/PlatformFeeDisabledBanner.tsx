/** Shown when platform fee config UI is available but server flag may still be OFF. */
export default function PlatformFeeDisabledBanner() {
  return (
    <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm" dir="rtl">
      <p className="font-medium">الحسابات محفوظة لكن رسوم المنصة غير مفعّلة على الطلبات حاليًا</p>
      <p className="text-amber-800/90 mt-1 text-xs">
        يتم حفظ الإعدادات هنا للمعاينة والتجهيز. لتطبيق الرسوم على الطلبات الفعلية، يجب تفعيل{' '}
        <code className="text-xs bg-amber-100 px-1 rounded">PLATFORM_FEE_ENABLED=true</code> على الخادم.
      </p>
    </div>
  );
}
