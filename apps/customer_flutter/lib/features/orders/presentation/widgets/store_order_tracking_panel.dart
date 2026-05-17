import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:lottie/lottie.dart' hide Marker;

import '../../../../design_system/design_system.dart';
import '../../domain/customer_order_vm.dart';

/// Live tracking UI for **retail / store** orders only (not SERVICE).
class StoreOrderTrackingPanel extends StatelessWidget {
  const StoreOrderTrackingPanel({
    super.key,
    required this.order,
  });

  final CustomerOrderVm order;

  /// Courier en route — show scooter / map (store delivery only).
  bool _isEnRouteDeliveryStatus(String? status) {
    final s = (status ?? '').toUpperCase();
    return s == 'OUT_FOR_DELIVERY' ||
        s == 'PICKED_UP' ||
        s == 'RECEIVED_FROM_STORE' ||
        s == 'ON_THE_WAY' ||
        s == 'IN_PROGRESS';
  }

  /// Steps 0…3: received → preparing → ready → on the way.
  (int completedThrough, int? activeStep) _deliveryStepProgress(
      String? status) {
    final s = (status ?? '').toUpperCase();
    switch (s) {
      case 'DELIVERED':
      case 'COMPLETED':
        return (3, null);
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
      case 'RECEIVED_FROM_STORE':
      case 'ON_THE_WAY':
      case 'IN_PROGRESS':
        return (2, 3);
      case 'READY':
        return (1, 2);
      case 'PREPARING':
        return (0, 1);
      case 'CONFIRMED':
      case 'PENDING':
      case 'NEW':
        return (-1, 0);
      default:
        return (-1, 0);
    }
  }

  bool _showChefLottie(String? status) {
    final s = (status ?? '').toUpperCase();
    return s == 'PREPARING' || s == 'CONFIRMED' || s == 'PENDING' || s == 'NEW';
  }

  bool _showScooterLottie(String? status) => _isEnRouteDeliveryStatus(status);

