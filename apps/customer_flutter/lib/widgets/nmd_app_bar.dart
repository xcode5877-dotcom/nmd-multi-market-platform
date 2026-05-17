import 'package:flutter/material.dart';

import '../app/theme/app_colors.dart';
import '../features/cart/presentation/widgets/global_cart_icon.dart';

class NmdAppBar extends StatelessWidget implements PreferredSizeWidget {
  const NmdAppBar({
    super.key,
    required this.title,
    this.marketSlug,
  });

  final String title;
  final String? marketSlug;

  static const double toolbarHeight = 56;

  @override
  Size get preferredSize => const Size.fromHeight(toolbarHeight);

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    return ColoredBox(
      color: AppColors.shellTeal,
      child: Padding(
        padding: EdgeInsets.only(top: topInset),
        child: SizedBox(
          height: toolbarHeight,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 56),
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              if (marketSlug != null)
                PositionedDirectional(
                  start: 4,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: Material(
                      color: Colors.transparent,
                      child: GlobalCartIcon(
                        marketSlug: marketSlug!,
                        padding: EdgeInsets.zero,
                        iconColor: Colors.white,
                        iconSize: 24,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
