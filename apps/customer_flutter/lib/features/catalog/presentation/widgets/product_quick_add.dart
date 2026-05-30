import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../api/models/product.dart';
import '../../../../design_system/design_system.dart';
import '../../../cart/application/cart_cubit.dart';

/// True when the customer must pick modifiers before ordering.
bool productHasOrderModifiers(Product product) {
  return product.optionGroups.any((group) => group.items.isNotEmpty);
}

Future<void> handleProductQuickAdd({
  required BuildContext context,
  required Product product,
  required String tenantId,
  required String marketSlug,
  required String storeId,
  required bool available,
}) async {
  if (!available || !product.canAddToCart) return;

  if (productHasOrderModifiers(product)) {
    context.push('/market/$marketSlug/store/$storeId/product/${product.id}');
    return;
  }

  final cart = context.read<CartCubit>();
  if (cart.hasDifferentTenant(tenantId)) {
    final shouldClear = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('متجر مختلف', style: NmdTypography.h3),
        content: Text(
          'سلتك تحتوي على منتجات من متجر آخر. هل تريد إفراغ السلة والبدء بالطلب من هذا المتجر؟',
          textAlign: TextAlign.right,
          style: NmdTypography.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('إفراغ السلة والبدء مجدداً'),
          ),
        ],
      ),
    );
    if (shouldClear != true || !context.mounted) return;
    cart.clear();
  }

  cart.addOrIncrement(
    tenantId: tenantId,
    productId: product.id,
    name: product.name,
    unitPrice: product.customerListPrice,
    merchantUnitPrice: product.basePrice,
    imageUrl: product.imageUrl,
    optionGroupsJson: optionGroupsToOrderJson(product.optionGroups),
  );

  HapticFeedback.lightImpact();
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).hideCurrentSnackBar();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        'انضاف ${product.name} للسلة',
        textAlign: TextAlign.right,
        style: NmdTypography.bodyBold.copyWith(color: NmdColors.textOnBrand),
      ),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(milliseconds: 1400),
      backgroundColor: NmdColors.brandPrimary,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 88),
    ),
  );
}
