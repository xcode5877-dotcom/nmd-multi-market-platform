import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../api/storefront_api.dart';
import '../../../../design_system/design_system.dart';
import '../widgets/account_sub_scaffold.dart';

class NotificationSettingsPage extends StatefulWidget {
  const NotificationSettingsPage({super.key});

  @override
  State<NotificationSettingsPage> createState() =>
      _NotificationSettingsPageState();
}

class _NotificationSettingsPageState extends State<NotificationSettingsPage> {
  bool _orders = true;
  bool _promos = true;
  bool _news = true;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final dio = context.read<Dio>();
    final m = await StorefrontApi(dio).getCustomerNotificationSettings();
    if (!mounted) return;
    if (m != null) {
      setState(() {
        _orders = m['orderUpdates'] == true;
        _promos = m['promotions'] == true;
        _news = m['news'] == true;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _apply({
    bool? orderUpdates,
    bool? promotions,
    bool? news,
  }) async {
    setState(() => _saving = true);
    final dio = context.read<Dio>();
    final res = await StorefrontApi(dio).patchCustomerNotificationSettings(
      orderUpdates: orderUpdates,
      promotions: promotions,
      news: news,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (res != null) {
      setState(() {
        _orders = res['orderUpdates'] == true;
        _promos = res['promotions'] == true;
        _news = res['news'] == true;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر الحفظ')),
      );
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AccountSubScaffold(
      title: 'الإشعارات',
      body: _loading
          ? const NmdLoading(message: 'جاري التحميل…')
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                NmdSpacing.screenHorizontal,
                NmdSpacing.sm,
                NmdSpacing.screenHorizontal,
                NmdSpacing.xl,
              ),
              children: [
                NmdSectionHeader(
                  title: 'تفضيلات الإشعارات',
                  subtitle: 'اختر ما يناسبك — يمكنك التغيير في أي وقت',
                  padding: EdgeInsets.zero,
                ),
                if (_saving)
                  const Padding(
                    padding: EdgeInsets.only(bottom: NmdSpacing.sm),
                    child: LinearProgressIndicator(
                      minHeight: 2,
                      color: NmdColors.brandPrimary,
                      backgroundColor: NmdColors.borderSubtle,
                    ),
                  ),
                _NotificationTile(
                  title: 'تحديثات الطلبات',
                  subtitle: 'حالة الطلب والتوصيل',
                  value: _orders,
                  onChanged: _saving ? null : (v) => _apply(orderUpdates: v),
                ),
                const SizedBox(height: NmdSpacing.sm),
                _NotificationTile(
                  title: 'العروض والترويج',
                  subtitle: 'كوبونات وعروض خاصة',
                  value: _promos,
                  onChanged: _saving ? null : (v) => _apply(promotions: v),
                ),
                const SizedBox(height: NmdSpacing.sm),
                _NotificationTile(
                  title: 'الأخبار',
                  subtitle: 'تحديثات المنصة والأسواق',
                  value: _news,
                  onChanged: _saving ? null : (v) => _apply(news: v),
                ),
              ],
            ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return NmdCard(
      variant: NmdCardVariant.outlined,
      padding: EdgeInsets.zero,
      child: SwitchListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: NmdSpacing.md,
          vertical: NmdSpacing.xxs,
        ),
        title: Text(
          title,
          style: NmdTypography.label.copyWith(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(subtitle, style: NmdTypography.bodySmall),
        value: value,
        activeThumbColor: NmdColors.brandPrimary,
        activeTrackColor: NmdColors.brandPrimary.withValues(alpha: 0.35),
        onChanged: onChanged,
      ),
    );
  }
}
