import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../api/models/pizza_placement.dart';
import '../../../../api/models/product.dart';
import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../features/cart/application/cart_cubit.dart';
import '../../../../features/cart/domain/cart_selected_option.dart';
import '../../../../widgets/global_nmd_header.dart';
import '../../data/pillar_kind.dart';
import '../../data/tenant_contact_info.dart';
import '../widgets/pizza_side_toggle.dart';

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

  double _computeUnitPrice(Product product) {
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
                              color: AppColors.primaryTeal,
                              alignment: Alignment.center,
                              child: const Icon(Icons.add, color: Colors.white),
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
              backgroundColor: Colors.white,
              body: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GlobalNmdHeader(
                    marketSlug: widget.marketSlug,
                    onLeadingPressed: () => context.pop(),
                  ),
                  Expanded(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.store_outlined,
                                size: 50, color: AppColors.primaryTeal),
                            const SizedBox(height: 12),
                            Text(
                              'تعذر تحميل المنتج',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 10),
                            OutlinedButton(
                              onPressed: () =>
                                  setState(() => _future = _load()),
                              child: const Text('إعادة المحاولة'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          if (!snap.hasData) {
            return Scaffold(
              backgroundColor: Colors.white,
              body: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GlobalNmdHeader(
                    marketSlug: widget.marketSlug,
                    onLeadingPressed: () => context.pop(),
                  ),
                  const Expanded(
                    child: Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primaryTeal),
                    ),
                  ),
                ],
              ),
            );
          }

          final payload = snap.data!;
          final product = payload.product;
          final storeClosed = payload.storeStatus == 'closed';
          final isServices = payload.isServicesStore;
          final computedUnitPrice = _computeUnitPrice(product);
          final heroTag = 'product-${widget.storeId}-${product.id}';

          final desc = product.description.trim();
          final shouldReadMore = desc.length > 220;
          final shownDesc = !_descExpanded && shouldReadMore
              ? '${desc.substring(0, 220)}...'
              : desc;

          final bottomPadding = MediaQuery.of(context).padding.bottom;

          return Scaffold(
            backgroundColor: Colors.white,
            body: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                GlobalNmdHeader(
                  marketSlug: widget.marketSlug,
                  cartIconKey: isServices ? null : _cartIconKey,
                  onLeadingPressed: () => context.pop(),
                  showCart: !isServices,
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
                                          ? const ColoredBox(
                                              color: Colors.white)
                                          : CachedNetworkImage(
                                              imageUrl: product.imageUrl,
                                              fit: BoxFit.cover,
                                              placeholder: (_, __) =>
                                                  const ColoredBox(
                                                      color: Colors.white),
                                              errorWidget: (_, __, ___) =>
                                                  const ColoredBox(
                                                      color: Colors.white),
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
                          padding: const EdgeInsets.fromLTRB(16, 22, 16, 16),
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
                                      style: GoogleFonts.cairo(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 20,
                                        color: const Color(0xFF0A0A0A),
                                        height: 1.25,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    '₪${product.basePrice.toStringAsFixed(2)}',
                                    style: GoogleFonts.cairo(
                                      color: AppColors.primaryTeal,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 18,
                                    ),
                                  ),
                                ],
                              ),
                              if (storeClosed || !product.canAddToCart) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE5E7EB),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    storeClosed
                                        ? 'المحل مغلق حالياً'
                                        : 'غير متوفر حالياً',
                                    style: GoogleFonts.cairo(
                                      color: const Color(0xFF374151),
                                      fontWeight: FontWeight.w700,
                                      fontSize: 11,
                                    ),
                                  ),
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
                                        style: GoogleFonts.cairo(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w400,
                                          color: const Color(0xFF4B5563),
                                          height: 1.55,
                                        ),
                                      ),
                                      if (shouldReadMore) ...[
                                        const SizedBox(height: 8),
                                        GestureDetector(
                                          onTap: () => setState(() =>
                                              _descExpanded = !_descExpanded),
                                          child: Text(
                                            _descExpanded
                                                ? 'Read Less'
                                                : 'Read More',
                                            style: TextStyle(
                                              color: AppColors.primaryTeal,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 8),
                                      Divider(
                                        height: 1,
                                        thickness: 0.8,
                                        color: const Color(0xFFE5E7EB)
                                            .withValues(alpha: 0.9),
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
                    padding: EdgeInsets.fromLTRB(20, 0, 20, bottomPadding + 24),
                    child: AnimatedBuilder(
                      animation: _dockScale,
                      builder: (context, child) => Transform.scale(
                        scale: _dockScale.value,
                        child: child,
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                          child: Container(
                            height: 66,
                            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                            decoration: BoxDecoration(
                              color: const Color(0x26D5FAF5),
                              border:
                                  Border.all(color: Colors.white24, width: 0.5),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x26000000),
                                  blurRadius: 16,
                                  offset: Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  width: 54,
                                  height: 54,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xDD0F172A),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                        color: const Color(0x335EEAD4)),
                                  ),
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      '${computedUnitPrice.toStringAsFixed(2)}₪',
                                      style: GoogleFonts.cairo(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 11.5,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                _GlassAddToCartFabButton(
                                  disabled:
                                      storeClosed || !product.canAddToCart,
                                  onPressed: () => _handleAddToCart(
                                    product: product,
                                    computedUnitPrice: computedUnitPrice,
                                    storeClosed: storeClosed,
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
    final gradient = disabled
        ? const LinearGradient(
            colors: [Color(0xFF9CA3AF), Color(0xFF6B7280)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          )
        : const LinearGradient(
            colors: [Color(0xFF14B8A6), Color(0xFF0F766E)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          );

    return Opacity(
      opacity: disabled ? 0.78 : 1,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [
            BoxShadow(
              color: Color(0x5514B8A6),
              spreadRadius: 0,
              blurRadius: 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: disabled ? null : onPressed,
            borderRadius: BorderRadius.circular(999),
            child: Ink(
              decoration: BoxDecoration(
                gradient: gradient,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.shopping_cart_outlined,
                        size: 16, color: Colors.white),
                    const SizedBox(width: 6),
                    _ShimmerText(
                      text: 'أضف للسلة',
                      style: GoogleFonts.cairo(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
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
  }
}

class _ShimmerText extends StatefulWidget {
  const _ShimmerText({
    required this.text,
    required this.style,
  });

  final String text;
  final TextStyle style;

  @override
  State<_ShimmerText> createState() => _ShimmerTextState();
}

class _ShimmerTextState extends State<_ShimmerText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        return ShaderMask(
          shaderCallback: (rect) {
            return LinearGradient(
              begin: Alignment(-1 + (2 * t), 0),
              end: Alignment(1 + (2 * t), 0),
              colors: const [
                Color(0xCCFFFFFF),
                Colors.white,
                Color(0xCCFFFFFF),
              ],
              stops: const [0.2, 0.5, 0.8],
            ).createShader(rect);
          },
          blendMode: BlendMode.srcATop,
          child: Text(widget.text, style: widget.style),
        );
      },
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          group.name,
          style: GoogleFonts.cairo(
            fontWeight: FontWeight.w700,
            color: const Color(0xFF0F766E),
            fontSize: 15,
            letterSpacing: 0.35,
          ),
        ),
        const SizedBox(height: 12),
        if (hasHalf) ...[
          for (final item in items) ...[
            if (productOptionSupportsHalf(item, group))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _PizzaHalfModifierRow(
                  item: item,
                  formatDelta: formatDelta,
                  selected: selectedItemIds.contains(item.id),
                  side: (placements[item.id] ?? PizzaPlacement.defaultPlacement)
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
                final chipColor =
                    selected ? AppColors.primaryTeal : Colors.white;
                final textColor =
                    selected ? Colors.white : const Color(0xFF111827);
                return InkWell(
                  onTap: () => onSelectionChanged({item.id}),
                  borderRadius: BorderRadius.circular(999),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: chipColor,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: selected
                            ? AppColors.primaryTeal
                            : const Color(0xFFD1D5DB),
                        width: selected ? 1.5 : 1,
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          style: GoogleFonts.cairo(
                            color: textColor,
                            fontWeight: FontWeight.w500,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          formatDelta(item.priceDelta),
                          style: GoogleFonts.cairo(
                            color: selected
                                ? Colors.white.withValues(alpha: 0.95)
                                : const Color(0xFF6B7280),
                            fontWeight: FontWeight.w500,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          )
        else ...[
          Builder(
            builder: (context) {
              final freeItems = items.where((i) => i.priceDelta == 0).toList();
              final paidItems = items.where((i) => i.priceDelta != 0).toList();
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x3311766E)),
      ),
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
                style: GoogleFonts.cairo(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFFB91C1C),
                ),
              ),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${item.name}$priceStr',
                  textAlign: TextAlign.right,
                  style: GoogleFonts.cairo(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: const Color(0xFF0A0A0A),
                  ),
                ),
                if (selected && side != PizzaPlacement.whole) ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.circle,
                          size: 6,
                          color: AppColors.primaryTeal.withValues(alpha: 0.8)),
                      const SizedBox(width: 4),
                      Text(
                        pizzaSideLabelAr(side),
                        style: GoogleFonts.cairo(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryTeal,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
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
    final bg = selected ? AppColors.primaryTeal : Colors.white;
    final border = selected ? AppColors.primaryTeal : const Color(0xFFD1D5DB);
    final text = selected ? Colors.white : const Color(0xFF111827);
    final delta = selected
        ? Colors.white.withValues(alpha: 0.95)
        : const Color(0xFF6B7280);

    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: border, width: selected ? 1.5 : 1),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w500,
                  fontSize: 13,
                  color: text,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                deltaLabel,
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w500,
                  fontSize: 12,
                  color: delta,
                ),
              ),
            ],
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
