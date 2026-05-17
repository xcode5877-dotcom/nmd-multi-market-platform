import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';
import '../../domain/customer_order_vm.dart';

/// Visual tokens for mock-api order `status`.
///
/// [isServiceLead]: service / lead rows — static badge only (no spinner).
({String label, Color bg, Color fg, Color border, bool showSpinner})
    orderStatusVisual(
  String? status,
  String? fulfillment, {
  bool isServiceLead = false,
}) {
  final s = (status ?? '').toUpperCase();
  if (isServiceLead) {
    if (s == 'CANCELLED' || s == 'CANCELED') {
      return (
        label: 'ملغي',
        bg: NmdColors.errorSoft,
        fg: NmdColors.error,
        border: const Color(0xFFFECACA),
        showSpinner: false,
      );
    }
    if (s == 'DELIVERED' || s == 'COMPLETED') {
      return (
        label: 'مكتمل',
        bg: NmdColors.successSoft,
        fg: NmdColors.success,
        border: const Color(0xFF6EE7B7),
        showSpinner: false,
      );
    }
    return (
      label: 'تم استلام الطلب',
      bg: NmdColors.tintAliveSoft,
      fg: NmdColors.brandPrimary,
      border: const Color(0xFF99F6E4),
      showSpinner: false,
    );
  }
  if (s == 'CANCELLED' || s == 'CANCELED') {
    return (
      label: 'ملغي',
      bg: NmdColors.errorSoft,
      fg: NmdColors.error,
      border: const Color(0xFFFECACA),
      showSpinner: false,
    );
  }
  if (s == 'DELIVERED' || s == 'COMPLETED') {
    return (
      label: fulfillment == 'PICKUP' ? 'تم الاستلام' : 'مكتمل',
      bg: NmdColors.successSoft,
      fg: NmdColors.success,
      border: const Color(0xFF6EE7B7),
      showSpinner: false,
    );
  }
  if (s == 'READY') {
    return (
      label: 'جاهز',
      bg: NmdColors.infoSoft,
      fg: NmdColors.info,
      border: const Color(0xFF7DD3FC),
      showSpinner: false,
    );
  }
  if (s == 'PREPARING') {
    return (
      label: 'قيد التحضير',
      bg: NmdColors.tintAliveSoft,
      fg: NmdColors.brandPrimary,
      border: const Color(0xFF99F6E4),
      showSpinner: true,
    );
  }
  if (s == 'CONFIRMED' || s == 'PENDING' || s == 'NEW') {
    return (
      label: 'تم استلام الطلب',
      bg: NmdColors.tintAliveSoft,
      fg: NmdColors.brandPrimary,
      border: const Color(0xFF99F6E4),
      showSpinner: true,
    );
  }

  /// Courier has the order — same UX as ON_THE_WAY (store/market delivery only).
  if (s == 'ON_THE_WAY' ||
      s == 'OUT_FOR_DELIVERY' ||
      s == 'PICKED_UP' ||
      s == 'RECEIVED_FROM_STORE' ||
      s == 'IN_PROGRESS') {
    return (
      label: 'في الطريق',
      bg: NmdColors.tintAliveSoft,
      fg: NmdColors.brandPrimary,
      border: const Color(0xFF5EEAD4),
      showSpinner: true,
    );
  }
  return (
    label: 'قيد التحضير',
    bg: NmdColors.tintAliveSoft,
    fg: NmdColors.brandPrimary,
    border: const Color(0xFF99F6E4),
    showSpinner: true,
  );
}

double trackingHandshakeFactor(CustomerOrderVm o) {
  final s = (o.status ?? '').toUpperCase();
  if (s == 'OUT_FOR_DELIVERY' ||
      s == 'PICKED_UP' ||
      s == 'RECEIVED_FROM_STORE' ||
      s == 'ON_THE_WAY' ||
      s == 'IN_PROGRESS') {
    return o.hasDriverLocation ? 0.95 : 0.72;
  }
  if (s == 'READY') return 0.58;
  if (s == 'PREPARING') return 0.42;
  if (s == 'CONFIRMED' || s == 'PENDING' || s == 'NEW') return 0.22;
  return 0.12;
}

({Color bg, Color fg, Color border}) orderStatusColorsWithHandshake(
  CustomerOrderVm o,
) {
  if (o.suppressesDeliveryTracking) {
    final v =
        orderStatusVisual(o.status, o.fulfillmentType, isServiceLead: true);
    return (
      bg: v.bg,
      fg: v.fg,
      border: v.border,
    );
  }
  final base = orderStatusVisual(o.status, o.fulfillmentType);
  final t = trackingHandshakeFactor(o);
  return (
    bg: Color.lerp(base.bg, NmdColors.warningSoft, t * 0.35)!,
    fg: Color.lerp(base.fg, NmdColors.warning, t * 0.22)!,
    border: Color.lerp(base.border, NmdColors.accentGold, t * 0.55)!,
  );
}

class OrderStatusBadge extends StatelessWidget {
  const OrderStatusBadge({
    super.key,
    required this.status,
    this.fulfillmentType,
    this.isServiceLead = false,
  });

  final String? status;
  final String? fulfillmentType;
  final bool isServiceLead;

