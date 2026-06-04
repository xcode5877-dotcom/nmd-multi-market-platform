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
  });

  final double total;
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: PremiumDockLayout.margin(context),
      child: PremiumDockSurface(
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
      ),
    );
  }
}

const double kPremiumCheckoutDockScrollInset =
    PremiumDockLayout.height + PremiumDockLayout.gapAboveNav + PremiumDockLayout.scrollExtra;
