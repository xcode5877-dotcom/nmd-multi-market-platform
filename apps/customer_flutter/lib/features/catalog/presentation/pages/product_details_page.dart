import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../api/models/pizza_placement.dart';
import '../../../../api/models/product.dart';
import '../../../../api/storefront_api.dart';
import '../../../../design_system/design_system.dart';
import '../../../../features/cart/application/cart_cubit.dart';
import '../../../../features/cart/domain/cart_selected_option.dart';
import '../../../cart/presentation/widgets/global_cart_icon.dart';
import '../../data/pillar_kind.dart';
import '../../data/tenant_contact_info.dart';
import '../widgets/pizza_side_toggle.dart';
import '../../../../widgets/app_error_view.dart';

class ProductDetailsPage extends StatefulWidget {
  const ProductDetailsPage({
    super.key,
    required this.marketSlug,
    required this.storeId,
    required this.productId,
  });

  final String marketSlug;
  final String storeId;
  final String productId;

  @override
  State<ProductDetailsPage> createState() => _ProductDetailsPageState();
}

class _ProductDetailsPageState extends State<ProductDetailsPage>
    with SingleTickerProviderStateMixin {
  late final Future<_ProductPagePayload> _future;

  /// groupId -> selected option item ids
  final Map<String, Set<String>> _selectedByGroup = {};

  /// groupId -> (optionItemId -> WHOLE|LEFT|RIGHT), web `optionPlacements`.
  final Map<String, Map<String, String>> _placementByGroup = {};

  final ScrollController _scrollController = ScrollController();
  final GlobalKey _cartIconKey = GlobalKey();
  final GlobalKey _imageKey = GlobalKey();

  bool _descExpanded = false;
  late final AnimationController _dockBounceController;
  late final Animation<double> _dockScale;

  AnimationController? _flyController;
  OverlayEntry? _flyEntry;

  @override
  void initState() {
    super.initState();
    _future = _load();
    _dockBounceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    );
    _dockScale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween<double>(begin: 1, end: 1.045), weight: 45),
      TweenSequenceItem(tween: Tween<double>(begin: 1.045, end: 1), weight: 55),
    ]).animate(CurvedAnimation(
        parent: _dockBounceController, curve: Curves.easeOutCubic));
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _dockBounceController.dispose();
    _flyController?.dispose();
    _flyEntry?.remove();
    super.dispose();
  }

  Future<_ProductPagePayload> _load() async {
    final api = StorefrontApi(context.read<Dio>());
    final market = await api.getMarketBySlug(widget.marketSlug);
    final marketId = market['id']?.toString();
    if (marketId == null || marketId.isEmpty) throw Exception('Market missing');
    final tenant = await api.getTenantDetails(marketId, widget.storeId);
    final pillars = await api.getPillars();
    final pillarIdRaw = tenant['pillarId'] ?? tenant['pillar_id'];
    final isServicesStore =
        isServicesPillarForTenant(pillarIdRaw?.toString(), pillars);
    final tenantIdForLeads = (tenant['id'] ?? widget.storeId).toString().trim();
    final officeContact = tenantContactFromTenantMap(tenant);
    final products = await api.getCatalogProducts(widget.storeId);
    final product = products.where((p) => p.id == widget.productId).toList();
    if (product.isEmpty) throw Exception('Product not found');
    return _ProductPagePayload(
      product: product.first,
      storeStatus:
          (tenant['operationalStatus']?.toString() ?? 'closed').toLowerCase(),
      isServicesStore: isServicesStore,
      tenantIdForLeads: tenantIdForLeads,
      contact: const TenantContactInfo(),
      officeContact: officeContact,
    );
  }

  Future<void> _handleAddToCart({
    required Product product,
    required double computedUnitPrice,
    required double merchantUnitPrice,
    required bool storeClosed,
  }) async {
    if (storeClosed || !product.canAddToCart) return;
    final cart = context.read<CartCubit>();
    if (cart.hasDifferentTenant(widget.storeId)) {
      final shouldClear = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('متجر مختلف'),
          content: const Text(
            'سلتك تحتوي على منتجات من متجر آخر. هل تريد إفراغ السلة والبدء بالطلب من هذا المتجر؟',
            textAlign: TextAlign.right,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('إلغاء'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('إفراغ السلة والبدء مجدداً'),
            ),
          ],
        ),
      );
      if (shouldClear != true) return;
      cart.clear();
    }

    _flyToCart(imageUrl: product.imageUrl);
    cart.addOrIncrement(
      tenantId: widget.storeId,
      productId: product.id,
      name: product.name,
      unitPrice: computedUnitPrice,
      merchantUnitPrice: merchantUnitPrice,
      imageUrl: product.imageUrl,
      addQty: 1,
      selectedOptions: _buildCartSelectedOptions(product),
      optionGroupsJson: optionGroupsToOrderJson(product.optionGroups),
    );
  }

  List<CartSelectedOption> _buildCartSelectedOptions(Product product) {
    final out = <CartSelectedOption>[];
    for (final group in product.optionGroups) {
      final ids = _selectedByGroup[group.id];
      if (ids == null || ids.isEmpty) continue;
      final pl = <String, String>{};
      for (final id in ids) {
        pl[id] = (_placementByGroup[group.id]?[id] ??
                PizzaPlacement.defaultPlacement)
            .toUpperCase();
      }
      final half = productGroupHasHalfOptions(group);
      out.add(
        CartSelectedOption(
          optionGroupId: group.id,
          optionItemIds: ids.toList(),
          sliceSelection: half ? PizzaPlacement.defaultPlacement : null,
          optionPlacements: pl,
        ),
      );
    }
    return out;
  }

  double _computeMerchantUnitPrice(Product product) {
    var total = product.basePrice;
    for (final group in product.optionGroups) {
      final selected = _selectedByGroup[group.id];
      if (selected == null || selected.isEmpty) continue;
      final placements = _placementByGroup[group.id] ?? {};

      if ((group.allowHalfPlacement || group.allowSplitting) &&
          selected.length == 2) {
        String? leftId;
        String? rightId;
        for (final id in selected) {
          final p =
              (placements[id] ?? PizzaPlacement.defaultPlacement).toUpperCase();
          if (p == PizzaPlacement.left) leftId = id;
          if (p == PizzaPlacement.right) rightId = id;
        }
        if (leftId != null && rightId != null) {
          ProductOptionItem? i1;
          ProductOptionItem? i2;
          for (final i in group.items) {
            if (i.id == leftId) i1 = i;
            if (i.id == rightId) i2 = i;
          }
          if (i1 != null && i2 != null) {
            total += (i1.priceDelta + i2.priceDelta) / 2;
            continue;
          }
        }
      }

      for (final itemId in selected) {
        ProductOptionItem? found;
        for (final i in group.items) {
          if (i.id == itemId) {
            found = i;
            break;
          }
        }
        if (found == null) continue;
        final p = (placements[itemId] ?? PizzaPlacement.defaultPlacement)
            .toUpperCase();
        final delta = found.priceDelta;
        if (p == PizzaPlacement.left || p == PizzaPlacement.right) {
          total += delta / 2;
        } else {
          total += delta;
        }
      }
    }
    return total;
  }

  double _computeCustomerUnitPrice(Product product) {
    var total = product.customerListPrice;
    for (final group in product.optionGroups) {
      final selected = _selectedByGroup[group.id];
      if (selected == null || selected.isEmpty) continue;
      final placements = _placementByGroup[group.id] ?? {};

      if ((group.allowHalfPlacement || group.allowSplitting) &&
          selected.length == 2) {
        String? leftId;
        String? rightId;
        for (final id in selected) {
          final p =
              (placements[id] ?? PizzaPlacement.defaultPlacement).toUpperCase();
          if (p == PizzaPlacement.left) leftId = id;
          if (p == PizzaPlacement.right) rightId = id;
        }
        if (leftId != null && rightId != null) {
          ProductOptionItem? i1;
          ProductOptionItem? i2;
          for (final i in group.items) {
            if (i.id == leftId) i1 = i;
            if (i.id == rightId) i2 = i;
          }
          if (i1 != null && i2 != null) {
            total += (i1.customerPriceDelta + i2.customerPriceDelta) / 2;
            continue;
          }
        }
      }

      for (final itemId in selected) {
        ProductOptionItem? found;
        for (final i in group.items) {
          if (i.id == itemId) {
            found = i;
            break;
          }
        }
        if (found == null) continue;
        final p = (placements[itemId] ?? PizzaPlacement.defaultPlacement)
            .toUpperCase();
        final delta = found.customerPriceDelta;
        if (p == PizzaPlacement.left || p == PizzaPlacement.right) {
          total += delta / 2;
        } else {
          total += delta;
        }
      }
    }
    return total;
  }

  void _setGroupSelection(String groupId, Set<String> next) {
    setState(() {
      if (next.isEmpty) {
        _selectedByGroup.remove(groupId);
        _placementByGroup.remove(groupId);
      } else {
        _selectedByGroup[groupId] = next;
        final prev = _placementByGroup[groupId] ?? {};
        final pl = <String, String>{};
        for (final id in next) {
          pl[id] = prev[id] ?? PizzaPlacement.defaultPlacement;
        }
        _placementByGroup[groupId] = pl;
      }
    });
    _dockBounceController.forward(from: 0);
  }

  void _setItemPlacement(String groupId, String itemId, String placement) {
    setState(() {
      final sel = Set<String>.from(_selectedByGroup[groupId] ?? {});
      sel.add(itemId);
      _selectedByGroup[groupId] = sel;
      final pl = Map<String, String>.from(_placementByGroup[groupId] ?? {});
      pl[itemId] = placement.toUpperCase();
      _placementByGroup[groupId] = pl;
    });
    _dockBounceController.forward(from: 0);
  }

  void _removeHalfItem(String groupId, String itemId) {
    setState(() {
      final sel = Set<String>.from(_selectedByGroup[groupId] ?? {});
      sel.remove(itemId);
      _placementByGroup[groupId]?.remove(itemId);
      if (sel.isEmpty) {
        _selectedByGroup.remove(groupId);
        _placementByGroup.remove(groupId);
      } else {
        _selectedByGroup[groupId] = sel;
      }
    });
    _dockBounceController.forward(from: 0);
  }

  String _formatDelta(double delta) {
    final abs = delta.abs().toStringAsFixed(2);
    final sign = delta >= 0 ? '+' : '-';
    return '$sign$abs₪';
  }

  void _flyToCart({required String? imageUrl}) {
    try {
      _flyController?.dispose();
      _flyEntry?.remove();

      final overlay = Overlay.of(context);
      final overlayBox = overlay.context.findRenderObject() as RenderBox;

      final cartCtx = _cartIconKey.currentContext;
      final imgCtx = _imageKey.currentContext;
      if (cartCtx == null || imgCtx == null) return;

      final cartBox = cartCtx.findRenderObject() as RenderBox;
      final imgBox = imgCtx.findRenderObject() as RenderBox;

      final startGlobal = imgBox.localToGlobal(imgBox.size.center(Offset.zero));
      final endGlobal = cartBox.localToGlobal(cartBox.size.center(Offset.zero));

      final start = startGlobal - overlayBox.localToGlobal(Offset.zero);
      final end = endGlobal - overlayBox.localToGlobal(Offset.zero);

      const size = 40.0;

      final controller = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 650),
      );
      final curve =
          CurvedAnimation(parent: controller, curve: Curves.easeOutCubic);

      _flyController = controller;

      final entry = OverlayEntry(
        builder: (context) {
          return AnimatedBuilder(
            animation: controller,
            builder: (context, _) {
              final t = curve.value;
              final dx = lerpDouble(start.dx, end.dx, t) ?? start.dx;
              final dy = lerpDouble(start.dy, end.dy, t) ?? start.dy;
              final scale = lerpDouble(1, 0.2, t) ?? 1;
              return Positioned(
                left: dx - size / 2,
                top: dy - size / 2,
                child: Transform.scale(
                  scale: scale,
                  child: Material(
                    color: Colors.transparent,
                    child: ClipOval(
                      child: imageUrl == null || imageUrl.trim().isEmpty
                          ? Container(
                              width: size,
                              height: size,
                              color: NmdColors.brandPrimary,
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.add,
                                color: NmdColors.textOnBrand,
                              ),
                            )
                          : CachedNetworkImage(
                              imageUrl: imageUrl,
                              width: size,
                              height: size,
                              fit: BoxFit.cover,
                            ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      );

      _flyEntry = entry;
      overlay.insert(entry);

      controller.addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          entry.remove();
          controller.dispose();
        }
      });
      controller.forward();
    } catch (_) {
      // Best-effort animation; never block cart add flow.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: FutureBuilder<_ProductPagePayload>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return Scaffold(
              backgroundColor: NmdColors.surfaceBase,
              body: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _productHeader(context, showCart: true),
                  Expanded(
                    child: AppErrorView.fromError(
                      error: snap.error!,
                      context: 'product_details',
                      compact: true,
                      onRetry: () => setState(() => _future = _load()),
                    ),
                  ),
                ],
              ),
            );
          }

          if (!snap.hasData) {
            return Scaffold(
              backgroundColor: NmdColors.surfaceBase,
              body: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _productHeader(context, showCart: true),
                  const Expanded(
                    child: NmdLoading(message: 'جاري تحميل المنتج...'),
                  ),
                ],
              ),
            );
          }

          final payload = snap.data!;
          final product = payload.product;
          final storeClosed = payload.storeStatus == 'closed';
          final isServices = payload.isServicesStore;
          final computedUnitPrice = _computeCustomerUnitPrice(product);
          final merchantUnitPrice = _computeMerchantUnitPrice(product);
          final heroTag = 'product-${widget.storeId}-${product.id}';

          final desc = product.description.trim();
          final shouldReadMore = desc.length > 220;
          final shownDesc = !_descExpanded && shouldReadMore
              ? '${desc.substring(0, 220)}...'
              : desc;

          final bottomPadding = MediaQuery.of(context).padding.bottom;

          return Scaffold(
            backgroundColor: NmdColors.surfaceBase,
            body: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _productHeader(
                  context,
                  showCart: !isServices,
                  cartIconKey: isServices ? null : _cartIconKey,
                ),
                Expanded(
                  child: CustomScrollView(
                    controller: _scrollController,
                    primary: false,
                    slivers: [
                      SliverToBoxAdapter(
                        child: SizedBox(
                          height: 260,
                          child: ClipPath(
                            clipper: _HeroCurvedBottomClipper(),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                Positioned.fill(
                                  child: Hero(
                                    tag: heroTag,
                                    child: SizedBox(
                                      key: _imageKey,
                                      child: product.imageUrl.isEmpty
                                          ? ColoredBox(
                                              color: NmdColors.tintAliveSoft)
                                          : CachedNetworkImage(
                                              imageUrl: product.imageUrl,
                                              fit: BoxFit.cover,
                                              fadeInDuration: NmdMotion.fast,
                                              placeholder: (_, __) =>
                                                  ColoredBox(
                                                color: NmdColors.tintAliveMuted,
                                              ),
                                              errorWidget: (_, __, ___) =>
                                                  ColoredBox(
                                                color: NmdColors.tintAliveMuted,
                                              ),
                                            ),
                                    ),
                                  ),
                                ),
                                const Positioned(
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  height: 120,
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        begin: Alignment.bottomCenter,
                                        end: Alignment.topCenter,
                                        colors: [
                                          Color(0xA6000000),
                                          Color(0x55000000),
                                          Color(0x00000000),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                            NmdSpacing.md,
                            NmdSpacing.lg,
                            NmdSpacing.md,
                            NmdSpacing.md,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                textDirection: TextDirection.rtl,
                                children: [
                                  Expanded(
                                    child: Text(
                                      product.name,
                                      maxLines: 3,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.right,
                                      style: NmdTypography.h1.copyWith(
                                        fontSize: 20,
                                        height: 1.25,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: NmdSpacing.sm),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        NmdFormat.money(computedUnitPrice),
                                        style: NmdTypography.price.copyWith(
                                          fontSize: 18,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              if (storeClosed || !product.canAddToCart) ...[
                                const SizedBox(height: NmdSpacing.xs),
                                NmdBadge(
                                  label: storeClosed
                                      ? 'المحل مغلق حالياً'
                                      : 'غير متوفر حالياً',
                                  tone: NmdBadgeTone.neutral,
                                ),
                              ],
                              if (desc.isNotEmpty) ...[
                                _FadeInUpSection(
                                  delayMs: 50,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      const SizedBox(height: 12),
                                      Text(
                                        shownDesc,
                                        style: NmdTypography.bodySmall.copyWith(
                                          height: 1.6,
                                        ),
                                      ),
                                      if (shouldReadMore) ...[
                                        const SizedBox(height: NmdSpacing.xs),
                                        GestureDetector(
                                          onTap: () => setState(() =>
                                              _descExpanded = !_descExpanded),
                                          child: Text(
                                            _descExpanded
                                                ? 'عرض أقل'
                                                : 'عرض المزيد',
                                            style: NmdTypography.label.copyWith(
                                              color: NmdColors.brandPrimary,
                                            ),
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: NmdSpacing.sm),
                                      const Divider(
                                        height: 1,
                                        color: NmdColors.divider,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                              const SizedBox(height: 14),
                              if (!isServices)
                                for (var i = 0;
                                    i < product.optionGroups.length;
                                    i++) ...[
                                  if (product
                                      .optionGroups[i].items.isNotEmpty) ...[
                                    _FadeInUpSection(
                                      delayMs: 40 + (i * 40),
                                      child: _OptionGroupChips(
                                        group: product.optionGroups[i],
                                        selectedItemIds: _selectedByGroup[
                                                product.optionGroups[i].id] ??
                                            const <String>{},
                                        placements: _placementByGroup[
                                                product.optionGroups[i].id] ??
                                            const {},
                                        onSelectionChanged: (next) =>
                                            _setGroupSelection(
                                                product.optionGroups[i].id,
                                                next),
                                        onPlacement: (itemId, p) =>
                                            _setItemPlacement(
                                                product.optionGroups[i].id,
                                                itemId,
                                                p),
                                        onRemoveHalf: (itemId) =>
                                            _removeHalfItem(
                                                product.optionGroups[i].id,
                                                itemId),
                                        formatDelta: _formatDelta,
                                      ),
                                    ),
                                    const SizedBox(height: 24),
                                  ],
                                ],
                            ],
                          ),
                        ),
                      ),
                      SliverPadding(
                        padding: EdgeInsets.only(
                          bottom: 100,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            bottomNavigationBar: isServices
                ? null
                : Padding(
                    padding: EdgeInsets.fromLTRB(
                      NmdSpacing.md,
                      0,
                      NmdSpacing.md,
                      bottomPadding + NmdSpacing.lg,
                    ),
                    child: AnimatedBuilder(
                      animation: _dockScale,
                      builder: (context, child) => Transform.scale(
                        scale: _dockScale.value,
                        child: child,
                      ),
                      child: ClipRRect(
                        borderRadius: NmdRadius.borderPill,
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                          child: NmdSurface(
                            mode: NmdSurfaceMode.alive,
                            padding: const EdgeInsets.symmetric(
                              horizontal: NmdSpacing.sm,
                              vertical: NmdSpacing.xs,
                            ),
                            borderRadius: NmdRadius.borderPill,
                            child: Row(
                              children: [
                                Container(
                                  width: 56,
                                  height: 56,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: NmdColors.brandPrimary,
                                    shape: BoxShape.circle,
                                    boxShadow: NmdShadows.brandGlow(alpha: 0.2),
                                  ),
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      NmdFormat.money(computedUnitPrice),
                                      style: NmdTypography.label.copyWith(
                                        color: NmdColors.textOnBrand,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: NmdSpacing.sm),
                                Expanded(
                                  child: _GlassAddToCartFabButton(
                                    disabled:
                                        storeClosed || !product.canAddToCart,
                                    onPressed: () => _handleAddToCart(
                                      product: product,
                                      computedUnitPrice: computedUnitPrice,
                                      merchantUnitPrice: merchantUnitPrice,
                                      storeClosed: storeClosed,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
          );
        },
      ),
    );
  }

  Widget _productHeader(
    BuildContext context, {
    required bool showCart,
    GlobalKey? cartIconKey,
  }) {
    return NmdAppHeader(
      title: '',
      center: const SizedBox.shrink(),
      leading: NmdAppHeader.backLeading(onPressed: () => context.pop()),
      actions: [
        if (showCart)
          GlobalCartIcon(
            marketSlug: widget.marketSlug,
            iconKey: cartIconKey,
            iconColor: NmdColors.textOnBrand,
            style: NmdAppHeader.plainIconStyle(),
          ),
      ],
    );
  }
}

class _ProductPagePayload {
  const _ProductPagePayload({
    required this.product,
    required this.storeStatus,
    required this.isServicesStore,
    required this.tenantIdForLeads,
    required this.contact,
    required this.officeContact,
  });

  final Product product;
  final String storeStatus;
  final bool isServicesStore;
  final String tenantIdForLeads;

  /// Product-level override (future); empty until API exposes per-service phones.
  final TenantContactInfo contact;
  final TenantContactInfo officeContact;
}

class _GlassAddToCartFabButton extends StatelessWidget {
  const _GlassAddToCartFabButton({
    required this.disabled,
    required this.onPressed,
  });

  final bool disabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return NmdButton(
      label: 'أضف للسلة',
      onPressed: disabled ? null : onPressed,
      icon: const Icon(
        Icons.shopping_cart_outlined,
        size: 20,
        color: NmdColors.textOnBrand,
      ),
      size: NmdButtonSize.medium,
    );
  }
}

class _OptionGroupChips extends StatelessWidget {
  const _OptionGroupChips({
    required this.group,
    required this.selectedItemIds,
    required this.placements,
    required this.onSelectionChanged,
    required this.onPlacement,
    required this.onRemoveHalf,
    required this.formatDelta,
  });

  final ProductOptionGroup group;
  final Set<String> selectedItemIds;
  final Map<String, String> placements;
  final ValueChanged<Set<String>> onSelectionChanged;
  final void Function(String itemId, String placement) onPlacement;
  final void Function(String itemId) onRemoveHalf;
  final String Function(double delta) formatDelta;

  @override
  Widget build(BuildContext context) {
    final isSingle = group.isSingle;
    final items = group.items;
    final hasHalf = productGroupHasHalfOptions(group);

    return NmdCard(
      variant: NmdCardVariant.outlined,
      padding: const EdgeInsets.all(NmdSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            group.name,
            textAlign: TextAlign.right,
            style: NmdTypography.h3.copyWith(color: NmdColors.brandPrimary),
          ),
          const SizedBox(height: NmdSpacing.sm),
          if (hasHalf) ...[
            for (final item in items) ...[
              if (productOptionSupportsHalf(item, group))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _PizzaHalfModifierRow(
                    item: item,
                    formatDelta: formatDelta,
                    selected: selectedItemIds.contains(item.id),
                    side:
                        (placements[item.id] ?? PizzaPlacement.defaultPlacement)
                            .toUpperCase(),
                    onSide: (p) => onPlacement(item.id, p),
                    onRemove: () => onRemoveHalf(item.id),
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: _TagChip(
                      label: item.name,
                      deltaLabel: formatDelta(item.priceDelta),
                      selected: selectedItemIds.contains(item.id),
                      enabled: selectedItemIds.contains(item.id) ||
                          selectedItemIds.length < group.maxSelected,
                      onTap: () {
                        final selected = selectedItemIds.contains(item.id);
                        final next = {...selectedItemIds};
                        if (selected) {
                          next.remove(item.id);
                        } else {
                          next.add(item.id);
                        }
                        onSelectionChanged(next);
                      },
                    ),
                  ),
                ),
            ],
          ] else if (isSingle)
            SizedBox(
              height: 62,
              child: ListView.separated(
                reverse: true,
                scrollDirection: Axis.horizontal,
                primary: false,
                shrinkWrap: true,
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final item = items[index];
                  final selected = selectedItemIds.contains(item.id);
                  return _TagChip(
                    label: item.name,
                    deltaLabel: formatDelta(item.priceDelta),
                    selected: selected,
                    enabled: true,
                    onTap: () => onSelectionChanged({item.id}),
                  );
                },
              ),
            )
          else ...[
            Builder(
              builder: (context) {
                final freeItems =
                    items.where((i) => i.priceDelta == 0).toList();
                final paidItems =
                    items.where((i) => i.priceDelta != 0).toList();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (freeItems.isNotEmpty) ...[
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: freeItems.map((item) {
                          final selected = selectedItemIds.contains(item.id);
                          return _TagChip(
                            label: item.name,
                            deltaLabel: formatDelta(item.priceDelta),
                            selected: selected,
                            enabled: selected ||
                                selectedItemIds.length < group.maxSelected,
                            onTap: () {
                              final next = {...selectedItemIds};
                              if (selected) {
                                next.remove(item.id);
                              } else {
                                next.add(item.id);
                              }
                              onSelectionChanged(next);
                            },
                          );
                        }).toList(),
                      ),
                      if (paidItems.isNotEmpty) const SizedBox(height: 12),
                    ],
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: paidItems.map((item) {
                        final selected = selectedItemIds.contains(item.id);
                        final disabled = !selected &&
                            selectedItemIds.length >= group.maxSelected;
                        return _TagChip(
                          label: item.name,
                          deltaLabel: formatDelta(item.priceDelta),
                          selected: selected,
                          enabled: !disabled,
                          onTap: () {
                            if (disabled) return;
                            final next = {...selectedItemIds};
                            if (selected) {
                              next.remove(item.id);
                            } else {
                              next.add(item.id);
                            }
                            onSelectionChanged(next);
                          },
                        );
                      }).toList(),
                    ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _PizzaHalfModifierRow extends StatelessWidget {
  const _PizzaHalfModifierRow({
    required this.item,
    required this.formatDelta,
    required this.selected,
    required this.side,
    required this.onSide,
    required this.onRemove,
  });

  final ProductOptionItem item;
  final String Function(double delta) formatDelta;
  final bool selected;
  final String side;
  final ValueChanged<String> onSide;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final priceStr =
        item.priceDelta > 0 ? ' ${formatDelta(item.priceDelta)}' : '';
    return NmdSurface(
      mode: NmdSurfaceMode.muted,
      padding: const EdgeInsets.symmetric(
        horizontal: NmdSpacing.sm,
        vertical: NmdSpacing.sm,
      ),
      borderRadius: NmdRadius.borderPill,
      child: Row(
        textDirection: TextDirection.rtl,
        children: [
          if (selected)
            TextButton(
              onPressed: onRemove,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                'إزالة',
                style: NmdTypography.micro.copyWith(color: NmdColors.error),
              ),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${item.name}$priceStr',
                  textAlign: TextAlign.right,
                  style: NmdTypography.bodyBold.copyWith(fontSize: 13),
                ),
                if (selected && side != PizzaPlacement.whole) ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.circle,
                        size: 6,
                        color: NmdColors.brandPrimary.withValues(alpha: 0.8),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        pizzaSideLabelAr(side),
                        style: NmdTypography.micro.copyWith(
                          color: NmdColors.brandPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: NmdSpacing.xs),
          PizzaSideToggle(
            value: side,
            enabled: true,
            onChanged: onSide,
          ),
        ],
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({
    required this.label,
    required this.deltaLabel,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final String deltaLabel;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: NmdRadius.borderPill,
          child: AnimatedContainer(
            duration: NmdMotion.fast,
            curve: NmdMotion.standard,
            padding: const EdgeInsets.symmetric(
              horizontal: NmdSpacing.sm + 2,
              vertical: NmdSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: selected ? NmdColors.brandPrimary : NmdColors.surfaceBase,
              borderRadius: NmdRadius.borderPill,
              border: Border.all(
                color:
                    selected ? NmdColors.brandPrimary : NmdColors.borderSubtle,
                width: selected ? 1.5 : 1,
              ),
              boxShadow: selected ? NmdShadows.brandGlow(alpha: 0.15) : null,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: NmdTypography.label.copyWith(
                    color: selected
                        ? NmdColors.textOnBrand
                        : NmdColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  deltaLabel,
                  style: NmdTypography.micro.copyWith(
                    color: selected
                        ? NmdColors.textOnBrand.withValues(alpha: 0.9)
                        : NmdColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FadeInUpSection extends StatefulWidget {
  const _FadeInUpSection({
    required this.child,
    this.delayMs = 0,
  });

  final Widget child;
  final int delayMs;

  @override
  State<_FadeInUpSection> createState() => _FadeInUpSectionState();
}

class _FadeInUpSectionState extends State<_FadeInUpSection>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  );
  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOut,
  );
  late final Animation<Offset> _slide = Tween<Offset>(
    begin: const Offset(0, 0.08),
    end: Offset.zero,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(Duration(milliseconds: widget.delayMs), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: widget.child,
      ),
    );
  }
}

class _HeroCurvedBottomClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path()..lineTo(0, size.height - 20);
    final control = Offset(size.width * 0.5, size.height + 12);
    final end = Offset(size.width, size.height - 20);
    path.quadraticBezierTo(control.dx, control.dy, end.dx, end.dy);
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
