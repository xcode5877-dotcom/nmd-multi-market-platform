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
                    return const NmdEmptyState(
                      title: 'السلة فارغة',
                      message: 'تصفّح المتاجر وأضف منتجاتك هنا',
                      icon: Icons.shopping_bag_outlined,
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
      padding: const EdgeInsets.all(NmdSpacing.sm + 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: NmdRadius.borderSm,
            child: SizedBox(
              width: 72,
              height: 72,
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
              crossAxisAlignment: CrossAxisAlignment.end,
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
                  '₪${line.unitPrice.toStringAsFixed(2)}',
                  textAlign: TextAlign.right,
                  style: NmdTypography.bodySmall,
                ),
                if (line.selectedOptions.isNotEmpty) ...[
                  const SizedBox(height: NmdSpacing.xxs),
                  CartModifierLines(
                    selectedOptions: line.selectedOptions,
                    optionGroupsJson: line.optionGroupsJson,
                    compact: true,
                  ),
                ],
                const SizedBox(height: NmdSpacing.xs),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      onPressed: onRemove,
                      icon: const Icon(
                        Icons.delete_outline_rounded,
                        color: NmdColors.textTertiary,
                        size: 22,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                    _CartQtyStepper(
                      qty: line.quantity,
                      onChanged: onQtyChanged,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: NmdSpacing.xxs),
          Text(
            '₪${line.lineTotal.toStringAsFixed(2)}',
            style: NmdTypography.h3.copyWith(
              color: NmdColors.brandPrimary,
              fontSize: 16,
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
        border: Border.all(color: NmdColors.borderSubtle),
        borderRadius: NmdRadius.borderPill,
        color: NmdColors.surfaceBase,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _qtyBtn(Icons.remove_rounded, () => onChanged(qty > 1 ? qty - 1 : 1)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NmdSpacing.xs),
            child: Text(
              '$qty',
              style:
                  NmdTypography.label.copyWith(color: NmdColors.brandPrimary),
            ),
          ),
          _qtyBtn(Icons.add_rounded, () => onChanged(qty + 1)),
        ],
      ),
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: NmdRadius.borderPill,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Icon(icon, size: 18, color: NmdColors.brandPrimary),
      ),
    );
  }
}

class _CartCheckoutBar extends StatelessWidget {
  const _CartCheckoutBar({
    required this.total,
    required this.onCheckout,
  });

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
          boxShadow: NmdShadows.sm,
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
                  Text('الإجمالي', style: NmdTypography.h3),
                  Text(
                    '₪${total.toStringAsFixed(2)}',
                    style: NmdTypography.h1.copyWith(
                      color: NmdColors.brandPrimary,
                      fontSize: 22,
                    ),
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
