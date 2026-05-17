import 'package:flutter/material.dart';

import '../../../../core/support/open_privacy_policy.dart';
import '../../../../core/support/open_support_whatsapp.dart';
import '../../../../design_system/design_system.dart';
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
        padding: const EdgeInsets.fromLTRB(
          NmdSpacing.screenHorizontal,
          NmdSpacing.sm,
          NmdSpacing.screenHorizontal,
          NmdSpacing.xxl,
        ),
        children: [
          NmdSectionHeader(
            title: 'تواصل معنا',
            subtitle: 'فريق Now Market بجانبك',
            padding: EdgeInsets.zero,
          ),
          const SizedBox(height: NmdSpacing.sm),
          Row(
            children: [
              Expanded(
                child: NmdButton(
                  label: 'واتساب',
                  icon: const Icon(Icons.chat_outlined,
                      size: 20, color: NmdColors.textOnBrand),
                  size: NmdButtonSize.medium,
                  onPressed: () async {
                    await launchNmdSupportWhatsApp(
                      messenger: ScaffoldMessenger.maybeOf(context),
                    );
                  },
                ),
              ),
              const SizedBox(width: NmdSpacing.sm),
              Expanded(
                child: NmdButton(
                  label: 'اتصال',
                  variant: NmdButtonVariant.secondary,
                  icon: const Icon(Icons.call_outlined,
                      size: 20, color: NmdColors.brandPrimary),
                  size: NmdButtonSize.medium,
                  onPressed: () async {
                    await launchNmdSupportPhoneCall(
                      messenger: ScaffoldMessenger.maybeOf(context),
                    );
                  },
                ),
              ),
            ],
          ),
          if (!hasWa && !hasPhone)
            Padding(
              padding: const EdgeInsets.only(top: NmdSpacing.sm),
              child: Text(
                'يمكن ضبط أرقام الدعم عند البناء عبر NMD_SUPPORT_WHATSAPP و NMD_SUPPORT_PHONE.',
                textAlign: TextAlign.center,
                style: NmdTypography.bodySmall,
              ),
            ),
          const SizedBox(height: NmdSpacing.xl),
          NmdSectionHeader(
            title: 'حول التطبيق',
            padding: const EdgeInsetsDirectional.only(bottom: NmdSpacing.sm),
          ),
          NmdCard(
            variant: NmdCardVariant.outlined,
            onTap: () async {
              await launchNmdPrivacyPolicy(
                messenger: ScaffoldMessenger.maybeOf(context),
              );
            },
            padding: const EdgeInsets.symmetric(
              horizontal: NmdSpacing.md,
              vertical: NmdSpacing.xs,
            ),
            child: Row(
              children: [
                const Icon(Icons.privacy_tip_outlined,
                    color: NmdColors.brandPrimary),
                const SizedBox(width: NmdSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'سياسة الخصوصية',
                        style: NmdTypography.label.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        kNmdPrivacyPolicyUrl.trim().isEmpty
                            ? 'ضع الرابط عبر NMD_PRIVACY_POLICY_URL عند البناء.'
                            : kNmdPrivacyPolicyUrl,
                        style: NmdTypography.micro,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.open_in_new_rounded,
                    size: 18, color: NmdColors.textTertiary),
              ],
            ),
          ),
          const SizedBox(height: NmdSpacing.lg),
          NmdSectionHeader(
            title: 'أسئلة شائعة',
            padding: const EdgeInsetsDirectional.only(bottom: NmdSpacing.sm),
          ),
          const _FaqTile(
            title: 'التوصيل',
            body:
                'نوصل طلباتك من المتاجر المشاركة في سوقك. وقت التوصيل يعتمد على المسافة وحالة الطلب. يمكنك متابعة حالة الطلب من صفحة «طلباتي».',
          ),
          const _FaqTile(
            title: 'الدفع',
            body:
                'يدعم التطبيق طرق دفع متعددة حسب المتجر. يمكنك حفظ بطاقة بشكل آمن (نخزن آخر 4 أرقام فقط). لا نشارك بيانات الدفع مع أطراف غير مصرّحة.',
          ),
          const _FaqTile(
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
    return Padding(
      padding: const EdgeInsets.only(bottom: NmdSpacing.sm),
      child: NmdCard(
        variant: NmdCardVariant.outlined,
        padding: EdgeInsets.zero,
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(
              horizontal: NmdSpacing.md,
              vertical: NmdSpacing.xxs,
            ),
            childrenPadding: const EdgeInsets.fromLTRB(
              NmdSpacing.md,
              0,
              NmdSpacing.md,
              NmdSpacing.md,
            ),
            iconColor: NmdColors.brandPrimary,
            collapsedIconColor: NmdColors.brandPrimary,
            title: Text(
              title,
              style: NmdTypography.label.copyWith(fontWeight: FontWeight.w800),
            ),
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  body,
                  textAlign: TextAlign.right,
                  style: NmdTypography.bodySmall.copyWith(height: 1.45),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
