import 'package:flutter/material.dart';

import '../app/theme/app_colors.dart';

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

  static const double navHeight = 64;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final items = <({MainTab tab, IconData icon, String label})>[
      (tab: MainTab.home, icon: Icons.home_outlined, label: 'الرئيسية'),
      (
        tab: MainTab.rewards,
        icon: Icons.card_giftcard_outlined,
        label: 'المكافآت'
      ),
      // Replace the removed "العروض" slot with the cart FAB.
      (tab: MainTab.cart, icon: Icons.shopping_cart_rounded, label: 'السلة'),
      (tab: MainTab.orders, icon: Icons.receipt_long_outlined, label: 'طلباتي'),
      (tab: MainTab.account, icon: Icons.person_outline, label: 'حسابي'),
    ];

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
      ),
      child: SafeArea(
        top: false,
        left: false,
        right: false,
        minimum: EdgeInsets.only(bottom: bottomInset > 0 ? bottomInset : 8),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: SizedBox(
            height: navHeight,
            child: Row(
              children: items
                  .map(
                    (item) => Expanded(
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
    final color = selected ? AppColors.primaryTeal : const Color(0xFF64748B);
    final iconWidget = fabLike
        ? Transform.translate(
            offset: const Offset(0, -6),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primaryTeal,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primaryTeal.withValues(alpha: 0.25),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Icon(icon, size: 22, color: Colors.white),
            ),
          )
        : Icon(icon, size: 22, color: color);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            iconWidget,
            if (!fabLike && showNewBadge)
              Positioned(
                top: -9,
                right: -12,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.primaryTeal,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'جديد',
                    style: TextStyle(
                        fontSize: 8,
                        color: Colors.white,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ),
          ],
        ),
        if (!fabLike) ...[
          const SizedBox(height: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
          ),
        ],
      ],
    );
  }
}
