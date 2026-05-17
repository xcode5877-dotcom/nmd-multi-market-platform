import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_typography.dart';

/// Foundation app header — centered title, RTL row, teal bar.
///
/// Feature-free: pass [leading], [center], and [actions] widgets; wire cart/auth
/// in presentation layer when migrating screens.
class NmdAppHeader extends StatelessWidget implements PreferredSizeWidget {
  const NmdAppHeader({
    super.key,
    this.title = 'Now Market',
    this.center,
    this.leading,
    this.actions = const [],
    this.backgroundColor = NmdColors.brandPrimary,
    this.showLeadingPlaceholder = false,
  });

  final String title;
  final Widget? center;
  final Widget? leading;
  final List<Widget> actions;
  final Color backgroundColor;
  final bool showLeadingPlaceholder;

  /// Content height below safe area (matches legacy [GlobalNmdHeader]).
  static const double barBodyHeight = 44;

  static const double _iconSize = 24;
  static const double _gapActions = 8;

  static ButtonStyle plainIconStyle({Color foreground = NmdColors.textOnBrand}) {
    return IconButton.styleFrom(
      foregroundColor: foreground,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      minimumSize: const Size(40, 40),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
      splashFactory: NoSplash.splashFactory,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
    );
  }

  static Widget backLeading({VoidCallback? onPressed}) {
    return IconButton(
      style: plainIconStyle(),
      onPressed: onPressed,
      icon: const Icon(Icons.arrow_back_ios_new, size: 22, color: NmdColors.textOnBrand),
    );
  }

  static Widget profileAction({VoidCallback? onPressed}) {
    return IconButton(
      style: plainIconStyle(),
      onPressed: onPressed,
      icon: const Icon(Icons.person_outline, size: _iconSize, color: NmdColors.textOnBrand),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(barBodyHeight);

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ColoredBox(
      color: backgroundColor,
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
                if (leading != null)
                  leading!
                else if (showLeadingPlaceholder)
                  const SizedBox(width: 12)
                else
                  const SizedBox(width: 12),
                Expanded(
                  child: Align(
                    alignment: Alignment.center,
                    child: center ??
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: NmdTypography.appBarTitle,
                        ),
                  ),
                ),
                if (actions.isNotEmpty)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    textDirection: TextDirection.rtl,
                    children: [
                      for (var i = 0; i < actions.length; i++) ...[
                        if (i > 0) const SizedBox(width: _gapActions),
                        actions[i],
                      ],
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
