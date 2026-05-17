import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/support/open_privacy_policy.dart';
import '../../../../core/support/open_support_whatsapp.dart';
import '../widgets/account_sub_scaffold.dart';

class HelpSupportPage extends StatelessWidget {
  const HelpSupportPage({super.key});

  @override
  Widget build(BuildContext context) {
    final hasWa =
        kNmdSupportWhatsAppDigits.replaceAll(RegExp(r'\D'), '').isNotEmpty;
    final hasPhone =
        kNmdSupportPhoneDigits.replaceAll(RegExp(r'\D'), '').isNotEmpty;

    return AccountSubScaffold(
      title: 'المساعدة والدعم',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text(
            'تواصل معنا',
            style: GoogleFonts.cairo(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () async {
                    await launchNmdSupportWhatsApp(
                      messenger: ScaffoldMessenger.maybeOf(context),
                    );
                  },
                  icon: const Icon(Icons.chat_outlined, size: 20),
                  label: Text('واتساب',
                      style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primaryTeal,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    await launchNmdSupportPhoneCall(
                      messenger: ScaffoldMessenger.maybeOf(context),
                    );
                  },
                  icon: const Icon(Icons.call_outlined, size: 20),
                  label: Text('اتصال',
                      style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primaryTeal,
                    side: const BorderSide(
                        color: AppColors.primaryTeal, width: 1.4),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
          if (!hasWa && !hasPhone)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                'يمكن ضبط أرقام الدعم عند البناء عبر NMD_SUPPORT_WHATSAPP و NMD_SUPPORT_PHONE.',
                textAlign: TextAlign.center,
                style: GoogleFonts.cairo(
                    fontSize: 12, color: const Color(0xFF64748B)),
              ),
            ),
          const SizedBox(height: 28),
          Text(
            'حول التطبيق',
            style: GoogleFonts.cairo(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Card(
            margin: const EdgeInsets.only(bottom: 10),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            child: ListTile(
              leading: const Icon(Icons.privacy_tip_outlined,
                  color: AppColors.primaryTeal),
              title: Text(
                'سياسة الخصوصية',
                style: GoogleFonts.cairo(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                kNmdPrivacyPolicyUrl.trim().isEmpty
                    ? 'ضع الرابط عبر NMD_PRIVACY_POLICY_URL عند البناء.'
                    : kNmdPrivacyPolicyUrl,
                style: GoogleFonts.cairo(fontSize: 12),
              ),
              trailing: const Icon(Icons.open_in_new, size: 18),
              onTap: () async {
                await launchNmdPrivacyPolicy(
                  messenger: ScaffoldMessenger.maybeOf(context),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'أسئلة شائعة',
            style: GoogleFonts.cairo(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          _FaqTile(
            title: 'التوصيل',
            body:
                'نوصل طلباتك من المتاجر المشاركة في سوقك. وقت التوصيل يعتمد على المسافة وحالة الطلب. يمكنك متابعة حالة الطلب من صفحة «طلباتي».',
          ),
          _FaqTile(
            title: 'الدفع',
            body:
                'يدعم التطبيق طرق دفع متعددة حسب المتجر. يمكنك حفظ بطاقة بشكل آمن (نخزن آخر 4 أرقام فقط). لا نشارك بيانات الدفع مع أطراف غير مصرّحة.',
          ),
          _FaqTile(
            title: 'الطلبات',
            body:
                'بعد تأكيد الطلب يصل للمتجر للتحضير. يمكنك إلغاء أو تعديل الطلب وفق سياسة المتجر قبل التجهيز. لأي مشكلة تواصل معنا عبر واتساب أو الاتصال.',
          ),
        ],
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  const _FaqTile({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          iconColor: AppColors.primaryTeal,
          collapsedIconColor: AppColors.primaryTeal,
          title: Text(
            title,
            style: GoogleFonts.cairo(
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                body,
                textAlign: TextAlign.right,
                style: GoogleFonts.cairo(
                  height: 1.45,
                  fontSize: 14,
                  color: const Color(0xFF475569),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