  @override
  Widget build(BuildContext context) {
    return OrderStatusChip(
      status: status,
      fulfillmentType: fulfillmentType,
      isServiceLead: isServiceLead,
    );
  }
}

/// Elegant status chip with optional tiny loading indicator for in-progress states.
class OrderStatusChip extends StatelessWidget {
  const OrderStatusChip({
    super.key,
    required this.status,
    this.fulfillmentType,
    this.compact = false,
    this.isServiceLead = false,
  });

  final String? status;
  final String? fulfillmentType;
  final bool compact;
  final bool isServiceLead;

  @override
  Widget build(BuildContext context) {
    final v = orderStatusVisual(status, fulfillmentType,
        isServiceLead: isServiceLead);
    return _StatusChipBody(
      label: v.label,
      fg: v.fg,
      bg: v.bg,
      border: v.border,
      showSpinner: v.showSpinner,
      compact: compact,
      pulse: false,
    );
  }
}

/// Live handshake chip — never animates for [CustomerOrderVm.suppressesDeliveryTracking].
class OrderTrackingStatusChip extends StatelessWidget {
  const OrderTrackingStatusChip({
    super.key,
    required this.order,
    this.compact = true,
  });

  final CustomerOrderVm order;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (order.suppressesDeliveryTracking) {
      return _LeadReceivedStaticBadge(compact: compact);
    }
    return _OrderTrackingStatusChipAnimated(order: order, compact: compact);
  }
}

/// Pulsing chip with warm border shift for live store / courier handshake only.
class _OrderTrackingStatusChipAnimated extends StatefulWidget {
  const _OrderTrackingStatusChipAnimated({
    required this.order,
    required this.compact,
  });

  final CustomerOrderVm order;
  final bool compact;

  @override
  State<_OrderTrackingStatusChipAnimated> createState() =>
      _OrderTrackingStatusChipAnimatedState();
}

class _OrderTrackingStatusChipAnimatedState
    extends State<_OrderTrackingStatusChipAnimated>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v =
        orderStatusVisual(widget.order.status, widget.order.fulfillmentType);
    final hx = orderStatusColorsWithHandshake(widget.order);
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final pulse = 0.5 + 0.5 * _c.value;
        return Transform.scale(
          scale: 1 + 0.02 * pulse * trackingHandshakeFactor(widget.order),
          child: _StatusChipBody(
            label: v.label,
            fg: hx.fg,
            bg: hx.bg,
            border: hx.border,
            showSpinner: v.showSpinner,
            compact: widget.compact,
            pulse: true,
            glowSpread:
                1.5 + pulse * 2.5 * trackingHandshakeFactor(widget.order),
          ),
        );
      },
    );
  }
}

/// Static lead / service — no pulse, no spinner ([OrderTrackingStatusChip] only).
class _LeadReceivedStaticBadge extends StatelessWidget {
  const _LeadReceivedStaticBadge({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? NmdSpacing.xs : NmdSpacing.sm,
        vertical: compact ? NmdSpacing.xxs : NmdSpacing.xxs + 2,
      ),
      decoration: BoxDecoration(
        color: NmdColors.tintAliveSoft,
        borderRadius: NmdRadius.borderPill,
        border: Border.all(
          color: NmdColors.brandPrimary.withValues(alpha: 0.35),
        ),
      ),
      child: Text(
        'تم استلام الطلب',
        style: (compact ? NmdTypography.micro : NmdTypography.label).copyWith(
          fontWeight: FontWeight.w800,
          color: NmdColors.brandPrimary,
        ),
      ),
    );
  }
}

class _StatusChipBody extends StatelessWidget {
  const _StatusChipBody({
    required this.label,
    required this.fg,
    required this.bg,
    required this.border,
    required this.showSpinner,
    required this.compact,
    required this.pulse,
    this.glowSpread = 1,
  });

  final String label;
  final Color fg;
  final Color bg;
  final Color border;
  final bool showSpinner;
  final bool compact;
  final bool pulse;
  final double glowSpread;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? NmdSpacing.xs : NmdSpacing.sm,
        vertical: compact ? NmdSpacing.xxs : NmdSpacing.xxs + 2,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: NmdRadius.borderPill,
        border: Border.all(
          color: border,
          width: pulse ? 1.4 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: fg.withValues(alpha: pulse ? 0.14 : 0.06),
            blurRadius: pulse ? 8 + glowSpread : 6,
            offset: const Offset(0, 2),
          ),
          if (pulse)
            BoxShadow(
              color: NmdColors.brandSecondary.withValues(alpha: 0.12),
              blurRadius: 10 + glowSpread,
              spreadRadius: 0.5,
              offset: const Offset(0, 1),
            ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showSpinner) ...[
            SizedBox(
              width: compact ? 11 : 13,
              height: compact ? 11 : 13,
              child: CircularProgressIndicator(
                strokeWidth: 1.6,
                color: fg.withValues(alpha: 0.85),
              ),
            ),
            SizedBox(width: compact ? 5 : 7),
          ],
          Text(
            label,
            style:
                (compact ? NmdTypography.micro : NmdTypography.label).copyWith(
              fontWeight: FontWeight.w800,
              color: fg,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}
