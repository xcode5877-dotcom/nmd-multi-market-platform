import 'package:flutter/material.dart';

import '../app/theme/app_colors.dart';
import '../core/auth/ensure_customer_auth.dart';
import '../design_system/design_system.dart';
import '../features/cart/presentation/widgets/global_cart_icon.dart';

/// Sleek full-width teal bar (RTL): back · title · account + cart.
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
  final Widget? centerTitle;
  final bool showLeading;
  final VoidCallback? onLeadingPressed;
  final bool showProfile;
  final bool showCart;
  final GlobalKey? cartIconKey;

  static const double barBodyHeight = NmdSizes.appBarBody;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.primaryTeal,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          width: double.infinity,
          height: barBodyHeight,
          child: Padding(
            padding: const EdgeInsetsDirectional.only(
              start: NmdSpacing.sm,
              end: NmdSpacing.xs,
            ),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (showLeading)
                    IconButton(
                      style: NmdAppHeader.plainIconStyle(),
                      onPressed: onLeadingPressed,
                      icon: const Icon(
                        Icons.arrow_back_ios_new,
                        size: 22,
                        color: Colors.white,
                      ),
                    )
                  else
                    const SizedBox(width: 8),
                  Expanded(
                    child: Align(
                      alignment: Alignment.center,
                      child: centerTitle ??
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: NmdTypography.appBarTitle,
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
                          style: NmdAppHeader.plainIconStyle(),
                          onPressed: () =>
                              openCustomerAccount(context, marketSlug),
                          icon: const Icon(
                            Icons.person_outline,
                            size: NmdSizes.iconMd,
                            color: Colors.white,
                          ),
                        ),
                      if (showCart)
                        GlobalCartIcon(
                          marketSlug: marketSlug,
                          iconKey: cartIconKey,
                          iconColor: Colors.white,
                          iconSize: NmdSizes.iconMd,
                          style: NmdAppHeader.plainIconStyle(),
                        ),
                    ],
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
