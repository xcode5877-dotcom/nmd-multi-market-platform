import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../app/theme/app_colors.dart';
import '../core/auth/ensure_customer_auth.dart';
import '../features/cart/presentation/widgets/global_cart_icon.dart';

/// Sleek full-width teal bar (RTL): back (start) · **NMD** · account + cart (end).
class GlobalNmdHeader extends StatelessWidget {
  const GlobalNmdHeader({
    super.key,
    required this.marketSlug,
    this.title = 'NMD',
    this.centerTitle,
    this.showLeading = true,
    this.onLeadingPressed,
    this.showProfile = true,
    this.showCart = true,
    this.cartIconKey,
  });

  final String marketSlug;
  final String title;

  /// When set (e.g. logo on market picker), replaces the centered [title] text.
  final Widget? centerTitle;
  final bool showLeading;
  final VoidCallback? onLeadingPressed;
  final bool showProfile;
  final bool showCart;
  final GlobalKey? cartIconKey;

  /// Content height below safe area (sleek strip).
  static const double barBodyHeight = 44;

  static const double _iconSize = 24;
  static const double _gapActions = 8;

  static ButtonStyle _plainIconStyle() {
    return IconButton.styleFrom(
      foregroundColor: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      minimumSize: const Size(40, 40),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
      splashFactory: NoSplash.splashFactory,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ColoredBox(
      color: AppColors.primaryTeal,
      child: Padding(
        padding: EdgeInsets.only(top: top),
        child: SizedBox(
          width: double.infinity,
          height: barBodyHeight,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (showLeading)
                  IconButton(
                    style: _plainIconStyle(),
                    onPressed: onLeadingPressed,
                    icon: const Icon(
                      Icons.arrow_back_ios_new,
                      size: 22,
                      color: Colors.white,
                    ),
                  )
                else
                  const SizedBox(width: 12),
                Expanded(
                  child: Align(
                    alignment: Alignment.center,
                    child: centerTitle ??
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.cairo(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            height: 1.0,
                            letterSpacing: 0.4,
                          ),
                        ),
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  textDirection: TextDirection.rtl,
                  children: [
                    if (showProfile)
                      IconButton(
                        style: _plainIconStyle(),
                        onPressed: () =>
                            openCustomerAccount(context, marketSlug),
                        icon: const Icon(
                          Icons.person_outline,
                          size: _iconSize,
                          color: Colors.white,
                        ),
                      ),
                    if (showProfile && showCart)
                      const SizedBox(width: _gapActions),
                    if (showCart)
                      GlobalCartIcon(
                        marketSlug: marketSlug,
                        iconKey: cartIconKey,
                        padding: EdgeInsets.zero,
                        iconColor: Colors.white,
                        iconSize: _iconSize,
                        style: _plainIconStyle(),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
