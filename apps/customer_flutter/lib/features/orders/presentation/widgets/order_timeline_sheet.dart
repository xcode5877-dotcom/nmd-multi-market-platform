import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';
import '../../../cart/presentation/widgets/cart_modifier_lines.dart';
import '../../domain/customer_order_vm.dart';
import 'order_status_badge.dart';

void showOrderTimelineSheet(
  BuildContext context, {
  required List<CustomerOrderVm> orders,
}) {
  final allLeadOrService =
      orders.isNotEmpty && orders.every((o) => o.suppressesDeliveryTracking);
  final allService = orders.isNotEmpty && orders.every((o) => o.isServiceOrder);
  final title = allLeadOrService
      ? (allService
          ? (orders.length > 1 ? 'ملخص طلبات الخدمة' : 'ملخص الخدمة')
          : (orders.length > 1 ? 'ملخص الطلبات' : 'ملخص الطلب'))
      : (orders.length > 1 ? 'تفاصيل الطلب المجمع' : 'تفاصيل الطلب');

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: allLeadOrService ? 0.52 : 0.72,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scroll) => Container(
        decoration: const BoxDecoration(
          color: NmdColors.surfaceBase,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: NmdShadows.lg,
        ),
        child: SingleChildScrollView(
          controller: scroll,
          primary: false,
          padding: const EdgeInsets.fromLTRB(
            NmdSpacing.screenHorizontal,
            NmdSpacing.sm,
            NmdSpacing.screenHorizontal,
            NmdSpacing.xxl,
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: NmdSpacing.md),
                    decoration: BoxDecoration(
                      color: NmdColors.borderSubtle,
                      borderRadius: NmdRadius.borderPill,
                    ),
                  ),
                ),
                NmdSectionHeader(
                  title: title,
                  subtitle: 'كل التفاصيل في مكان واحد',
                  padding: EdgeInsets.zero,
                ),
                const SizedBox(height: NmdSpacing.sm),
                for (var i = 0; i < orders.length; i++) ...[
                  if (i > 0) const SizedBox(height: NmdSpacing.md),
                  _OrderBlock(order: orders[i]),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _OrderBlock extends StatelessWidget {
  const _OrderBlock({required this.order});

  final CustomerOrderVm order;

  @override
  Widget build(BuildContext context) {
    return NmdCard(
      variant: NmdCardVariant.outlined,
      padding: const EdgeInsets.all(NmdSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: NmdRadius.borderSm,
                child: SizedBox(
                  width: 48,
                  height: 48,
                  child: (order.tenantLogoUrl != null &&
                          order.tenantLogoUrl!.isNotEmpty)
                      ? CachedNetworkImage(
                          imageUrl: order.tenantLogoUrl!,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => ColoredBox(
                            color: NmdColors.surfaceMuted,
                            child: Icon(
                              Icons.storefront_outlined,
                              color: NmdColors.textTertiary,
                            ),
                          ),
                        )
                      : ColoredBox(
                          color: NmdColors.surfaceMuted,
                          child: Icon(
                            Icons.storefront_outlined,
                            color: NmdColors.textTertiary,
                          ),
                        ),
                ),
              ),
              const SizedBox(width: NmdSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.tenantName ?? 'متجر',
                      style: NmdTypography.h3,
                    ),
                    const SizedBox(height: NmdSpacing.xxs),
                    Text(
                      'رقم الطلب: ${order.id.length > 10 ? order.id.substring(0, 8) : order.id}',
                      style: NmdTypography.bodySmall,
                    ),
                  ],
                ),
              ),
              OrderStatusBadge(
                status: order.status,
                fulfillmentType: order.fulfillmentType,
                isServiceLead: order.suppressesDeliveryTracking,
              ),
            ],
          ),
          const SizedBox(height: NmdSpacing.md),
          _OrderMetaRow(order: order),
          const SizedBox(height: NmdSpacing.md),
          if (order.items != null && order.items!.isNotEmpty)
            _OrderLineItemsBlock(items: order.items!),
          if (order.items != null && order.items!.isNotEmpty)
            const SizedBox(height: NmdSpacing.md),
          if (order.suppressesDeliveryTracking)
            _ServiceOrderSummaryBody(order: order)
          else
            _TimelineStrip(
              status: order.status,
              fulfillment: order.fulfillmentType,
            ),
        ],
      ),
    );
  }
}

