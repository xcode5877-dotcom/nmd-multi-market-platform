import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';
import '../../application/cart_cubit.dart';

/// Unified cart action + badge synced via [CartCubit] across the app.
/// Teal badge + Cairo label — use everywhere instead of ad-hoc cart badges.
class GlobalCartIcon extends StatelessWidget {
  const GlobalCartIcon({
    super.key,
    required this.marketSlug,
    this.iconKey,
    this.iconColor = Colors.white,
    this.iconSize = 22,
    this.padding,
    this.style,
  });

  final String marketSlug;
  final Key? iconKey;
  final Color iconColor;
  final double iconSize;
  final EdgeInsetsGeometry? padding;
  final ButtonStyle? style;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CartCubit, List<CartLine>>(
      buildWhen: (prev, next) => prev != next,
      builder: (context, _) {
        final count = context.read<CartCubit>().itemCount;
        final label = count > 99 ? '99+' : '$count';
        return Padding(
          padding: padding ??
              const EdgeInsetsDirectional.only(start: 2, end: 4),
          child: Badge(
            isLabelVisible: count > 0,
            backgroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            label: Text(
              label,
              style: GoogleFonts.cairo(
                color: AppColors.primaryTeal,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                height: 1,
              ),
            ),
            child: IconButton(
              key: iconKey,
              style: style ??
                  IconButton.styleFrom(
                    splashFactory: NoSplash.splashFactory,
                  ),
              icon: Icon(
                Icons.shopping_cart_outlined,
                color: iconColor,
                size: iconSize,
              ),
              onPressed: () => context.push('/market/$marketSlug/cart'),
            ),
          ),
        );
      },
    );
  }
}
