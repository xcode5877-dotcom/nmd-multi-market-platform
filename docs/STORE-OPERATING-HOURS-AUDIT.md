# Store Operating Hours — Audit & Summary

**Date:** 2026-03  
**Scope:** Store OS / Merchant Admin, Storefront, Mock API, Core logic.  
**Goal:** Clarify how operating hours work and identify any gaps for "Souq Daburiyya".

---

## 1. Admin UI — Where the merchant sets hours

### 1.1 Merchant app: `apps/admin/src/pages/StoreSettingsPage.tsx`

**Location:** إعدادات المحل → **ساعات العمل** (Row 3, full-width card).

**What the merchant can set:**

- **Per-day schedule (businessHours):**
  - لكل يوم: **وقت الفتح**، **وقت الإغلاق**، و **يوم إجازة** (checkbox).
  - أيام الأسبوع: الأحد … السبت (`DAY_ORDER`).
  - الحفظ عبر زر **"حفظ أوقات العمل"** → `api.updateOperationalSettingsApi(tenantId, { businessHours: hours })`.

**What the merchant cannot set here:**

- لا يوجد **وقت فتح/إغلاق يومي بسيط** (openTime/closeTime) في هذه الصفحة — فقط الجدول اليومي.
- لا يوجد **إغلاق يدوي طارئ** (Force Closed) في واجهة التاجر.

### 1.2 Manual status override (نفس الصفحة)

في **حالة التشغيل** (أعلى الصفحة):

- ثلاث أزرار: **مفتوح** | **مشغول** | **مغلق**.
- تحدّث `operationalStatus` عبر `updateOperationalSettingsApi(tenantId, { operationalStatus })`.
- هذا **تجاوز يدوي** — له أولوية في الحساب (انظر المنطق أدناه).

### 1.3 Platform admin: `apps/nmd-admin/src/pages/TenantDetailPage.tsx`

- **وقت الفتح / وقت الإغلاق** (openTime, closeTime) — نافذة يومية بسيطة.
- **إغلاق يدوي طارئ (Force Closed):** checkbox "إغلاق يدوي طارئ (Force Closed) — يعرض المحل مغلقاً بغض النظر عن الساعات".
- الحفظ عبر `PUT /tenants/:id/operational-settings` مع `openTime`, `closeTime`, `forceClosed`.

**الخلاصة:**  
- التاجر يضبط **ساعات العمل اليومية** (businessHours) + **الحالة اليدوية** (مفتوح/مشغول/مغلق) من إعدادات المحل.  
- **Force Closed** و**openTime/closeTime** البسيط يضبطان من لوحة المنصة (nmd-admin) فقط.

---

## 2. Logic / State — كيف يُحدَّد "مغلق"

### 2.1 الدالة: `packages/core/src/tenant.ts` → `getOperationalStatus(tenant)`

الترتيب:

1. **`forceClosed === true`** → فوراً `'closed'` (تجاوز طارئ).
2. **`operationalStatus === 'open'` أو `'busy'`** → يُعاد كما هو (تجاوز يدوي من التاجر).
3. **إن وُجدت `openTime` أو `closeTime`** (نافذة يومية بسيطة):
   - يُقارن الوقت الحالي (في توقيت المتجر **Asia/Jerusalem**) مع open/close.
   - يدعم إغلاق بعد منتصف الليل (مثلاً 22:00–03:00).
4. **إن وُجد `operationalStatus`** (مثلاً `'closed'`) → يُعاد.
5. **وإلا:** يُحسب من **businessHours**:
   - اليوم الحالي في توقيت المتجر (`getNowInStoreTz()` → `Asia/Jerusalem`).
   - إن اليوم `isClosedDay` → `'closed'`.
   - وإلا يُقارن الوقت الحالي مع `day.open` و `day.close` → `'open'` أو `'closed'`.

**مصدر الوقت:**  
`getNowInStoreTz()` يستخدم `Intl.DateTimeFormat` مع `timeZone: 'Asia/Jerusalem'`، أي **وقت الجهاز/المتصفح محوّل إلى توقيت المتجر** (لا "وقت السيرفر" بشكل صريح؛ السيرفر عادةً UTC والمتحكم هو التوقيت في المتصفح عند تنفيذ الدالة).

---

## 3. Storefront impact — ماذا يحدث عندما المتجر مغلق؟

### 3.1 شارة الحالة (Closed / Open / Busy)

- **مكونات:** `StatusBadge`, `StoreCard`, `ProfessionalHero`, وقوائم المتاجر في Market (MarketStoresPage, MarketSectionPage, MarketHomePage).
- **المصدر:** `getOperationalStatus(tenant)` مع تمرير `operationalStatus`, `businessHours`, `openTime`, `closeTime`, `forceClosed`.
- **العرض:**
  - مفتوح: أخضر + "مفتوح".
  - مشغول: كهرماني + "مشغول".
  - مغلق: أحمر + "مغلق".

يعتمد ذلك على أن الـ tenant الذي يصل للمتجر (مثلاً من `getTenant(tenantSlug)`) يحتوي على `businessHours`, `openTime`, `closeTime`, `forceClosed`, `operationalStatus`. الـ API يعيدها عبر `normalizeTenantResponse` و/أو الـ payload الكامل.

### 3.2 هل يُعطّل "Add to Cart"؟

- **لا.**  
  في `ProductCard` وواجهة المنتج لا يوجد تحقق من `operationalStatus` أو `getOperationalStatus`.  
  المستخدم يمكنه إضافة للسلة وتصفح المتجر حتى لو كان مغلقاً.

### 3.3 هل يُعطّل زر التأكيد في Checkout؟