class _OrderMetaRow extends StatelessWidget {
  const _OrderMetaRow({required this.order});

  final CustomerOrderVm order;

  String? _paymentLabel() {
    final raw = order.raw;
    final p = (raw['paymentMethod'] ?? raw['payment']?['method'])
        ?.toString()
        .toUpperCase();
    if (p == null || p.isEmpty) return null;
    if (p == 'CARD') return 'بطاقة';
    if (p == 'CASH') return 'نقداً';
    return null;
  }

  String _fulfillmentLabel() {
    final t = (order.fulfillmentType ?? '').toUpperCase();
    return t == 'PICKUP' ? 'استلام من المتجر' : 'توصيل';
  }

  @override
  Widget build(BuildContext context) {
    final payment = _paymentLabel();
    return Wrap(
      spacing: NmdSpacing.xs,
      runSpacing: NmdSpacing.xs,
      children: [
        NmdChip(
          label: _fulfillmentLabel(),
          variant: NmdChipVariant.status,
          backgroundColor: NmdColors.infoSoft,
          foregroundColor: NmdColors.info,
        ),
        if (payment != null)
          NmdChip(
            label: payment,
            variant: NmdChipVariant.status,
            backgroundColor: NmdColors.surfaceMuted,
            foregroundColor: NmdColors.textSecondary,
          ),
        if (order.total != null)
          NmdChip(
            label: NmdFormat.money(order.total!),
            variant: NmdChipVariant.status,
            backgroundColor: NmdColors.tintAliveSoft,
            foregroundColor: NmdColors.brandPrimary,
          ),
      ],
    );
  }
}

class _OrderLineItemsBlock extends StatelessWidget {
  const _OrderLineItemsBlock({required this.items});

  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'الأصناف',
          style: NmdTypography.label.copyWith(
            fontWeight: FontWeight.w900,
            color: NmdColors.textSecondary,
          ),
        ),
        const SizedBox(height: NmdSpacing.xs),
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: NmdSpacing.sm),
          _OrderLineItemRow(raw: items[i]),
        ],
      ],
    );
  }
}

class _OrderLineItemRow extends StatelessWidget {
  const _OrderLineItemRow({required this.raw});

  final dynamic raw;

  @override
  Widget build(BuildContext context) {
    if (raw is! Map) return const SizedBox.shrink();
    final m = Map<String, dynamic>.from(raw);
    final name = m['productName']?.toString().trim().isNotEmpty == true
        ? m['productName'].toString().trim()
        : 'منتج';
    final qty = (m['quantity'] is num) ? (m['quantity'] as num).toInt() : 1;
    return NmdSurface(
      mode: NmdSurfaceMode.muted,
      padding: const EdgeInsets.fromLTRB(
        NmdSpacing.sm,
        NmdSpacing.xs,
        NmdSpacing.sm,
        NmdSpacing.xs,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '$qty × $name',
            textAlign: TextAlign.right,
            style: NmdTypography.label.copyWith(fontWeight: FontWeight.w800),
          ),
          OrderItemModifierLines(item: m, compact: true),
        ],
      ),
    );
  }
}

/// Static copy for service / lead rows — no delivery timeline.
class _ServiceOrderSummaryBody extends StatelessWidget {
  const _ServiceOrderSummaryBody({required this.order});

