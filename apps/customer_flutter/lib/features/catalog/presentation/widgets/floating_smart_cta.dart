import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';
import '../../../../widgets/nmd_bottom_nav.dart';

/// Persistent bottom add-to-cart dock — always visible (no scroll hide).
class FloatingSmartCta extends StatelessWidget {
  const FloatingSmartCta({
    super.key,
    required this.price,
    required this.onPressed,
    this.disabled = false,
    this.missingRequired = false,
    this.loading = false,
    this.scale = 1,
    this.clearMarketBottomNav = true,
  });

  final double price;
  final VoidCallback? onPressed;
  final bool disabled;
  final bool missingRequired;
  final bool loading;
  final double scale;
  /// When true, lifts dock above [MainLayout] bottom navigation.
  final bool clearMarketBottomNav;

  bool get _canTap => !disabled && !loading && onPressed != null;

  String get _ctaLabel {
    if (loading) return '...';
    if (missingRequired && !disabled) return 'أكمل الاختيارات';
    return 'أضف للسلة';
  }

  @override
  Widget build(BuildContext context) {
    final navClearance =
        clearMarketBottomNav ? NmdBottomNav.navHeight : 0.0;

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Padding(
        padding: PremiumDockLayout.margin(
          context,
          extraBottom: navClearance,
        ),
        child: Transform.scale(
          scale: scale,
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
                children: [
                  Expanded(
                    flex: 3,
                    child: PremiumDockCta(
                      label: _ctaLabel,
                      loading: loading,
                      enabled: _canTap,
                      pulseWhenReady:
                          _canTap && !missingRequired && !loading,
                      onPressed: onPressed,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    NmdFormat.money(price),
                    style: NmdTypography.price.copyWith(fontSize: 14),
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

/// Scroll padding so content clears the persistent dock + optional bottom nav.
double productCtaScrollInset(BuildContext context, {bool clearBottomNav = true}) {
  final nav = clearBottomNav ? NmdBottomNav.navHeight : 0.0;
  return PremiumDockLayout.scrollInset + nav;
}
