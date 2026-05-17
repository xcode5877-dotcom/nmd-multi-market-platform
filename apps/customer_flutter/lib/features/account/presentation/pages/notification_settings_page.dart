import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
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
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primaryTeal))
          : ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                if (_saving)
                  const LinearProgressIndicator(
                    minHeight: 2,
                    color: AppColors.primaryTeal,
                    backgroundColor: Color(0xFFE2E8F0),
                  ),
                SwitchListTile(
                  title: Text('تحديثات الطلبات',
                      style: GoogleFonts.cairo(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    'حالة الطلب والتوصيل',
                    style: GoogleFonts.cairo(
                        fontSize: 13, color: const Color(0xFF64748B)),
                  ),
                  value: _orders,
                  activeThumbColor: AppColors.primaryTeal,
                  activeTrackColor:
                      AppColors.primaryTeal.withValues(alpha: 0.35),
                  onChanged: _saving ? null : (v) => _apply(orderUpdates: v),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: Text('العروض والترويج',
                      style: GoogleFonts.cairo(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    'كوبونات وعروض خاصة',
                    style: GoogleFonts.cairo(
                        fontSize: 13, color: const Color(0xFF64748B)),
                  ),
                  value: _promos,
                  activeThumbColor: AppColors.primaryTeal,
                  activeTrackColor:
                      AppColors.primaryTeal.withValues(alpha: 0.35),
                  onChanged: _saving ? null : (v) => _apply(promotions: v),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: Text('الأخبار',
                      style: GoogleFonts.cairo(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    'تحديثات المنصة والأسواق',
                    style: GoogleFonts.cairo(
                        fontSize: 13, color: const Color(0xFF64748B)),
                  ),
                  value: _news,
                  activeThumbColor: AppColors.primaryTeal,
                  activeTrackColor:
                      AppColors.primaryTeal.withValues(alpha: 0.35),
                  onChanged: _saving ? null : (v) => _apply(news: v),
                ),
              ],
            ),
    );
  }
}