  final CustomerOrderVm order;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          order.isServiceOrder ? 'طلب خدمة' : 'ملخص الطلب',
          style: NmdTypography.label.copyWith(
            fontWeight: FontWeight.w900,
            color: NmdColors.brandPrimary,
          ),
        ),
        const SizedBox(height: NmdSpacing.xs),
        Text(
          order.isServiceOrder
              ? 'تم استلام طلبك. سيتواصل معك مقدّم الخدمة قريباً — نحن بجانبك.'
              : 'تم استلام طلبك. سيتواصل معك المتجر قريباً — شكراً لصبرك.',
          style: NmdTypography.bodySmall.copyWith(height: 1.5),
        ),
        if (order.total != null) ...[
          const SizedBox(height: NmdSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'المبلغ',
                style: NmdTypography.label.copyWith(
                  color: NmdColors.textSecondary,
                ),
              ),
              Text(
                NmdFormat.money(order.total!),
                style: NmdTypography.h3.copyWith(color: NmdColors.brandPrimary),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _TimelineStrip extends StatelessWidget {
  const _TimelineStrip({required this.status, required this.fulfillment});

  final String? status;
  final String? fulfillment;

  int _filledSteps(int stepCount) {
    final s = (status ?? '').toUpperCase();
    if (s == 'CANCELLED' || s == 'CANCELED') return 0;
    final pickup = fulfillment == 'PICKUP';
    if (pickup) {
      if (s == 'DELIVERED' || s == 'COMPLETED') return stepCount;
      if (s == 'READY') return stepCount;
      if (s == 'PREPARING' || s == 'CONFIRMED' || s == 'PENDING') return 2;
      return 1;
    }
    if (s == 'DELIVERED' || s == 'COMPLETED') return stepCount;
    if (s == 'READY') return 3;
    if (s == 'PREPARING' || s == 'CONFIRMED' || s == 'PENDING') return 2;
    return 1;
  }

  @override
  Widget build(BuildContext context) {
    final pickup = fulfillment == 'PICKUP';
    final steps = pickup
        ? <({String t, IconData i})>[
            (t: 'تم استلام الطلب', i: Icons.receipt_long_outlined),
            (t: 'قيد التحضير', i: Icons.restaurant_outlined),
            (t: 'جاهز للاستلام', i: Icons.storefront_outlined),
            (t: 'مكتمل', i: Icons.check_circle_outline),
          ]
        : <({String t, IconData i})>[
            (t: 'تم استلام الطلب', i: Icons.receipt_long_outlined),
            (t: 'قيد التحضير', i: Icons.restaurant_outlined),
            (t: 'في الطريق', i: Icons.delivery_dining_outlined),
            (t: 'مكتمل', i: Icons.check_circle_outline),
          ];

    final filled = _filledSteps(steps.length);
    final s = (status ?? '').toUpperCase();
    if (s == 'CANCELLED' || s == 'CANCELED') {
      return NmdSurface(
        mode: NmdSurfaceMode.muted,
        padding: const EdgeInsets.all(NmdSpacing.sm),
        child: Row(
          children: [
            const Icon(Icons.cancel_outlined, color: NmdColors.error, size: 20),
            const SizedBox(width: NmdSpacing.xs),
            Expanded(
              child: Text(
                'تم إلغاء هذا الطلب',
                style: NmdTypography.label.copyWith(
                  color: NmdColors.error,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: List.generate(steps.length, (idx) {
        final stepDone = idx < filled;
        final active =
            idx == filled - 1 && filled > 0 && filled <= steps.length;
        return Padding(
          padding: EdgeInsets.only(bottom: idx == steps.length - 1 ? 0 : 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 260),
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: stepDone
                          ? NmdColors.brandPrimary
                          : NmdColors.surfaceBase,
                      border: Border.all(
                        color: active
                            ? NmdColors.brandSecondary
                            : NmdColors.borderSubtle,
                        width: active ? 2 : 1,
                      ),
                    ),
                    child: Icon(
                      steps[idx].i,
                      size: 16,
                      color: stepDone
                          ? NmdColors.textOnBrand
                          : NmdColors.textTertiary,
                    ),
                  ),
                  if (idx < steps.length - 1)
                    Container(
                      width: 2,
                      height: 18,
                      margin: const EdgeInsets.only(top: 2),
                      color: filled > idx + 1
                          ? NmdColors.brandPrimary.withValues(alpha: 0.45)
                          : NmdColors.borderSubtle,
                    ),
                ],
              ),
              const SizedBox(width: NmdSpacing.sm),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    steps[idx].t,
                    style: NmdTypography.label.copyWith(
                      fontWeight: stepDone || active
                          ? FontWeight.w800
                          : FontWeight.w600,
                      color: stepDone
                          ? NmdColors.brandPrimary
                          : NmdColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}
