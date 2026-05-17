import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../api/models/product.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../cart/application/cart_cubit.dart';

/// Product quick view with Add to cart (Now Market teal actions).
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

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final parsed = Product.fromJson(p);
    final name = parsed.name;
    final description = parsed.description;
    final price = parsed.basePrice;
    final productId = p['id']?.toString() ?? '';
    final imageUrl = productImageUrl(p);

    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final canAdd = parsed.canAddToCart;

    return AnimatedPadding(
      duration: const Duration(milliseconds: 120),
      curve: Curves.easeOut,
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  primary: false,
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AspectRatio(
                        aspectRatio: 1,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: _heroImage(
                            heroTag: widget.heroTag,
                            imageUrl: imageUrl,
                            productId: productId,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        name,
                        textAlign: TextAlign.right,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF0A0A0A),
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '₪${price.toStringAsFixed(2)}',
                        textAlign: TextAlign.right,
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  color: AppColors.primaryTeal,
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          description,
                          textAlign: TextAlign.right,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: const Color(0xFF475569),
                                  ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0x330F766E)),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            onPressed: () =>
                                setState(() => _qty = _qty > 1 ? _qty - 1 : 1),
                            icon: const Text('−',
                                style: TextStyle(
                                    color: AppColors.primaryTeal,
                                    fontSize: 18)),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              '$_qty',
                              style: const TextStyle(
                                color: AppColors.primaryTeal,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: () => setState(() => _qty++),
                            icon: const Text('+',
                                style: TextStyle(
                                    color: AppColors.primaryTeal,
                                    fontSize: 18)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primaryTeal,
                            foregroundColor: AppColors.textOnTeal,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                          onPressed: productId.isEmpty || !canAdd
                              ? null
                              : () {
                                  final cart = context.read<CartCubit>();
                                  if (cart
                                      .hasDifferentTenant(widget.tenantId)) {
                                    showDialog<bool>(
                                      context: context,
                                      builder: (context) => AlertDialog(
                                        title: const Text('متجر مختلف'),
                                        content: const Text(
                                          'سلتك تحتوي على منتجات من متجر آخر. هل تريد إفراغ السلة والبدء بالطلب من هذا المتجر؟',
                                          textAlign: TextAlign.right,
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () =>
                                                Navigator.of(context)
                                                    .pop(false),
                                            child: const Text('إلغاء'),
                                          ),
                                          FilledButton(
                                            onPressed: () =>
                                                Navigator.of(context).pop(true),
                                            child: const Text(
                                                'إفراغ السلة والبدء مجدداً'),
                                          ),
                                        ],
                                      ),
                                    ).then((ok) {
                                      if (ok != true || !context.mounted)
                                        return;
                                      cart.clear();
                                      cart.addOrIncrement(
                                        tenantId: widget.tenantId,
                                        productId: productId,
                                        name: name,
                                        unitPrice: price,
                                        imageUrl: imageUrl,
                                        addQty: _qty,
                                        optionGroupsJson:
                                            optionGroupsToOrderJson(
                                                parsed.optionGroups),
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
                                    optionGroupsJson: optionGroupsToOrderJson(
                                        parsed.optionGroups),
                                  );
                                  Navigator.of(context).pop();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'تمت الإضافة للسلة',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium
                                            ?.copyWith(color: Colors.white),
                                      ),
                                      backgroundColor: AppColors.primaryTeal,
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                },
                          child:
                              Text(canAdd ? 'أضف للسلة' : 'غير متوفر حالياً'),
                        ),
                      ),
                    ),
                  ],
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
        ? const ColoredBox(color: Color(0xFFF1F5F9))
        : Image.network(imageUrl, fit: BoxFit.cover);
    if (heroTag != null && heroTag.isNotEmpty) {
      return Hero(tag: heroTag, child: child);
    }
    return child;
  }
}
