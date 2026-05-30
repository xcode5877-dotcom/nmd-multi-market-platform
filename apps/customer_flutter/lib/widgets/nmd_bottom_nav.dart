import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../design_system/design_system.dart';
import '../features/cart/application/cart_cubit.dart';

enum MainTab {
  home,
  rewards,
  orders,
  account,
  cart,
}

class NmdBottomNav extends StatelessWidget {
  const NmdBottomNav({
    super.key,
    required this.currentTab,
    required this.onTabSelected,
  });

  final MainTab currentTab;
  final ValueChanged<MainTab> onTabSelected;

  static const double navHeight = NmdSizes.bottomNavBody;

  @override
  Widget build(BuildContext context) {
    final items = <({MainTab tab, IconData icon, String label})>[
      (tab: MainTab.home, icon: Icons.home_outlined, label: 'الرئيسية'),
      (
        tab: MainTab.rewards,
        icon: Icons.card_giftcard_outlined,
        label: 'المكافآت'
      ),
      (tab: MainTab.cart, icon: Icons.shopping_cart_rounded, label: 'السلة'),
      (tab: MainTab.orders, icon: Icons.receipt_long_outlined, label: 'طلباتي'),
      (tab: MainTab.account, icon: Icons.person_outline, label: 'حسابي'),
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: NmdColors.surfaceBase,
        border: Border(
          top: BorderSide(color: NmdColors.borderSubtle.withValues(alpha: 0.95)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: SizedBox(
            height: navHeight,
            child: Row(
              children: items
                  .map(
                    (item) => Expanded(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => onTabSelected(item.tab),
                          child: _NavItem(
                            icon: item.icon,
                            label: item.label,
                            fabLike: item.tab == MainTab.cart,
                            selected: currentTab == item.tab,
                            showNewBadge: item.tab == MainTab.rewards,
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    this.fabLike = false,
    this.showNewBadge = false,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final bool fabLike;
  final bool showNewBadge;

  @override
  Widget build(BuildContext context) {
    final inactive = NmdColors.textSecondary;
    final active = NmdColors.brandPrimary;

    Widget iconWidget;
    if (fabLike) {
      iconWidget = BlocBuilder<CartCubit, List<CartLine>>(
        buildWhen: (a, b) => a.length != b.length ||
            a.fold<int>(0, (s, e) => s + e.quantity) !=
                b.fold<int>(0, (s, e) => s + e.quantity),
        builder: (context, lines) {
          final count = lines.fold<int>(0, (s, e) => s + e.quantity);
          final label = count > 99 ? '99+' : '$count';
          return Transform.translate(
            offset: const Offset(0, -4),
            child: Badge(
              isLabelVisible: count > 0,
              backgroundColor: NmdColors.error,
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              label: Text(
                label,
                style: NmdTypography.micro.copyWith(
                  color: NmdColors.textOnBrand,
                  fontSize: 9,
                ),
              ),
              child: Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: selected ? NmdColors.brandDeep : NmdColors.brandPrimary,
                  shape: BoxShape.circle,
                  boxShadow: NmdShadows.brandGlow(alpha: 0.28),
                ),
                child: Icon(icon, size: 22, color: NmdColors.textOnBrand),
              ),
            ),
          );
        },
      );
    } else {
      iconWidget = Icon(
        icon,
        size: NmdSizes.iconMd,
        color: selected ? active : inactive,
      );
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            iconWidget,
            if (!fabLike && showNewBadge)
              Positioned(
                top: -8,
                right: -10,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: NmdColors.brandPrimary,
                    borderRadius: NmdRadius.borderPill,
                  ),
                  child: Text(
                    'جديد',
                    style: NmdTypography.micro.copyWith(
                      color: NmdColors.textOnBrand,
                      fontSize: 8,
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (!fabLike) ...[
          const SizedBox(height: 4),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: NmdTypography.micro.copyWith(
              color: selected ? active : inactive,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
              fontSize: 11,
            ),
          ),
        ],
      ],
    );
  }
}
