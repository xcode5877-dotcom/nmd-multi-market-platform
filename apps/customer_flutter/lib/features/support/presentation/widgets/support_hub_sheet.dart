import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/auth/customer_auth_launcher.dart';
import '../../../../core/support/support_analytics.dart';
import '../../../../core/support/support_config.dart';
import '../../../../core/support/support_launcher.dart';
import '../../../../core/support/support_message_builder.dart';
import '../../../../core/support/support_recent_orders.dart';
import '../../../../design_system/design_system.dart';
import '../../../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../../../features/orders/domain/customer_order_vm.dart';

/// Opens the premium Smart Support Hub bottom sheet.
Future<void> showSupportHubSheet(
  BuildContext context, {
  required SupportConfig config,
  SupportOrderContext? initialOrder,
  String analyticsSource = 'home',
}) {
  final dio = context.read<Dio>();
  // ignore: unawaited_futures
  trackSupportEvent(
    dio,
    SupportAnalyticsEvents.hubOpened,
    source: analyticsSource,
    hasOrderContext: initialOrder != null,
  );

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (ctx) {
      return SupportHubSheet(
        config: config,
        initialOrder: initialOrder,
        analyticsSource: analyticsSource,
      );
    },
  );
}

class SupportHubSheet extends StatefulWidget {
  const SupportHubSheet({
    super.key,
    required this.config,
    this.initialOrder,
    this.analyticsSource = 'home',
  });

  final SupportConfig config;
  final SupportOrderContext? initialOrder;
  final String analyticsSource;

  @override
  State<SupportHubSheet> createState() => _SupportHubSheetState();
}

class _SupportHubSheetState extends State<SupportHubSheet> {
  SupportOrderContext? _order;
  bool _pickingOrder = false;
  bool _loadingOrders = false;
  List<CustomerOrderVm>? _recentOrders;
  String? _ordersError;

  @override
  void initState() {
    super.initState();
    _order = widget.initialOrder;
  }

  Future<void> _startOrderPick() async {
    final auth = context.read<AuthBloc>().state;
    if (auth.step != AuthStep.done) {
      setState(() => _pickingOrder = true);
      return;
    }
    setState(() {
      _pickingOrder = true;
      _loadingOrders = true;
      _ordersError = null;
    });
    try {
      final dio = context.read<Dio>();
      final list = await SupportRecentOrdersLoader(dio).loadRecent();
      if (!mounted) return;
      setState(() {
        _recentOrders = list;
        _loadingOrders = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingOrders = false;
        _ordersError = 'تعذر تحميل الطلبات الأخيرة';
        _recentOrders = const [];
      });
    }
  }

