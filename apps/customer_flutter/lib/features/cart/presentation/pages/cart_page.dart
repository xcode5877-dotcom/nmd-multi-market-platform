import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../design_system/design_system.dart';
import '../../application/cart_cubit.dart';
import '../widgets/cart_modifier_lines.dart';

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
                  final cart = context.read<CartCubit>();

                  return Column(
                    children: [
                      Expanded(
                        child: ListView.separated(
                          primary: true,
                          padding: const EdgeInsets.fromLTRB(
                            NmdSpacing.screenHorizontal,
                            NmdSpacing.md,
                            NmdSpacing.screenHorizontal,
                            NmdSpacing.sm,
                          ),
                          itemCount: lines.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: NmdSpacing.sm),
                          itemBuilder: (context, i) {
                            final line = lines[i];
                            return _CartLineCard(
                              line: line,
                              onRemove: () => cart.removeLine(line.lineKey),
                              onQtyChanged: (q) =>
                                  cart.setQuantity(line.lineKey, q),
                            );
                          },
                        ),
                      ),
                      _CartCheckoutBar(
                        itemCount: lines.fold<int>(
                            0, (s, e) => s + e.quantity),
                        total: total,
                        onCheckout: () async {
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

class _CartLineCard extends StatelessWidget {
  const _CartLineCard({
    required this.line,
    required this.onRemove,
    required this.onQtyChanged,
  });

  final CartLine line;
  final VoidCallback onRemove;
  final ValueChanged<int> onQtyChanged;

  @override
  Widget build(BuildContext context) {
    return NmdCard(
      variant: NmdCardVariant.outlined,
      padding: EdgeInsets.all(NmdSizes.cardPadding),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        textDirection: TextDirection.rtl,
        children: [
          ClipRRect(
            borderRadius: NmdRadius.borderSm,
            child: SizedBox(
              width: NmdSizes.productThumb,
              height: NmdSizes.productThumb,
              child: line.imageUrl.isEmpty
                  ? ColoredBox(
                      color: NmdColors.tintAliveSoft,
                      child: Icon(
                        Icons.fastfood_outlined,
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
          const SizedBox(width: NmdSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  line.name,
                  textAlign: TextAlign.right,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: NmdTypography.bodyBold,
                ),
                const SizedBox(height: NmdSpacing.xxs),
                Text(
                  NmdFormat.money(line.unitPrice),
                  textAlign: TextAlign.right,
                  style: NmdTypography.bodySmall.copyWith(
                    color: NmdColors.textSecondary,
                  ),
                ),
                if (line.selectedOptions.isNotEmpty) ...[
                  const SizedBox(height: NmdSpacing.xxs),
                  CartModifierLines(
                    selectedOptions: line.selectedOptions,
                    optionGroupsJson: line.optionGroupsJson,
                    compact: true,
                  ),
                ],
                const SizedBox(height: NmdSpacing.sm),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _CartQtyStepper(
                      qty: line.quantity,
                      onChanged: onQtyChanged,
                    ),
                    IconButton(
                      onPressed: onRemove,
                      style: IconButton.styleFrom(
                        minimumSize:
                            Size(NmdSizes.touchTarget, NmdSizes.touchTarget),
                      ),
                      icon: const Icon(
                        Icons.delete_outline_rounded,
                        color: NmdColors.textTertiary,
                        size: 22,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: NmdSpacing.xs),
          Text(
            NmdFormat.money(line.lineTotal),
            style: NmdTypography.price,
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
        border: Border.all(color: NmdColors.borderSubtle),
        borderRadius: NmdRadius.borderPill,
        color: NmdColors.surfaceBase,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _qtyBtn(Icons.remove_rounded, () => onChanged(qty > 1 ? qty - 1 : 1)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NmdSpacing.sm),
            child: Text(
              '$qty',
              style: NmdTypography.label.copyWith(color: NmdColors.brandPrimary),
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
        onTap: onTap,
        borderRadius: NmdRadius.borderPill,
        child: SizedBox(
          width: NmdSizes.touchTarget,
          height: 36,
          child: Icon(icon, size: 18, color: NmdColors.brandPrimary),
        ),
      ),
    );
  }
}

class _CartCheckoutBar extends StatelessWidget {
  const _CartCheckoutBar({
    required this.itemCount,
    required this.total,
    required this.onCheckout,
  });

  final int itemCount;
  final double total;
  final VoidCallback onCheckout;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: NmdColors.surfaceBase,
          border: Border(
            top: BorderSide(
                color: NmdColors.borderSubtle.withValues(alpha: 0.9)),
          ),
          boxShadow: NmdShadows.md,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            NmdSpacing.screenHorizontal,
            NmdSpacing.sm,
            NmdSpacing.screenHorizontal,
            NmdSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('الإجمالي', style: NmdTypography.h3),
                      Text(
                        '$itemCount ${itemCount == 1 ? 'منتج' : 'منتجات'}',
                        style: NmdTypography.bodySmall,
                      ),
                    ],
                  ),
                  Text(
                    NmdFormat.money(total),
                    style: NmdTypography.priceTotal,
                  ),
                ],
              ),
              const SizedBox(height: NmdSpacing.sm),
              NmdButton(
                label: 'إتمام الطلب',
                onPressed: onCheckout,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
