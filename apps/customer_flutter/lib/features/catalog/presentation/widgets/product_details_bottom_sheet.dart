import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../api/models/product.dart';
import '../../../../design_system/design_system.dart';
import '../../../cart/application/cart_cubit.dart';

/// Product quick view with Add to cart (Now Market design system).
Future<void> showProductDetailsBottomSheet(
  BuildContext context, {
  required String tenantId,
  required Map<String, dynamic> product,
  String? heroTag,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _ProductSheetBody(
      tenantId: tenantId,
      product: product,
      heroTag: heroTag,
    ),
  );
}

String productImageUrl(Map<String, dynamic> p) {
  final direct = p['imageUrl']?.toString();
  if (direct != null && direct.trim().isNotEmpty) {
    return resolveImageUrl(direct);
  }
  final images = p['images'];
  if (images is List && images.isNotEmpty) {
    final first = images.first;
    if (first is Map) {
      return resolveImageUrl(first['url']?.toString());
    }
  }
  return '';
}

class _ProductSheetBody extends StatefulWidget {
  const _ProductSheetBody({
    required this.tenantId,
    required this.product,
    this.heroTag,
  });

  final String tenantId;
  final Map<String, dynamic> product;
  final String? heroTag;

  @override
  State<_ProductSheetBody> createState() => _ProductSheetBodyState();
}

class _ProductSheetBodyState extends State<_ProductSheetBody> {
  int _qty = 1;