- **نعم.**  
  في `apps/storefront/src/pages/CheckoutPage.tsx`:
  - `canPlaceOrder = (operationalStatus !== 'closed' || orderPolicy === 'accept_always') && !cartHasMultipleMarkets`.
  - إذا `orderPolicy === 'accept_only_when_open'` (الافتراضي) والمتجر `closed` → `canPlaceOrder === false`.
  - النتيجة:
    - رسالة: **"عذراً، المتجر لا يستقبل طلبات في الوقت الحالي."**
    - زر **"تأكيد الطلب"** معطّل ونصه **"لا نقبل الطلبات حالياً"**.

### 3.4 سياسة الطلبات (orderPolicy)

- **قبول الطلبات فقط عند الفتح** (`accept_only_when_open`): عند `closed` لا يمكن تأكيد الطلب (كما أعلاه).
- **قبول الطلبات دائماً** (`accept_always`): حتى لو `closed`، `canPlaceOrder` يبقى true (ما لم تكن سلة متاجر متعددة)، أي يمكن تأكيد الطلب.

### 3.5 HomePage — تنبيه عند الدخول

- عند `operationalStatus === 'busy'` أو `'closed'` يُعرض **EntranceAlert** (قابل للإغلاق).
- النص يختلف حسب `orderPolicy` (معالجة الطلب عند الافتتاح vs إمكانية الطلب رغم الإغلاق).

---

## 4. Override — "Manual Close" / Emergency

### 4.1 تجاوز يدوي من التاجر (Store Settings)

- في **إعدادات المحل**: أزرار **مفتوح | مشغول | مغلق**.
- تُخزَّن في `operationalStatus` وتُعاد من الـ API مع الـ tenant.
- لها أولوية في `getOperationalStatus` عندما تكون `open` أو `busy`؛ وعندما تكون `closed` تُعاد بعد فحص `forceClosed` و open/close البسيط.

### 4.2 إغلاق طارئ (Force Closed)

- **موجود في:** `apps/nmd-admin` (TenantDetailPage) فقط.
- **غير موجود في:** واجهة التاجر (StoreSettingsPage).
- عند `forceClosed === true`، النتيجة دائماً `'closed'` بغض النظر عن الساعات أو `operationalStatus`.

---

## 5. Data flow — API و tenant

- **GET /tenants/by-slug/:slug** و **GET /tenants/by-id/:id** يعيدان الـ tenant مع:
  - `operationalStatus`, `businessHours`, `openTime`, `closeTime`, `forceClosed` (عبر `normalizeTenantResponse` حيث يلزم).
- **PUT /tenants/:id/operational-settings** يقبل:  
  `operationalStatus`, `businessHours`, `openTime`, `closeTime`, `forceClosed`, وغيرها.
- الـ storefront يستدعي `getOperationalStatus(tenant)` على الـ tenant الذي يحصل عليه من الـ API، لذا يجب أن تكون كل الحقول أعلاه مُرجَعَة في استجابات الـ tenant حتى يعمل المنطق كما هو موصوف.

---

## 6. خلاصة سريعة

| البند | الحالة |
|--------|--------|
| مكان ضبط الساعات (التاجر) | ✅ إعدادات المحل → ساعات العمل (جدول يومي + حفظ أوقات العمل). |
| تجاوز يدوي (مفتوح/مشغول/مغلق) | ✅ نفس الصفحة — حالة التشغيل. |
| تحديد "مغلق" من الساعات | ✅ من الوقت الحالي في توقيت Asia/Jerusalem مقابل businessHours (أو openTime/closeTime إن وُجدت). |
| Force Closed (طارئ) | ✅ من nmd-admin فقط؛ غير متوفر في واجهة التاجر. |
| شارة مغلق/مفتوح في المتجر | ✅ عبر StatusBadge وStoreCard وغيرها باستخدام getOperationalStatus. |
| تعطيل زر التأكيد في Checkout | ✅ عند مغلق + accept_only_when_open. |
| تعطيل Add to Cart عند المغلق | ❌ غير مطبّق — المستخدم يمكنه الإضافة للسلة. |

---

## 7. توصيات لـ "Souq Daburiyya"

1. **لو احتجت إغلاق طارئ من التاجر:**  
   إضافة خيار "إغلاق يدوي طارئ" في StoreSettingsPage (نفس منطق forceClosed في nmd-admin) وربطه بـ `updateOperationalSettingsApi(..., { forceClosed })`.

2. **لو رغبت في منع الإضافة للسلة عند الإغلاق:**  
   في `ProductCard` و/أو صفحة المنتج: استدعاء `getOperationalStatus(tenant)` و`orderPolicy`، وتعطيل زر "أضف للسلة" عند `closed` و `accept_only_when_open` (مع رسالة مثل "المتجر مغلق حالياً").

3. **التوقيت:**  
   المنطق الحالي يعتمد على وقت المتصفح محوّلاً إلى Asia/Jerusalem. لو كان السيرفر في بيئة مختلفة أو تريد مصدراً واحداً للحقيقة، يمكن نقل `getNowInStoreTz()` إلى الـ API وإرجاع الحالة المحسوبة من السيرفر (أو إرجاع الوقت الحالي في التوقيت المطلوب ثم حساب الحالة في العميل).

4. **openTime/closeTime في واجهة التاجر:**  
   حالياً فقط في nmd-admin. لو أردت للتاجر أن يضبط "نافذة يومية بسيطة" بدل الجدول اليومي، يمكن إضافة حقلي "وقت الفتح" و"وقت الإغلاق" في StoreSettingsPage وحفظهما عبر نفس `updateOperationalSettingsApi`.

---

*هذا المستند يلخص التنفيذ الحالي ولا يغيّر الكود؛ التعديلات المقترحة أعلاه اختيارية حسب متطلبات Souq Daburiyya.*
