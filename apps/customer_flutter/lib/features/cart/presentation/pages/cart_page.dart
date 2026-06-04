import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../design_system/design_system.dart';
import '../../application/cart_cubit.dart';
import '../widgets/cart_modifier_lines.dart';
import '../widgets/premium_checkout_dock.dart';

class CartPage extends StatelessWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context) {
    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';

    return ColoredBox(
      color: NmdColors.surfaceMuted,
      child: Scaffold(
        backgroundColor: NmdColors.surfaceMuted,
        body: Column(
          children: [
            NmdAppHeader(
              title: 'السلة',
              leading: NmdAppHeader.backLeading(
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/market/$slug');
                  }
                },
              ),
            ),
            Expanded(
              child: BlocBuilder<CartCubit, List<CartLine>>(
                builder: (context, lines) {
                  if (lines.isEmpty) {
                    return NmdEmptyState(
                      title: 'السلة فارغة',
                      message: 'تصفّح المتاجر وأضف منتجاتك هنا',
                      icon: Icons.shopping_bag_outlined,
                      actionLabel: 'تصفّح المتاجر',
                      onAction: slug.isEmpty
                          ? null
                          : () => context.go('/market/$slug'),
                    );
                  }

                  final total =
                      lines.fold<double>(0, (s, e) => s + e.lineTotal);
                  final itemCount =
                      lines.fold<int>(0, (s, e) => s + e.quantity);
                  final cart = context.read<CartCubit>();

                  return Column(
                    children: [
                      Expanded(
                        child: ListView.separated(
                          primary: true,
                          padding: const EdgeInsets.fromLTRB(
                            NmdSpacing.screenHorizontal,
                            NmdSpacing.xs,
                            NmdSpacing.screenHorizontal,
                            kPremiumCheckoutDockScrollInset,
                          ),
                          itemCount: lines.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: NmdSpacing.xxs),
                          itemBuilder: (context, i) {
                            final line = lines[i];
                            return Dismissible(
                              key: ValueKey(line.lineKey),
                              direction: DismissDirection.endToStart,
                              background: Container(
                                alignment: Alignment.centerLeft,
                                padding: const EdgeInsets.only(left: 18),
                                decoration: BoxDecoration(
                                  color: NmdColors.errorSoft,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.delete_outline_rounded,
                                  color: NmdColors.error,
                                ),
                              ),
                              onDismissed: (_) {
                                HapticFeedback.mediumImpact();
                                cart.removeLine(line.lineKey);
                              },
                              child: _CartLineCard(
                                line: line,
                                onRemove: () {
                                  HapticFeedback.lightImpact();
                                  cart.removeLine(line.lineKey);
                                },
                                onQtyChanged: (q) =>
                                    cart.setQuantity(line.lineKey, q),
                              ),
                            );
                          },
                        ),
                      ),
                      PremiumCheckoutDock(
                        total: total,
                        label: 'إتمام الطلب',
                        subtitle:
                            '$itemCount ${itemCount == 1 ? 'منتج' : 'منتجات'}',
                        onPressed: () async {
                          await ensureCustomerAuth(context);
                          if (!context.mounted) return;
                          context.push('/market/$slug/checkout');
                        },
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartLineCard extends StatefulWidget {
  const _CartLineCard({
    required this.line,
    required this.onRemove,
    required this.onQtyChanged,
  });

  final CartLine line;
  final VoidCallback onRemove;
  final ValueChanged<int> onQtyChanged;

  @override
  State<_CartLineCard> createState() => _CartLineCardState();
}

class _CartLineCardState extends State<_CartLineCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _qtyBounce;

  @override
  void initState() {
    super.initState();
    _qtyBounce = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
  }

  @override
  void didUpdateWidget(_CartLineCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.line.quantity != widget.line.quantity) {
      _qtyBounce.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _qtyBounce.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final line = widget.line;
    return NmdCard(
      variant: NmdCardVariant.outlined,
      padding: const EdgeInsets.all(NmdSizes.cardPaddingDense),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        textDirection: TextDirection.rtl,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 52,
                height: 52,
                child: line.imageUrl.isEmpty
                    ? ColoredBox(
                        color: NmdColors.tintAliveSoft,
                        child: Icon(
                          Icons.fastfood_outlined,
                          size: 22,
                          color: NmdColors.brandPrimary.withValues(alpha: 0.35),
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: line.imageUrl,
                        fit: BoxFit.cover,
                        fadeInDuration: NmdMotion.fast,
                        errorWidget: (_, __, ___) =>
                            ColoredBox(color: NmdColors.tintAliveMuted),
                      ),
              ),
            ),
          ),
          const SizedBox(width: NmdSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  textDirection: TextDirection.rtl,
                  children: [
                    Expanded(
                      child: Text(
                        line.name,
                        textAlign: TextAlign.right,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: NmdTypography.label.copyWith(
                          fontSize: 13,
                          height: 1.25,
                        ),
                      ),
                    ),
                    const SizedBox(width: NmdSpacing.xxs),
                    AnimatedSwitcher(
                      duration: NmdMotion.fast,
                      switchInCurve: NmdMotion.standard,
                      child: Text(
                        NmdFormat.money(line.lineTotal),
                        key: ValueKey('${line.lineKey}-${line.lineTotal}'),
                        style: NmdTypography.price.copyWith(fontSize: 13),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  NmdFormat.money(line.unitPrice),
                  textAlign: TextAlign.right,
                  style: NmdTypography.micro.copyWith(fontSize: 10),
                ),
                if (line.selectedOptions.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  CartModifierLines(
                    selectedOptions: line.selectedOptions,
                    optionGroupsJson: line.optionGroupsJson,
                    compact: true,
                  ),
                ],
                const SizedBox(height: NmdSpacing.xxs),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    ScaleTransition(
                      scale: Tween<double>(begin: 1, end: 1.08).animate(
                        CurvedAnimation(
                          parent: _qtyBounce,
                          curve: Curves.easeOutCubic,
                        ),
                      ),
                      child: _CartQtyStepper(
                        qty: line.quantity,
                        onChanged: widget.onQtyChanged,
                      ),
                    ),
                    IconButton(
                      onPressed: widget.onRemove,
                      style: IconButton.styleFrom(
                        minimumSize: const Size(34, 34),
                        padding: EdgeInsets.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      icon: const Icon(
                        Icons.delete_outline_rounded,
                        color: NmdColors.textTertiary,
                        size: 19,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CartQtyStepper extends StatelessWidget {
  const _CartQtyStepper({
    required this.qty,
    required this.onChanged,
  });

  final int qty;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: NmdColors.surfaceMuted.withValues(alpha: 0.85),
        borderRadius: NmdRadius.borderPill,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _qtyBtn(Icons.remove_rounded, () => onChanged(qty > 1 ? qty - 1 : 1)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NmdSpacing.xs),
            child: Text(
              '$qty',
              style: NmdTypography.label.copyWith(
                fontSize: 13,
                color: NmdColors.brandPrimary,
              ),
            ),
          ),
          _qtyBtn(Icons.add_rounded, () => onChanged(qty + 1)),
        ],
      ),
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: NmdRadius.borderPill,
        child: SizedBox(
          width: 32,
          height: 32,
          child: Icon(icon, size: 16, color: NmdColors.brandPrimary),
        ),
      ),
    );
  }
}
