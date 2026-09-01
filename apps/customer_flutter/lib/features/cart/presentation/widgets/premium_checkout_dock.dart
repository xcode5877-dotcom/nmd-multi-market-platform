import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';

/// Premium floating checkout dock — unified with [PremiumDockLayout].
class PremiumCheckoutDock extends StatelessWidget {
  const PremiumCheckoutDock({
    super.key,
    required this.total,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
    this.subtitle,
    this.floating = false,
  });

  final double total;
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;
  final String? subtitle;

  /// When true, pins above [MainLayout] bottom nav like [FloatingSmartCta].
  final bool floating;

  Widget _buildSurface() {
    return PremiumDockSurface(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          PremiumDockLayout.padH,
          PremiumDockLayout.padV,
          PremiumDockLayout.padH,
          PremiumDockLayout.padV,
        ),
        child: Row(
          textDirection: TextDirection.rtl,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              flex: 3,
              child: PremiumDockCta(
                label: label,
                loading: loading,
                enabled: enabled,
                pulseWhenReady: enabled && !loading,
                onPressed: onPressed,
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  NmdFormat.money(total),
                  style: NmdTypography.price.copyWith(fontSize: 14),
                ),
                Text(
                  subtitle ?? 'الإجمالي',
                  style: NmdTypography.micro.copyWith(fontSize: 10),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dock = Padding(
      padding: floating
          ? const EdgeInsets.fromLTRB(
              NmdSpacing.screenHorizontal,
              0,
              NmdSpacing.screenHorizontal,
              PremiumDockLayout.gapAboveNav,
            )
          : PremiumDockLayout.margin(context),
      child: _buildSurface(),
    );

    if (!floating) return dock;

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: dock,
      ),
    );
  }
}

const double kPremiumCheckoutDockScrollInset = PremiumDockLayout.height +
    PremiumDockLayout.gapAboveNav +
    PremiumDockLayout.scrollExtra;
