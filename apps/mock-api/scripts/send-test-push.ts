#!/usr/bin/env npx tsx
/**
 * إرسال تنبيه push تجريبي لرقم هاتف مسجّل.
 * Usage:
 *   pnpm exec tsx scripts/send-test-push.ts --phone=972501234567
 *   pnpm exec tsx scripts/send-test-push.ts --phone=972501234567 --msg="مرحباً!"
 *   pnpm exec tsx scripts/send-test-push.ts --phone=972501234567 --url="/dabburiyya/stores"
 */
import { sendPushNotification, getSubscriptionsByPhone } from '../src/push-subscriptions.js';
import minimist from 'minimist';

async function main() {
  const args = minimist(process.argv.slice(2));
  const phone = args.phone?.toString();
  const msg = args.msg || 'تنبيه جديد من دبورية مول 🍎';
  const url = args.url || '/';

  if (!phone) {
    console.error('❌ خطأ: يجب إدخال رقم الهاتف باستخدام --phone');
    process.exit(1);
  }

  console.log(`🔍 جاري البحث عن اشتراكات لرقم: ${phone}...`);
  const subs = getSubscriptionsByPhone(phone);

  if (subs.length === 0) {
    console.error(
      "⚠️ لم يتم العثور على أي جهاز مسجل لهذا الرقم. تأكد من ضغط 'تفعيل التنبيهات' من الهاتف أولاً."
    );
    process.exit(1);
  }

  console.log(`🚀 تم العثور على ${subs.length} أجهزة. جاري الإرسال...`);

  for (const sub of subs) {
    try {
      await sendPushNotification(sub, {
        title: 'دبورية مول',
        body: msg,
        url: url,
        icon: 'https://nmd.marketing/api/uploads/1772556577574-q8cluk9y.jpg',
      });
      console.log('✅ تم إرسال التنبيه بنجاح للجهاز!');
    } catch (error) {
      console.error('❌ فشل الإرسال لجهاز معين:', error);
    }
  }
}

main().catch(console.error);
