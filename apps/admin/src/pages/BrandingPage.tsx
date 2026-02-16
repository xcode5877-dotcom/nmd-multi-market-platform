import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Input, Select, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { createAdminData } from '../store/admin-data';
import { getTenantById, uploadFiles } from '@nmd/mock';
import { MockApiClient } from '@nmd/mock';
import type { TenantBranding, StorefrontHero, StorefrontBanner } from '@nmd/core';
import { tenantBrandingToCssVars, generateId, formatMoney } from '@nmd/core';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const DEFAULT_HERO: StorefrontHero = {
  title: 'مرحباً بك',
  subtitle: 'اكتشف أفضل المنتجات لدينا',
  ctaText: 'تسوق الآن',
  ctaLink: '#',
  ctaHref: '#',
};

function normalizeHero(h: StorefrontHero | undefined): StorefrontHero {
  const base = h ?? DEFAULT_HERO;
  const cta = base.ctaHref ?? base.ctaLink ?? '#';
  return { ...base, ctaLink: cta, ctaHref: cta };
}

export default function BrandingPage() {
  const { tenantId } = useAdminContext();
  const addToast = useToast().addToast;
  const adminData = createAdminData(tenantId);

  const { data: tenantFromApi } = useQuery({
    queryKey: ['tenant-registry', tenantId],
    queryFn: () => api.getTenantById(tenantId),
    enabled: !!tenantId && USE_API,
  });

  const tenant = USE_API ? tenantFromApi : getTenantById(tenantId);
  const defaultBranding: TenantBranding = tenant ? {
    logoUrl: tenant.logoUrl ?? '',
    primaryColor: tenant.primaryColor ?? '#0f766e',
    secondaryColor: tenant.secondaryColor ?? '#d4a574',
    fontFamily: tenant.fontFamily ?? '"Cairo", system-ui, sans-serif',
    radiusScale: tenant.radiusScale ?? 1,
    layoutStyle: tenant.layoutStyle ?? 'default',
    hero: normalizeHero(tenant.hero),
    banners: tenant.banners ?? [],
    whatsappPhone: (tenant as { whatsappPhone?: string }).whatsappPhone ?? '',
  } : {
    logoUrl: '',
    primaryColor: '#0f766e',
    secondaryColor: '#d4a574',
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1,
    layoutStyle: 'default',
    hero: DEFAULT_HERO,
    banners: [],
  };
  const stored = USE_API ? null : adminData.getBranding();
  const [form, setForm] = useState<TenantBranding>(() => ({
    ...defaultBranding,
    ...(stored ?? {}),
    hero: normalizeHero(stored?.hero ?? defaultBranding.hero),
    banners: stored?.banners ?? defaultBranding.banners ?? [],
  }));
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingBanners, setUploadingBanners] = useState(false);
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenant) {
      setForm((f) => ({
        ...f,
        logoUrl: tenant.logoUrl ?? f.logoUrl ?? '',
        hero: normalizeHero(tenant.hero),
        banners: tenant.banners ?? [],
        whatsappPhone: (tenant as { whatsappPhone?: string }).whatsappPhone ?? f.whatsappPhone ?? '',
      }));
    }
  }, [tenant?.id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/') || !USE_API) {
      if (!USE_API) addToast('رفع الصور يتطلب تشغيل Mock API', 'error');
      e.target.value = '';
      return;
    }
    setUploadingLogo(true);
    try {
      const urls = await uploadFiles([file]);
      if (urls[0]) setForm((f) => ({ ...f, logoUrl: urls[0] }));
      addToast('تم رفع الشعار', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/') || !USE_API) {
      if (!USE_API) addToast('رفع الصور يتطلب تشغيل Mock API', 'error');
      e.target.value = '';
      return;
    }
    setUploadingHero(true);
    try {
      const urls = await uploadFiles([file]);
      if (urls[0]) setForm((f) => ({ ...f, hero: { ...(f.hero ?? DEFAULT_HERO), imageUrl: urls[0] } }));
      addToast('تم رفع صورة الهيرو', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    } finally {
      setUploadingHero(false);
      e.target.value = '';
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length || !USE_API) {
      if (!USE_API && files.length) addToast('رفع الصور يتطلب تشغيل Mock API', 'error');
      e.target.value = '';
      return;
    }
    setUploadingBanners(true);
    try {
      const urls = await uploadFiles(files);
      const list = form.banners ?? [];
      const maxOrder = list.length > 0 ? Math.max(...list.map((b) => b.sortOrder ?? 0)) : -1;
      const newBanners = urls.map((url, i) => ({
        id: generateId(),
        imageUrl: url,
        enabled: true,
        isActive: true,
        sortOrder: maxOrder + 1 + i,
      }));
      setForm((f) => ({ ...f, banners: [...(f.banners ?? []), ...newBanners] }));
      addToast(`تم رفع ${urls.length} صورة`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    } finally {
      setUploadingBanners(false);
      e.target.value = '';
    }
  };

  const handleBannerDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setBannerDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      const input = bannerInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  const handleBannerImageReplace = async (bannerId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/') || !USE_API) {
      if (!USE_API) addToast('رفع الصور يتطلب تشغيل Mock API', 'error');
      e.target.value = '';
      return;
    }
    setUploadingBanners(true);
    try {
      const urls = await uploadFiles([file]);
      if (urls[0]) updateBanner(bannerId, { imageUrl: urls[0] });
      addToast('تم استبدال الصورة', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    } finally {
      setUploadingBanners(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    const vars = tenantBrandingToCssVars(form);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [form]);

  const save = async () => {
    setSaving(true);
    const base = form.hero ?? DEFAULT_HERO;
    const heroToSave: StorefrontHero = {
      title: base.title ?? '',
      subtitle: base.subtitle ?? '',
      imageUrl: base.imageUrl,
      ctaText: base.ctaText,
      ctaLink: base.ctaHref ?? base.ctaLink ?? '#',
      ctaHref: base.ctaHref ?? base.ctaLink ?? '#',
    };
    const bannersToSave = (form.banners ?? []).map((b) => {
      const cta = b.ctaHref ?? b.link ?? '';
      return {
        ...b,
        enabled: b.isActive ?? b.enabled ?? true,
        ctaHref: cta,
        link: cta,
      };
    });
    const whatsappPhone = /^\d*$/.test(form.whatsappPhone ?? '') ? (form.whatsappPhone ?? '').trim() : (form.whatsappPhone ?? '').replace(/\D/g, '');
    try {
      if (USE_API) {
        await api.updateBrandingApi(tenantId, { logoUrl: form.logoUrl, hero: heroToSave, banners: bannersToSave, whatsappPhone });
      } else {
        adminData.setBranding({ ...form, whatsappPhone });
        if (tenant) {
          const { updateTenant } = await import('@nmd/mock');
          updateTenant(tenantId, { logoUrl: form.logoUrl, hero: heroToSave, banners: bannersToSave, whatsappPhone });
        }
      }
      addToast('تم حفظ التغييرات', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addBanner = () => {
    setForm((f) => {
      const list = f.banners ?? [];
      const nextOrder = list.length > 0 ? Math.max(...list.map((b) => b.sortOrder ?? 0)) + 1 : 0;
      return {
        ...f,
        banners: [...list, { id: generateId(), imageUrl: '', enabled: true, isActive: true, sortOrder: nextOrder }],
      };
    });
  };

  const updateBanner = (id: string, updates: Partial<StorefrontBanner>) => {
    setForm((f) => ({
      ...f,
      banners: (f.banners ?? []).map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  };

  const removeBanner = (id: string) => {
    setForm((f) => ({ ...f, banners: (f.banners ?? []).filter((b) => b.id !== id) }));
  };

  const moveBanner = (id: string, direction: 'up' | 'down') => {
    setForm((f) => {
      const list = [...(f.banners ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const idx = list.findIndex((b) => b.id === id);
      if (idx === -1) return f;
      if (direction === 'up' && idx === 0) return f;
      if (direction === 'down' && idx === list.length - 1) return f;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      const [a, b] = [list[idx], list[swapIdx]];
      const aOrder = a.sortOrder ?? idx;
      const bOrder = b.sortOrder ?? swapIdx;
      list[idx] = { ...a, sortOrder: bOrder };
      list[swapIdx] = { ...b, sortOrder: aOrder };
      return { ...f, banners: list };
    });
  };

  return (
    <div className="pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">العلامة التجارية والمتجر</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <div className="p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">الشعار والألوان</h2>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">الشعار</label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {form.logoUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
                    <img src={form.logoUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo || !USE_API}
                    >
                      {uploadingLogo ? 'جاري الرفع...' : 'استبدال'}
                    </Button>
                    {!USE_API && <span className="text-xs text-amber-600">يتطلب Mock API</span>}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo || !USE_API}
                  className="w-full py-6 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-primary transition-colors"
                >
                  {uploadingLogo ? (
                    <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <span className="text-2xl">📷</span>
                  )}
                  <span className="text-sm">{uploadingLogo ? 'جاري الرفع...' : 'رفع شعار'}</span>
                  {!USE_API && <span className="text-xs text-amber-600">يتطلب Mock API</span>}
                </button>
              )}
            </div>
            <Input
              label="اللون الأساسي"
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
            />
            <Input
              label="اللون الثانوي"
              type="color"
              value={form.secondaryColor}
              onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
            />
            <Input
              label="خط العائلة"
              value={form.fontFamily}
              onChange={(e) => setForm((f) => ({ ...f, fontFamily: e.target.value }))}
            />
            <Input
              label="مقياس الحواف"
              type="number"
              step={0.25}
              min={0.5}
              max={2}
              value={form.radiusScale}
              onChange={(e) => setForm((f) => ({ ...f, radiusScale: +e.target.value }))}
            />
            <Select
              label="نمط التخطيط"
              options={[
                { value: 'default', label: 'افتراضي' },
                { value: 'compact', label: 'مضغوط' },
                { value: 'spacious', label: 'واسع' },
              ]}
              value={form.layoutStyle}
              onChange={(e) =>
                setForm((f) => ({ ...f, layoutStyle: e.target.value as TenantBranding['layoutStyle'] }))
              }
            />
            <Input
              label="رقم واتساب لاستقبال الطلبات"
              value={form.whatsappPhone ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setForm((f) => ({ ...f, whatsappPhone: v }));
              }}
              placeholder="966501234567"
              dir="ltr"
            />
            <p className="text-xs text-gray-500">أرقام فقط مع رمز الدولة (مثال: 966501234567)</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-600 mb-4">معاينة مباشرة</p>
            <div
              className="rounded-xl border border-gray-200 overflow-hidden bg-white"
              style={{ fontFamily: form.fontFamily }}
            >
              <div
                className="h-12 px-4 flex items-center justify-between"
                style={{ backgroundColor: form.primaryColor, color: 'white' }}
              >
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="" className="h-8 object-contain" />
                ) : (
                  <span className="text-sm font-bold">اسم المتجر</span>
                )}
                <span className="text-xs opacity-90">القائمة</span>
              </div>
              <div className="p-4 space-y-3">
                <div
                  className="rounded-lg border overflow-hidden"
                  style={{
                    borderRadius: `calc(0.5rem * ${form.radiusScale})`,
                    borderColor: form.secondaryColor + '40',
                  }}
                >
                  <div
                    className="aspect-square bg-gray-100"
                    style={{ backgroundColor: form.secondaryColor + '20' }}
                  />
                  <div className="p-2">
                    <p className="font-medium text-sm" style={{ color: form.primaryColor }}>منتج تجريبي</p>
                    <p className="text-xs text-gray-500">{formatMoney(25)}</p>
                    <button
                      type="button"
                      className="mt-2 w-full py-1.5 text-xs font-medium text-white rounded"
                      style={{ backgroundColor: form.primaryColor, borderRadius: `calc(0.25rem * ${form.radiusScale})` }}
                    >
                      أضف للسلة
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">هيرو الصفحة الرئيسية</h2>
          <Input
            label="عنوان الهيرو"
            value={form.hero?.title ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, hero: { ...(f.hero ?? DEFAULT_HERO), title: e.target.value } }))}
          />
          <Input
            label="وصف قصير"
            value={form.hero?.subtitle ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, hero: { ...(f.hero ?? DEFAULT_HERO), subtitle: e.target.value } }))}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">صورة الهيرو</label>
            <input
              ref={heroInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHeroUpload}
            />
            {form.hero?.imageUrl ? (
              <div className="space-y-2">
                <div className="aspect-[3/1] max-h-40 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                  <img src={form.hero.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => heroInputRef.current?.click()}
                  disabled={uploadingHero || !USE_API}
                >
                  {uploadingHero ? 'جاري الرفع...' : 'استبدال الصورة'}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => heroInputRef.current?.click()}
                disabled={uploadingHero || !USE_API}
                className="w-full py-6 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-primary transition-colors"
              >
                {uploadingHero ? (
                  <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <span className="text-2xl">📷</span>
                )}
                <span className="text-sm">{uploadingHero ? 'جاري الرفع...' : 'رفع صورة الهيرو'}</span>
                {!USE_API && <span className="text-xs text-amber-600">يتطلب Mock API</span>}
              </button>
            )}
          </div>
          <Input
            label="نص الزر"
            value={form.hero?.ctaText ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, hero: { ...(f.hero ?? DEFAULT_HERO), ctaText: e.target.value } }))}
          />
          <Input
            label="رابط الزر"
            value={form.hero?.ctaHref ?? form.hero?.ctaLink ?? ''}
            onChange={(e) => setForm((f) => ({
              ...f,
              hero: {
                ...(f.hero ?? DEFAULT_HERO),
                ctaHref: e.target.value,
                ctaLink: e.target.value,
              },
            }))}
            placeholder="#"
          />
        </div>
      </Card>

      <Card className="mt-6">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">سلايدر العروض / Banners</h2>
            <div className="flex gap-2">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleBannerUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanners || !USE_API}
              >
                {uploadingBanners ? 'جاري الرفع...' : 'رفع صور'}
              </Button>
              <Button variant="outline" size="sm" onClick={addBanner}>
                إضافة بانر فارغ
              </Button>
            </div>
          </div>
          {(form.banners ?? []).length === 0 ? (
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              onDrop={handleBannerDrop}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.types.includes('Files')) setBannerDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setBannerDragOver(false); }}
              disabled={uploadingBanners || !USE_API}
              className={`w-full py-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
                bannerDragOver ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 hover:border-primary hover:bg-primary/5 text-gray-500 hover:text-primary'
              }`}
            >
              {uploadingBanners ? (
                <span className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <span className="text-4xl">📷</span>
              )}
              <span className="text-sm font-medium">{uploadingBanners ? 'جاري الرفع...' : 'اسحب الصور هنا أو انقر للرفع'}</span>
              {!USE_API && <span className="text-xs text-amber-600">يتطلب Mock API</span>}
            </button>
          ) : (
            <div className="space-y-4">
              {(form.banners ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((b, i, arr) => (
                <div key={b.id} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`banner-img-${b.id}`}
                        onChange={(e) => handleBannerImageReplace(b.id, e)}
                      />
                      {b.imageUrl ? (
                        <div className="relative group">
                          <div className="w-32 aspect-[3/1] rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                            <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                          <label
                            htmlFor={`banner-img-${b.id}`}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-lg"
                          >
                            <span className="text-white text-xs font-medium px-2 py-1 bg-primary rounded">
                              {uploadingBanners ? '...' : 'استبدال'}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <label
                          htmlFor={`banner-img-${b.id}`}
                          className="w-32 aspect-[3/1] rounded-lg border-2 border-dashed border-gray-300 hover:border-primary flex items-center justify-center cursor-pointer text-gray-400 hover:text-primary text-xs"
                        >
                          {uploadingBanners ? '...' : 'رفع'}
                        </label>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <label className="flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={b.isActive ?? b.enabled ?? true}
                          onChange={(e) => updateBanner(b.id, { enabled: e.target.checked, isActive: e.target.checked })}
                        />
                        مفعّل
                      </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="العنوان (اختياري)"
                      value={b.title ?? ''}
                      onChange={(e) => updateBanner(b.id, { title: e.target.value })}
                    />
                    <Input
                      label="الوصف (اختياري)"
                      value={b.subtitle ?? ''}
                      onChange={(e) => updateBanner(b.id, { subtitle: e.target.value })}
                    />
                    <Input
                      label="نص الزر (اختياري)"
                      value={b.ctaText ?? ''}
                      onChange={(e) => updateBanner(b.id, { ctaText: e.target.value })}
                    />
                    <Input
                      label="رابط الزر (اختياري)"
                      value={b.ctaHref ?? b.link ?? ''}
                      onChange={(e) => updateBanner(b.id, { ctaHref: e.target.value, link: e.target.value })}
                      placeholder="#"
                    />
                    <Input
                      label="ينتهي في (اختياري)"
                      type="datetime-local"
                      value={b.expiresAt ? (() => {
                        const d = new Date(b.expiresAt);
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      })() : ''}
                      onChange={(e) => updateBanner(b.id, { expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={b.showCountdown !== false}
                        onChange={(e) => updateBanner(b.id, { showCountdown: e.target.checked })}
                      />
                      عرض العد التنازلي
                    </label>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moveBanner(b.id, 'up')}
                        disabled={i === 0}
                        title="تحريك لأعلى"
                      >
                        ↑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moveBanner(b.id, 'down')}
                        disabled={i === arr.length - 1}
                        title="تحريك لأسفل"
                      >
                        ↓
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeBanner(b.id)} className="text-red-600">
                      حذف
                    </Button>
                  </div>
                </div>
              </div>
            </div>
              ))}
              {USE_API && (form.banners ?? []).length > 0 && (
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  onDrop={handleBannerDrop}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setBannerDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setBannerDragOver(false); }}
                  disabled={uploadingBanners}
                  className={`w-full py-6 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-primary transition-colors ${
                    bannerDragOver ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary'
                  }`}
                >
                  {uploadingBanners ? <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <span className="text-xl">+</span>}
                  <span className="text-xs">{uploadingBanners ? 'جاري الرفع...' : 'إضافة صور'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </div>
      <div className="fixed bottom-0 start-0 end-0 z-40 p-4 bg-white border-t border-gray-200 shadow-lg md:hidden">
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </div>
    </div>
  );
}
