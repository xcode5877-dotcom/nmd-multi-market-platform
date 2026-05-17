import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';
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
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: allLeadOrService ? 0.52 : 0.72,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scroll) => SingleChildScrollView(
        controller: scroll,
        primary: false,
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.right,
                style: GoogleFonts.cairo(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary),
              ),
              const SizedBox(height: 18),
              for (var i = 0; i < orders.length; i++) ...[
                if (i > 0) const SizedBox(height: 22),
                _OrderBlock(order: orders[i]),
              ],
            ],
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
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 44,
                    height: 44,
                    child: (order.tenantLogoUrl != null &&
                            order.tenantLogoUrl!.isNotEmpty)
                        ? CachedNetworkImage(
                            imageUrl: order.tenantLogoUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) =>
                                const ColoredBox(color: Color(0xFFE2E8F0)),
                          )
                        : const ColoredBox(
                            color: Color(0xFFE2E8F0),
                            child: Icon(Icons.storefront_outlined,
                                color: Color(0xFF64748B)),
                          ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.tenantName ?? 'متجر',
                        style: GoogleFonts.cairo(
                            fontWeight: FontWeight.w800, fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'رقم الطلب: ${order.id.length > 10 ? order.id.substring(0, 8) : order.id}',
                        style: GoogleFonts.cairo(
                            fontSize: 12, color: const Color(0xFF64748B)),
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
            const SizedBox(height: 16),
            if (order.items != null && order.items!.isNotEmpty)
              _OrderLineItemsBlock(items: order.items!),
            if (order.items != null && order.items!.isNotEmpty)
              const SizedBox(height: 14),
            if (order.suppressesDeliveryTracking)
              _ServiceOrderSummaryBody(order: order)
            else
              _TimelineStrip(
                status: order.status,
                fulfillment: order.fulfillmentType,
              ),
          ],
        ),
      ),
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
          style: GoogleFonts.cairo(
            fontSize: 13,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF475569),
          ),
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
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
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '$qty × $name',
              textAlign: TextAlign.right,
              style: GoogleFonts.cairo(
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
            ),
            OrderItemModifierLines(item: m, compact: true),
          ],
        ),
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
          style: GoogleFonts.cairo(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: AppColors.primaryTeal,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          order.isServiceOrder
              ? 'تم استلام طلبك. سيتواصل معك مقدّم الخدمة قريباً. لا يوجد تتبع توصيل لهذا النوع من الطلبات.'
              : 'تم استلام طلبك. سيتواصل معك المتجر قريباً. لا يوجد تتبع توصيل لهذا الطلب.',
          style: GoogleFonts.cairo(
            fontSize: 14,
            height: 1.5,
            color: const Color(0xFF64748B),
            fontWeight: FontWeight.w600,
          ),
        ),
        if (order.total != null) ...[
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'المبلغ',
                style: GoogleFonts.cairo(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF475569),
                ),
              ),
              Text(
                '₪${order.total!.toStringAsFixed(2)}',
                style: GoogleFonts.cairo(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AppColors.primaryTeal,
                ),
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

  /// How many timeline steps are completed (1…n). `0` = cancelled / unknown.
  int _filledSteps(int stepCount) {
    final s = (status ?? '').toUpperCase();
    if (s == 'CANCELLED') return 0;
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
            (t: 'جاري التحضير', i: Icons.restaurant_outlined),
            (t: 'جاهز للاستلام', i: Icons.storefront_outlined),
          ]
        : <({String t, IconData i})>[
            (t: 'تم استلام الطلب', i: Icons.receipt_long_outlined),
            (t: 'جاري التحضير', i: Icons.restaurant_outlined),
            (t: 'في الطريق', i: Icons.delivery_dining_outlined),
            (t: 'تم التوصيل', i: Icons.check_circle_outline),
          ];

    final filled = _filledSteps(steps.length);
    if ((status ?? '').toUpperCase() == 'CANCELLED') {
      return Text(
        'تم إلغاء هذا الطلب',
        style: GoogleFonts.cairo(
            color: const Color(0xFFB91C1C), fontWeight: FontWeight.w700),
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
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: stepDone ? AppColors.primaryTeal : Colors.white,
                      border: Border.all(
                        color: active
                            ? AppColors.secondaryTeal
                            : const Color(0xFFCBD5E1),
                        width: active ? 2 : 1,
                      ),
                    ),
                    child: Icon(
                      steps[idx].i,
                      size: 16,
                      color: stepDone ? Colors.white : const Color(0xFF94A3B8),
                    ),
                  ),
                  if (idx < steps.length - 1)
                    Container(
                      width: 2,
                      height: 18,
                      margin: const EdgeInsets.only(top: 2),
                      color: filled > idx + 1
                          ? AppColors.primaryTeal.withValues(alpha: 0.45)
                          : const Color(0xFFE2E8F0),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    steps[idx].t,
                    style: GoogleFonts.cairo(
                      fontWeight: stepDone || active
                          ? FontWeight.w800
                          : FontWeight.w600,
                      fontSize: 14,
                      color: stepDone
                          ? AppColors.primaryTeal
                          : const Color(0xFF64748B),
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