  Future<void> _copyOrderNumber() async {
    final id = _order?.shortOrderNumber;
    if (id == null || id.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: id));
    if (!mounted) return;
    final dio = context.read<Dio>();
    // ignore: unawaited_futures
    trackSupportEvent(
      dio,
      SupportAnalyticsEvents.copyOrderNumber,
      source: widget.analyticsSource,
      hasOrderContext: true,
    );
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      const SnackBar(content: Text('تم نسخ رقم الطلب')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.config;
    final title = config.supportTitle.trim().isEmpty
        ? 'كيف يمكننا مساعدتك؟'
        : config.supportTitle.trim();
    final description = config.supportDescription.trim().isEmpty
        ? 'فريق Now Market جاهز لمساعدتك والإجابة عن استفساراتك'
        : config.supportDescription.trim();
    final media = MediaQuery.of(context);
    final maxHeight = media.size.height * 0.88;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Padding(
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: Material(
              color: NmdColors.surfaceBase,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(28)),
              clipBehavior: Clip.antiAlias,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 10),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: NmdColors.borderSubtle,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(
                        NmdSpacing.screenHorizontal,
                        NmdSpacing.md,
                        NmdSpacing.screenHorizontal,
                        NmdSpacing.xxl,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            title,
                            textAlign: TextAlign.right,
                            style: NmdTypography.h2.copyWith(
                              fontWeight: FontWeight.w900,
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: NmdSpacing.xs),
                          Text(
                            description,
                            textAlign: TextAlign.right,
                            style: NmdTypography.bodySmall.copyWith(
                              color: NmdColors.textSecondary,
                              height: 1.45,
                            ),
                          ),
                          if (_order != null) ...[
                            const SizedBox(height: NmdSpacing.md),
                            _OrderContextCard(
                              order: _order!,
                              onClear: () => setState(() {
                                _order = null;
                                _pickingOrder = false;
                              }),
                              onCopy: _copyOrderNumber,
                            ),
                          ],
                          const SizedBox(height: NmdSpacing.md),
                          if (!config.supportEnabled || !config.hasAnyChannel)
                            const _UnavailableState()
                          else ...[
                            if (config.isWhatsappAvailable)
                              _HubActionRow(
                                leading: const _WhatsAppMark(),
                                title: 'واتساب',
                                subtitle: 'تواصل سريع مع فريق الدعم',
                                accent: const Color(0xFF25D366),
                                onTap: () async {
                                  final dio = context.read<Dio>();
                                  await launchSupportWhatsApp(
                                    config: config,
                                    messenger:
                                        ScaffoldMessenger.maybeOf(context),
                                    dio: dio,
                                    order: _order,
                                    analyticsSource: widget.analyticsSource,
                                  );
                                },
                              ),
                            if (config.isWhatsappAvailable &&
                                config.isPhoneAvailable)
                              const SizedBox(height: NmdSpacing.sm),
                            if (config.isPhoneAvailable)
                              _HubActionRow(
                                leading: const Icon(
                                  Icons.phone_in_talk_rounded,
                                  color: NmdColors.brandPrimary,
                                  size: 26,
                                ),
                                title: 'اتصال هاتفي',
                                subtitle:
                                    'تحدث مباشرة مع فريق الدعم\n${displaySupportPhone(config.supportPhone)}',
                                accent: NmdColors.brandPrimary,
                                onTap: () async {
                                  final dio = context.read<Dio>();
                                  await launchSupportPhoneCall(
                                    config: config,
                                    messenger:
                                        ScaffoldMessenger.maybeOf(context),
                                    dio: dio,
                                    analyticsSource: widget.analyticsSource,
                                    hasOrderContext: _order != null,
                                  );
                                },
                              ),
                            if (_order == null) ...[
                              const SizedBox(height: NmdSpacing.sm),
                              _HubActionRow(
                                leading: const Icon(
                                  Icons.receipt_long_rounded,
                                  color: NmdColors.brandPrimary,
                                  size: 26,
                                ),
                                title: 'مساعدة بخصوص طلب',
                                subtitle:
                                    'اختر الطلب الذي تحتاج المساعدة بشأنه',
                                accent: NmdColors.brandPrimary,
                                outlined: true,
                                onTap: _startOrderPick,
                              ),
                            ],
                            if (_pickingOrder && _order == null) ...[
                              const SizedBox(height: NmdSpacing.md),
                              _OrderPicker(
                                loading: _loadingOrders,
                                error: _ordersError,
                                orders: _recentOrders,
                                onSignIn: () async {
                                  final ok =
                                      await presentCustomerLogin(context);
                                  if (ok && mounted) {
                                    await _startOrderPick();
                                  }
                                },
                                onSelect: (o) {
                                  setState(() {
                                    _order = supportOrderContextFromVm(o);
                                    _pickingOrder = false;
                                  });
                                },
                                onCancel: () =>
                                    setState(() => _pickingOrder = false),
                              ),
                            ],
                            if (config.workingHours.trim().isNotEmpty) ...[
                              const SizedBox(height: NmdSpacing.md),
                              _WorkingHoursLine(hours: config.workingHours),
                            ],
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderContextCard extends StatelessWidget {
  const _OrderContextCard({
    required this.order,
    required this.onClear,
    required this.onCopy,
  });

  final SupportOrderContext order;
  final VoidCallback onClear;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NmdSpacing.md),
      decoration: BoxDecoration(
        color: NmdColors.tintAliveSoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: NmdColors.borderBrand.withValues(alpha: 0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'مساعدة بخصوص هذا الطلب',
                  style: NmdTypography.label.copyWith(
                    fontWeight: FontWeight.w900,
                    color: NmdColors.brandPrimary,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'إلغاء سياق الطلب',
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded, size: 20),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          _kv('رقم الطلب', order.shortOrderNumber),
          if ((order.storeName ?? '').trim().isNotEmpty)
            _kv('المتجر', order.storeName!.trim()),
          if ((order.status ?? '').trim().isNotEmpty)
            _kv('الحالة', order.status!.trim()),
          const SizedBox(height: NmdSpacing.xs),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: onCopy,
              icon: const Icon(Icons.copy_rounded, size: 18),
              label: const Text('نسخ رقم الطلب'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Text(
            '$k: ',
            style: NmdTypography.micro.copyWith(
              color: NmdColors.textTertiary,
              fontWeight: FontWeight.w700,
            ),
          ),
          Expanded(
            child: Text(
              v,
              style: NmdTypography.label.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderPicker extends StatelessWidget {
  const _OrderPicker({
    required this.loading,
    required this.error,
    required this.orders,
    required this.onSelect,
    required this.onCancel,
    required this.onSignIn,
  });

  final bool loading;
  final String? error;
  final List<CustomerOrderVm>? orders;
  final ValueChanged<CustomerOrderVm> onSelect;
  final VoidCallback onCancel;
  final Future<void> Function() onSignIn;

  @override
  Widget build(BuildContext context) {
    final authDone = context.watch<AuthBloc>().state.step == AuthStep.done;

    return Container(
      padding: const EdgeInsets.all(NmdSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: NmdColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'اختر طلباً حديثاً',
                  style: NmdTypography.label.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              TextButton(onPressed: onCancel, child: const Text('إلغاء')),
            ],
          ),
          if (!authDone) ...[
            Text(
              'سجّل الدخول لعرض طلباتك وطلب مساعدة بخصوص طلب محدد. الدعم العام متاح دون تسجيل.',
              style: NmdTypography.bodySmall.copyWith(
                color: NmdColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: NmdSpacing.sm),
            FilledButton(
              onPressed: () => onSignIn(),
              style: FilledButton.styleFrom(
                backgroundColor: NmdColors.brandPrimary,
              ),
              child: const Text('تسجيل الدخول'),
            ),
          ] else if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: NmdLoading()),
            )
          else if (error != null)
            Text(error!, style: NmdTypography.bodySmall.copyWith(
              color: NmdColors.warning,
            ))
          else if (orders == null || orders!.isEmpty)
            Text(
              'لا توجد طلبات حديثة لعرضها.',
              style: NmdTypography.bodySmall.copyWith(
                color: NmdColors.textSecondary,
              ),
            )
          else
            ...orders!.map((o) {
              final ctx = supportOrderContextFromVm(o);
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  title: Text(
                    '#${ctx.shortOrderNumber}',
                    style: NmdTypography.label.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  subtitle: Text(
                    [
                      if ((o.tenantName ?? '').isNotEmpty) o.tenantName!,
                      if ((ctx.status ?? '').isNotEmpty) ctx.status!,
                    ].join(' · '),
                    style: NmdTypography.micro,
                  ),
                  trailing: const Icon(Icons.chevron_left_rounded),
                  onTap: () => onSelect(o),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _HubActionRow extends StatelessWidget {
  const _HubActionRow({
    required this.leading,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
    this.outlined = false,
  });

  final Widget leading;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: outlined ? NmdColors.surfaceBase : accent.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.symmetric(
            horizontal: NmdSpacing.md,
            vertical: NmdSpacing.sm + 2,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: outlined
                  ? NmdColors.borderBrand
                  : accent.withValues(alpha: 0.35),
              width: outlined ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: leading,
              ),
              const SizedBox(width: NmdSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: NmdTypography.label.copyWith(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: NmdTypography.micro.copyWith(
                        color: NmdColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_left_rounded, color: accent),
            ],
          ),
        ),
      ),
    );
  }
}

class _WhatsAppMark extends StatelessWidget {
  const _WhatsAppMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: const BoxDecoration(
        color: Color(0xFF25D366),
        shape: BoxShape.circle,
      ),
      child: const Icon(Icons.chat_rounded, color: Colors.white, size: 16),
    );
  }
}

class _WorkingHoursLine extends StatelessWidget {
  const _WorkingHoursLine({required this.hours});

  final String hours;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.schedule_rounded,
            size: 18, color: NmdColors.textTertiary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ساعات العمل',
                style: NmdTypography.micro.copyWith(
                  fontWeight: FontWeight.w700,
                  color: NmdColors.textTertiary,
                ),
              ),
              Text(
                hours,
                style: NmdTypography.label.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _UnavailableState extends StatelessWidget {
  const _UnavailableState();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NmdSpacing.xl),
      decoration: BoxDecoration(
        color: NmdColors.surfaceMuted,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          const Icon(Icons.support_agent_rounded,
              size: 36, color: NmdColors.textTertiary),
          const SizedBox(height: NmdSpacing.sm),
          Text(
            'الدعم غير متاح حاليًا',
            textAlign: TextAlign.center,
            style: NmdTypography.h3.copyWith(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}
