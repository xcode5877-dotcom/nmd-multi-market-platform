import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/navigation/safe_back_navigation.dart';

import '../../../../api/models/product.dart';
import '../../../../api/storefront_api.dart';
import '../../../../design_system/design_system.dart';
import '../../../../measurement/measurement.dart';
import '../widgets/quantity_selector.dart';
import '../../../../features/cart/application/cart_cubit.dart';
import '../../../cart/presentation/widgets/global_cart_icon.dart';
import '../../data/modifier_icon_library.dart';
import '../../data/pillar_kind.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../application/service_lead_actions.dart';
import '../../data/tenant_contact_info.dart';
import '../widgets/service_cinematic_experience.dart';
import '../customization/product_customization_tier.dart';
import '../customization/customization_step_plan.dart';
import '../customization/customization_tokens.dart';
import '../customization/product_customization_controller.dart';
import '../widgets/floating_smart_cta.dart';
import '../widgets/product_customization_surface.dart';
import '../widgets/product_images/product_image_gallery.dart';
import '../widgets/product_images/product_image_urls.dart';
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

  ProductCustomizationController? _customization;
  String? _customizationProductId;

  final ScrollController _scrollController = ScrollController();
  final GlobalKey _cartIconKey = GlobalKey();
  final GlobalKey _imageKey = GlobalKey();
  final GlobalKey _customizationSectionKey = GlobalKey();

  bool _descExpanded = false;
  String? _addQty;
  String? _addQtyProductId;
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

  List<String> _resolveGalleryUrls(Product product, Map<String, dynamic>? raw) {
    final fromRaw =
        raw != null ? extractProductImageUrls(raw) : const <String>[];
    if (fromRaw.isNotEmpty) return fromRaw;
    if (product.imageUrl.trim().isNotEmpty) return [product.imageUrl];
    return const [];
  }

  @override
  void dispose() {
    _customization?.removeListener(_onCustomizationChanged);
    _customization?.dispose();
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
    await ModifierIconLibrary.instance.ensureLoaded(api, widget.marketSlug);
    final products = await api.getCatalogProducts(widget.storeId);
    final product = products.where((p) => p.id == widget.productId).toList();
    if (product.isEmpty) throw Exception('Product not found');
    Map<String, dynamic>? rawProduct;
    try {
      final catalog = await api.getCatalog(widget.storeId);
      final rows =
          (catalog['products'] as List<dynamic>? ?? const <dynamic>[])
              .whereType<Map>();
      for (final row in rows) {
        if ((row['id']?.toString() ?? '') == widget.productId) {
          rawProduct = Map<String, dynamic>.from(row);
          break;
        }
      }
    } catch (_) {
      rawProduct = null;
    }
    final galleryUrls = _resolveGalleryUrls(product.first, rawProduct);
    return _ProductPagePayload(
      product: product.first,
      imageUrls: galleryUrls,
      heroImageIndex: productHeroImageIndex(galleryUrls, product.first.imageUrl),
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
    final customization = _customization;
    final qty = _addQty ?? product.minimumQuantity;
    final weighted = product.measurement.isWeighted;
    final unit = weighted ? product.customerListPrice : computedUnitPrice;
    final merchantUnit = weighted ? product.basePrice : merchantUnitPrice;
    final fixedMods = weighted
        ? (computedUnitPrice - product.customerListPrice)
        : 0.0;
    cart.addOrIncrement(
      tenantId: widget.storeId,
      productId: product.id,
      name: product.name,
      unitPrice: unit,
      merchantUnitPrice: merchantUnit,
      imageUrl: product.imageUrl,
      addQty: qty,
      measurement: product.measurement,
      fixedModifierTotal: fixedMods < 0 ? 0 : fixedMods,
      selectedOptions:
          customization?.buildCartSelectedOptions() ?? const [],
      optionGroupsJson: optionGroupsToOrderJson(product.optionGroups),
    );
  }


  void _ensureAddQty(Product product) {
    if (_addQtyProductId == product.id && _addQty != null) return;
    _addQtyProductId = product.id;
    _addQty = product.minimumQuantity;
  }

  double _previewLineTotal(Product product, ProductCustomizationController c) {
    final qty = _addQty ?? product.minimumQuantity;
    if (product.measurement.isWeighted) {
      final base = calculateLineSubtotal(product.customerListPrice, qty);
      final modDelta = c.customerUnitPrice - product.customerListPrice;
      if (modDelta == 0) return base;
      return agoraToShekels(
        (shekelsToAgora(base) ?? 0) + (shekelsToAgora(modDelta) ?? 0),
      );
    }
    return calculateLineSubtotal(c.customerUnitPrice, qty);
  }

  void _ensureCustomization(Product product) {
    if (_customizationProductId == product.id && _customization != null) {
      return;
    }
    _customization?.removeListener(_onCustomizationChanged);
    _customization?.dispose();
    _customization = ProductCustomizationController(product);
    _customizationProductId = product.id;
    _customization!.addListener(_onCustomizationChanged);
  }

  void _onCustomizationChanged() {
    _dockBounceController.forward(from: 0);
  }

  void _scrollToCustomization() {
    final ctx = _customizationSectionKey.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      alignment: 0.12,
    );
  }

  void _openAdvancedBuilder({
    required Product product,
    required bool storeClosed,
  }) {
    final customization = _customization;
    if (customization == null) return;
    openAdvancedCustomizationSheet(
      context,
      product: product,
      controller: customization,
      storeClosed: storeClosed,
      onAddToCart: () => _handleAddToCart(
        product: product,
        computedUnitPrice: customization.customerUnitPrice,
        merchantUnitPrice: customization.merchantUnitPrice,
        storeClosed: storeClosed,
      ),
    );
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
          _ensureCustomization(product);
          _ensureAddQty(product);
          final customization = _customization!;
          final tier = effectiveCustomizationTier(product);
          logCustomizationPlan(
            product,
            tier.name,
            planCustomizationSteps(product),
          );

          final heroTag = productDetailsHeroTag(widget.storeId, product.id);
          final galleryUrls = payload.imageUrls;
          final heroIndex = payload.heroImageIndex;

          final desc = product.description.trim();
          final shouldReadMore = desc.length > 220;
          final shownDesc = !_descExpanded && shouldReadMore
              ? '${desc.substring(0, 220)}...'
              : desc;

          return Scaffold(
            backgroundColor: NmdColors.surfaceBase,
            body: Stack(
              fit: StackFit.expand,
              children: [
                if (isServices)
                  CinematicScrollChrome(
                    scrollController: _scrollController,
                    title: product.name,
                    backgroundColor: NmdColors.surfaceBase,
                    leading: CinematicGlassIconButton(
                      icon: Icons.arrow_back_ios_new_rounded,
                      onPressed: () => safeNmdBack(
                        context,
                        marketSlug: widget.marketSlug,
                      ),
                    ),
                    body: _buildProductScrollView(
                      product: product,
                      heroTag: heroTag,
                      imageUrls: galleryUrls,
                      heroImageIndex: heroIndex,
                      isServices: isServices,
                      storeClosed: storeClosed,
                      customization: customization,
                      tier: tier,
                      desc: desc,
                      shownDesc: shownDesc,
                      shouldReadMore: shouldReadMore,
                    ),
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _productHeader(
                        context,
                        showCart: true,
                        cartIconKey: _cartIconKey,
                      ),
                      Expanded(
                        child: _buildProductScrollView(
                          product: product,
                          heroTag: heroTag,
                          imageUrls: galleryUrls,
                          heroImageIndex: heroIndex,
                          isServices: isServices,
                          storeClosed: storeClosed,
                          customization: customization,
                          tier: tier,
                          desc: desc,
                          shownDesc: shownDesc,
                          shouldReadMore: shouldReadMore,
                        ),
                      ),
                    ],
                  ),
                if (!isServices)
                  ListenableBuilder(
                    listenable: customization,
                    builder: (context, _) {
                      final missingRequired =
                          customization.missingRequired.isNotEmpty;
                      return AnimatedBuilder(
                        animation: _dockScale,
                        builder: (context, child) => FloatingSmartCta(
                          price: _previewLineTotal(product, customization),
                          missingRequired: missingRequired,
                          disabled: storeClosed || !product.canAddToCart,
                          scale: _dockScale.value,
                          onPressed: () {
                            if (missingRequired) {
                              _scrollToCustomization();
                              return;
                            }
                            _handleAddToCart(
                              product: product,
                              computedUnitPrice:
                                  customization.customerUnitPrice,
                              merchantUnitPrice:
                                  customization.merchantUnitPrice,
                              storeClosed: storeClosed,
                            );
                          },
                        ),
                      );
                    },
                  )
                else
                  CinematicServiceDock(
                    onPressed: () async {
                      final dio = context.read<Dio>();
                      final auth = context.read<AuthBloc>().state;
                      await launchWhatsAppInquiry(
                        dio: dio,
                        tenantId: payload.tenantIdForLeads,
                        contact: payload.contact,
                        tenantContact: payload.officeContact,
                        serviceName: product.name,
                        customerPhone:
                            auth.step == AuthStep.done ? auth.phone : null,
                        context: context,
                      );
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildProductScrollView({
    required Product product,
    required String heroTag,
    required List<String> imageUrls,
    required int heroImageIndex,
    required bool isServices,
    required bool storeClosed,
    required ProductCustomizationController customization,
    required ProductCustomizationTier tier,
    required String desc,
    required String shownDesc,
    required bool shouldReadMore,
  }) {
    return CustomScrollView(
      controller: _scrollController,
      primary: false,
      slivers: [
        SliverToBoxAdapter(
          child: isServices
              ? ProductImageGallery(
                  imageUrls: imageUrls,
                  heroTag: heroTag,
                  initialIndex: heroImageIndex,
                  height: productImageGalleryHeight(
                    context,
                    isServices: isServices,
                  ),
                  imageKey: _imageKey,
                  isServices: isServices,
                )
              : ClipPath(
                  clipper: ProductImageCurvedClipper(),
                  child: ProductImageGallery(
                    imageUrls: imageUrls,
                    heroTag: heroTag,
                    initialIndex: heroImageIndex,
                    height: productImageGalleryHeight(
                      context,
                      isServices: isServices,
                    ),
                    imageKey: _imageKey,
                    isServices: isServices,
                  ),
                ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              CustomizationTokens.md,
              isServices ? 28 : CustomizationTokens.md,
              CustomizationTokens.md,
              CustomizationTokens.sm,
            ),
            child: ListenableBuilder(
              listenable: customization,
              builder: (context, _) {
                final computedUnitPrice = customization.customerUnitPrice;
                return Column(
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
                            style: NmdTypography.display.copyWith(
                              fontSize: isServices ? 24 : 20,
                              height: 1.12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: isServices ? -0.4 : 0,
                            ),
                          ),
                        ),
                        if (!isServices) ...[
                          const SizedBox(width: CustomizationTokens.sm),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                () {
                                  final u = priceUnitSuffixAr(
                                      product.measurementType);
                                  final money =
                                      NmdFormat.money(computedUnitPrice);
                                  return u == null ? money : '$money / $u';
                                }(),
                                style: NmdTypography.price.copyWith(
                                  fontSize: 18,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                    if (!isServices &&
                        (storeClosed || !product.canAddToCart)) ...[
                      const SizedBox(height: CustomizationTokens.xs),
                      NmdBadge(
                        label: storeClosed
                            ? 'المحل مغلق حالياً'
                            : 'غير متوفر حالياً',
                        tone: NmdBadgeTone.neutral,
                      ),
                    ],
                    if (!isServices) ...[
                      const SizedBox(height: CustomizationTokens.sm),
                      Text(
                        product.measurement.isWeighted
                            ? 'اختر الكمية'
                            : 'الكمية',
                        textAlign: TextAlign.right,
                        style: NmdTypography.label.copyWith(
                          color: NmdColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: CustomizationTokens.xs),
                      QuantitySelector(
                        measurement: product.measurement,
                        value: _addQty ?? product.minimumQuantity,
                        onChanged: (q) => setState(() => _addQty = q),
                      ),
                      const SizedBox(height: CustomizationTokens.xs),
                      Text(
                        'المجموع: ${NmdFormat.money(_previewLineTotal(product, customization))}',
                        textAlign: TextAlign.right,
                        style: NmdTypography.bodySmall.copyWith(
                          color: NmdColors.textSecondary,
                        ),
                      ),
                    ],
                    if (desc.isNotEmpty) ...[
                      _FadeInUpSection(
                        delayMs: 50,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: CustomizationTokens.sm),
                            Text(
                              shownDesc,
                              style: NmdTypography.bodySmall.copyWith(
                                height: 1.6,
                                color: isServices
                                    ? NmdColors.textSecondary
                                    : null,
                              ),
                            ),
                            if (shouldReadMore) ...[
                              const SizedBox(
                                  height: CustomizationTokens.xs),
                              GestureDetector(
                                onTap: () => setState(
                                    () => _descExpanded = !_descExpanded),
                                child: Text(
                                  _descExpanded ? 'عرض أقل' : 'عرض المزيد',
                                  style: NmdTypography.label.copyWith(
                                    color: NmdColors.brandPrimary,
                                  ),
                                ),
                              ),
                            ],
                            if (!isServices) ...[
                              const SizedBox(height: CustomizationTokens.sm),
                              const Divider(
                                height: 1,
                                color: NmdColors.divider,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: CustomizationTokens.sm),
                    if (!isServices)
                      _FadeInUpSection(
                        delayMs: 80,
                        child: KeyedSubtree(
                          key: _customizationSectionKey,
                          child: ProductCustomizationSurface(
                            product: product,
                            controller: customization,
                            tier: tier,
                            storeClosed: storeClosed,
                            onOpenAdvancedBuilder: () => _openAdvancedBuilder(
                              product: product,
                              storeClosed: storeClosed,
                            ),
                            onAddToCart: () => _handleAddToCart(
                              product: product,
                              computedUnitPrice:
                                  customization.customerUnitPrice,
                              merchantUnitPrice:
                                  customization.merchantUnitPrice,
                              storeClosed: storeClosed,
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ),
        SliverPadding(
          padding: EdgeInsets.only(
            bottom: isServices
                ? PremiumMarketplaceDesignSystem.heroBookPillHeight + 28
                : productCtaScrollInset(context),
          ),
        ),
      ],
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
      leading: NmdAppHeader.backLeading(
        onPressed: () => safeNmdBack(context, marketSlug: widget.marketSlug),
      ),
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
    required this.imageUrls,
    required this.heroImageIndex,
    required this.storeStatus,
    required this.isServicesStore,
    required this.tenantIdForLeads,
    required this.contact,
    required this.officeContact,
  });

  final Product product;
  final List<String> imageUrls;
  final int heroImageIndex;
  final String storeStatus;
  final bool isServicesStore;
  final String tenantIdForLeads;

  /// Product-level override (future); empty until API exposes per-service phones.
  final TenantContactInfo contact;
  final TenantContactInfo officeContact;
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