  void _addToCart({
    required BuildContext context,
    required Product parsed,
    required String productId,
    required String name,
    required double price,
    required String imageUrl,
  }) {
    final cart = context.read<CartCubit>();
    if (cart.hasDifferentTenant(widget.tenantId)) {
      showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('متجر مختلف', style: NmdTypography.h3),
          content: Text(
            'سلتك تحتوي على منتجات من متجر آخر. هل تريد إفراغ السلة والبدء بالطلب من هذا المتجر؟',
            textAlign: TextAlign.right,
            style: NmdTypography.body,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text('إلغاء', style: NmdTypography.label),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('إفراغ السلة والبدء مجدداً'),
            ),
          ],
        ),
      ).then((ok) {
        if (ok != true || !context.mounted) return;
        cart.clear();
        cart.addOrIncrement(
          tenantId: widget.tenantId,
          productId: productId,
          name: name,
          unitPrice: price,
          imageUrl: imageUrl,
          addQty: _qty,
          optionGroupsJson: optionGroupsToOrderJson(parsed.optionGroups),
        );
        Navigator.of(context).pop();
      });
      return;
    }
    cart.addOrIncrement(
      tenantId: widget.tenantId,
      productId: productId,
      name: name,
      unitPrice: price,
      imageUrl: imageUrl,
      addQty: _qty,
      optionGroupsJson: optionGroupsToOrderJson(parsed.optionGroups),
    );
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'تمت الإضافة للسلة',
          style: NmdTypography.body.copyWith(color: NmdColors.textOnBrand),
        ),
        backgroundColor: NmdColors.brandPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: NmdRadius.borderSm),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final parsed = Product.fromJson(p);
    final name = parsed.name;
    final description = parsed.description;
    final price = parsed.basePrice;
    final productId = p['id']?.toString() ?? '';
    final imageUrl = productImageUrl(p);
    final lineTotal = price * _qty;

    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final canAdd = parsed.canAddToCart;

    return AnimatedPadding(
      duration: NmdMotion.fast,
      curve: NmdMotion.standard,
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        decoration: BoxDecoration(
          color: NmdColors.surfaceBase,
          borderRadius: NmdRadius.borderTopSheet,
          boxShadow: NmdShadows.lg,
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: NmdSpacing.sm),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: NmdColors.borderSubtle,
                  borderRadius: NmdRadius.borderPill,
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  primary: false,
                  padding: const EdgeInsets.fromLTRB(
                    NmdSpacing.md,
                    NmdSpacing.md,
                    NmdSpacing.md,
                    NmdSpacing.sm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AspectRatio(
                        aspectRatio: 1,
                        child: ClipRRect(
                          borderRadius: NmdRadius.borderLg,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              _heroImage(
                                heroTag: widget.heroTag,
                                imageUrl: imageUrl,
                                productId: productId,
                              ),
                              if (!canAdd)
                                PositionedDirectional(
                                  top: NmdSpacing.sm,
                                  end: NmdSpacing.sm,
                                  child: const NmdBadge(
                                    label: 'غير متوفر',
                                    tone: NmdBadgeTone.neutral,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: NmdSpacing.md),
                      Text(
                        name,
                        textAlign: TextAlign.right,
                        style: NmdTypography.h2,
                      ),
                      const SizedBox(height: NmdSpacing.xxs),
                      Row(
                        textDirection: TextDirection.rtl,
                        children: [
                          Text(
                            '₪${price.toStringAsFixed(2)}',
                            style: NmdTypography.h1.copyWith(
                              color: NmdColors.brandPrimary,
                              fontSize: 22,
                            ),
                          ),
                          if (_qty > 1) ...[
                            const SizedBox(width: NmdSpacing.sm),
                            Text(
                              '· الإجمالي ₪${lineTotal.toStringAsFixed(2)}',
                              style: NmdTypography.bodySmall,
                            ),
                          ],
                        ],
                      ),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: NmdSpacing.sm),
                        Text(
                          description,
                          textAlign: TextAlign.right,
                          maxLines: 6,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.body.copyWith(
                            color: NmdColors.textSecondary,
                            height: 1.55,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              DecoratedBox(
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
                    NmdSpacing.md,
                    NmdSpacing.sm,
                    NmdSpacing.md,
                    NmdSpacing.md,
                  ),
                  child: Row(
                    children: [
                      _QtyStepper(
                        qty: _qty,
                        onDecrement: () =>
                            setState(() => _qty = _qty > 1 ? _qty - 1 : 1),
                        onIncrement: () => setState(() => _qty++),
                      ),
                      const SizedBox(width: NmdSpacing.sm),
                      Expanded(
                        child: NmdButton(
                          label: canAdd ? 'أضف للسلة' : 'غير متوفر حالياً',
                          onPressed: productId.isEmpty || !canAdd
                              ? null
                              : () => _addToCart(
                                    context: context,
                                    parsed: parsed,
                                    productId: productId,
                                    name: name,
                                    price: price,
                                    imageUrl: imageUrl,
                                  ),
                          icon: canAdd
                              ? const Icon(
                                  Icons.add_shopping_cart_rounded,
                                  size: 20,
                                  color: NmdColors.textOnBrand,
                                )
                              : null,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroImage({
    required String? heroTag,
    required String imageUrl,
    required String productId,
  }) {
    final child = imageUrl.isEmpty
        ? ColoredBox(
            color: NmdColors.tintAliveSoft,
            child: Icon(
              Icons.fastfood_outlined,
              size: 48,
              color: NmdColors.brandPrimary.withValues(alpha: 0.4),
            ),
          )
        : CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.cover,
            fadeInDuration: NmdMotion.fast,
          );
    if (heroTag != null && heroTag.isNotEmpty) {
      return Hero(tag: heroTag, child: child);
    }
    return child;
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({
    required this.qty,
    required this.onDecrement,
    required this.onIncrement,
  });

  final int qty;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: NmdColors.borderBrand),
        borderRadius: NmdRadius.borderPill,
        color: NmdColors.tintAliveMuted,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            onPressed: onDecrement,
            icon:
                const Icon(Icons.remove_rounded, color: NmdColors.brandPrimary),
            visualDensity: VisualDensity.compact,
          ),
          Text(
            '$qty',
            style:
                NmdTypography.bodyBold.copyWith(color: NmdColors.brandPrimary),
          ),
          IconButton(
            onPressed: onIncrement,
            icon: const Icon(Icons.add_rounded, color: NmdColors.brandPrimary),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}