  String _formatHm(DateTime? d) {
    if (d == null) return '—';
    return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  String _stepTimeLabel(
    int index,
    int completedThrough,
    int? activeStep,
  ) {
    final t = order.createdAt;
    if (index == 0) return _formatHm(t);
    if (activeStep != null && index == activeStep) return _formatHm(t);
    if (activeStep == null && index <= completedThrough && index > 0) {
      return _formatHm(t);
    }
    return '—';
  }

  bool _connectorAfterStepTeal(
    int stepIndex,
    int completedThrough,
    int? activeStep,
  ) {
    if (stepIndex < completedThrough) return true;
    if (activeStep != null &&
        stepIndex == completedThrough &&
        activeStep > stepIndex) {
      return true;
    }
    return false;
  }

  String? _nextStepHint(int? activeStep) {
    if (activeStep == null) return null;
    const hints = [
      'تم استلام طلبك — شكراً لثقتك',
      'المتجر يحضّر طلبك الآن',
      'طلبك جاهز — سيصل قريباً',
      'السائق في الطريق إليك',
    ];
    if (activeStep < 0 || activeStep >= hints.length) return null;
    return hints[activeStep];
  }

  @override
  Widget build(BuildContext context) {
    if (order.suppressesDeliveryTracking) return const SizedBox.shrink();

    final progress = _deliveryStepProgress(order.status);
    final completedThrough = progress.$1;
    final activeStep = progress.$2;
    final nextHint = _nextStepHint(activeStep);
    const labels = [
      'تم استلام الطلب',
      'قيد التحضير',
      'جاهز للتسليم',
      'في الطريق',
    ];

    return NmdSurface(
      mode: NmdSurfaceMode.alive,
      padding: const EdgeInsets.all(NmdSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.route_outlined,
                size: 18,
                color: NmdColors.brandPrimary.withValues(alpha: 0.9),
              ),
              const SizedBox(width: NmdSpacing.xs),
              Text(
                'متابعة مباشرة',
                style: NmdTypography.label.copyWith(
                  fontWeight: FontWeight.w900,
                  color: NmdColors.textPrimary,
                ),
              ),
            ],
          ),
          if (nextHint != null) ...[
            const SizedBox(height: NmdSpacing.xxs),
            Text(
              nextHint,
              textAlign: TextAlign.right,
              style: NmdTypography.bodySmall.copyWith(
                color: NmdColors.brandPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: NmdSpacing.sm),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: labels.length,
            itemBuilder: (context, index) {
              final isLast = index == labels.length - 1;
              final filled = completedThrough >= 0 && index <= completedThrough;
              final active = activeStep != null && index == activeStep;
              final lineColor = !isLast &&
                      _connectorAfterStepTeal(
                          index, completedThrough, activeStep)
                  ? NmdColors.brandPrimary.withValues(alpha: 0.45)
                  : NmdColors.borderSubtle;

              return SizedBox(
                height: isLast ? 56 : 52,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  textDirection: TextDirection.rtl,
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 10, top: 2),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              labels[index],
                              style: NmdTypography.label.copyWith(
                                fontSize: 12.5,
                                fontWeight: active
                                    ? FontWeight.w900
                                    : (filled
                                        ? FontWeight.w800
                                        : FontWeight.w600),
                                color: active
                                    ? NmdColors.brandSecondary
                                    : (filled
                                        ? NmdColors.brandPrimary
                                        : NmdColors.textTertiary),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _stepTimeLabel(
                                  index, completedThrough, activeStep),
                              style: NmdTypography.micro.copyWith(
                                color: NmdColors.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(
                      width: 36,
                      child: Column(
                        children: [
                          _TimelineDot(filled: filled, active: active),
                          if (!isLast)
                            Expanded(
                              child: Center(
                                child: Container(
                                  width: 2,
                                  margin: const EdgeInsets.only(top: 2),
                                  color: lineColor,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          if (_showChefLottie(order.status) ||
              _showScooterLottie(order.status)) ...[
            const SizedBox(height: NmdSpacing.xs),
            SizedBox(
              height: 72,
              child: Center(
                child: Lottie.asset(
                  _showScooterLottie(order.status)
                      ? 'assets/lottie/scooter_delivery.json'
                      : 'assets/lottie/chef_preparing.json',
                  repeat: true,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ],
          if ((order.fulfillmentType ?? '').toUpperCase() == 'DELIVERY' &&
              (order.hasDriverLocation ||
                  (order.dropoffLat != null &&
                      order.dropoffLng != null &&
                      _isEnRouteDeliveryStatus(order.status)))) ...[
            const SizedBox(height: NmdSpacing.sm),
            ClipRRect(
              borderRadius: NmdRadius.borderMd,
              child: SizedBox(
                height: 118,
                child: _DriverMiniMap(order: order),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TimelineDot extends StatelessWidget {
  const _TimelineDot({required this.filled, this.active = false});

  final bool filled;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      width: active ? 16 : 14,
      height: active ? 16 : 14,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active
            ? NmdColors.brandPrimary
            : (filled ? NmdColors.brandPrimary : NmdColors.surfaceBase),
        border: Border.all(
          color: active
              ? NmdColors.brandSecondary
              : (filled ? NmdColors.brandPrimary : NmdColors.borderSubtle),
          width: active ? 2.5 : 2,
        ),
        boxShadow: filled || active
            ? [
                BoxShadow(
                  color: (active
                          ? NmdColors.brandSecondary
                          : NmdColors.brandPrimary)
                      .withValues(alpha: active ? 0.35 : 0.25),
                  blurRadius: active ? 8 : 4,
                  offset: const Offset(0, 1),
                ),
              ]
            : null,
      ),
    );
  }
}

class _DriverMiniMap extends StatelessWidget {
  const _DriverMiniMap({required this.order});

  final CustomerOrderVm order;

  bool _enRoute(String? status) {
    final s = (status ?? '').toUpperCase();
    return s == 'OUT_FOR_DELIVERY' ||
        s == 'PICKED_UP' ||
        s == 'RECEIVED_FROM_STORE' ||
        s == 'ON_THE_WAY' ||
        s == 'IN_PROGRESS';
  }

  @override
  Widget build(BuildContext context) {
    if (order.suppressesDeliveryTracking) return const SizedBox.shrink();

    final hasDriver = order.driverLat != null && order.driverLng != null;
    final hasDrop = order.dropoffLat != null && order.dropoffLng != null;
    if (!hasDriver && !(hasDrop && _enRoute(order.status))) {
      return const SizedBox.shrink();
    }

    final dLat = order.driverLat ?? order.dropoffLat!;
    final dLng = order.driverLng ?? order.dropoffLng!;
    final dropLat = order.dropoffLat ?? dLat + 0.008;
    final dropLng = order.dropoffLng ?? dLng + 0.006;
    final center = hasDriver && hasDrop
        ? LatLng((dLat + dropLat) / 2, (dLng + dropLng) / 2)
        : LatLng(dLat, dLng);

    final markers = <Marker>[];
    if (hasDriver) {
      markers.add(
        Marker(
          point: LatLng(order.driverLat!, order.driverLng!),
          width: 36,
          height: 36,
          child: Icon(
            Icons.delivery_dining_rounded,
            color: NmdColors.brandPrimary,
            size: 32,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 4,
              ),
            ],
          ),
        ),
      );
    }
    if (hasDrop) {
      markers.add(
        Marker(
          point: LatLng(order.dropoffLat!, order.dropoffLng!),
          width: 28,
          height: 28,
          child: const Icon(
            Icons.place_rounded,
            color: NmdColors.error,
            size: 28,
          ),
        ),
      );
    }

    return FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: hasDriver && hasDrop ? 13 : 14,
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.none,
        ),
        backgroundColor: NmdColors.tintAliveSoft,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.nmd.customer',
        ),
        MarkerLayer(markers: markers),
      ],
    );
  }
}
