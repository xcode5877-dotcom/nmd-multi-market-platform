import 'dart:ui';

import 'package:dio/dio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/navigation/safe_back_navigation.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../api/api_base.dart';
import '../../../../api/models/product.dart';
import '../../../../api/storefront_api.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../design_system/design_system.dart';
import '../../../../design_system/premium/premium_marketplace_design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../cart/application/cart_cubit.dart';
import '../../../cart/presentation/widgets/global_cart_icon.dart';
import '../../application/service_lead_actions.dart';
import '../../domain/service_inquiry_message.dart';
import '../../data/pillar_kind.dart';
import '../../data/tenant_contact_info.dart';
import '../widgets/html_plain_text.dart';
import '../widgets/service_cinematic_experience.dart';
import '../widgets/product_quick_add.dart';
import '../widgets/marketplace_card_layout.dart';
import '../widgets/retail_product_card.dart';
import '../widgets/service_product_card.dart';
import '../../../../widgets/app_error_view.dart';

class StoreDetailPage extends StatefulWidget {
  const StoreDetailPage({
    super.key,
    required this.marketSlug,
    required this.storeId,
  });

  final String marketSlug;
  final String storeId;

  @override
  State<StoreDetailPage> createState() => _StoreDetailPageState();
}

class _StoreDetailPageState extends State<StoreDetailPage> {
  late Future<_StoreDetailPayload> _future;
  final ItemScrollController _itemScrollController = ItemScrollController();
  final ItemPositionsListener _itemPositionsListener =
      ItemPositionsListener.create();
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  final ScrollController _servicesScrollController = ScrollController();
  bool _searchOpen = false;
  int _activeCategoryIndex = 0;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = _load();
    _itemPositionsListener.itemPositions.addListener(_syncActiveTabFromScroll);
  }

  @override
  void dispose() {
    _itemPositionsListener.itemPositions
        .removeListener(_syncActiveTabFromScroll);
    _searchController.dispose();
    _searchFocus.dispose();
    _servicesScrollController.dispose();
    super.dispose();
  }

  void _openStoreSearch() {
    setState(() => _searchOpen = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _searchFocus.requestFocus();
    });
  }

  void _closeStoreSearch() {
    setState(() {
      _searchOpen = false;
      _searchController.clear();
      _query = '';
    });
    _searchFocus.unfocus();
  }

  void _syncActiveTabFromScroll() {
    final positions = _itemPositionsListener.itemPositions.value;
    if (positions.isEmpty) return;
    final visible = positions.where((p) => p.itemTrailingEdge > 0).toList()
      ..sort((a, b) => a.index.compareTo(b.index));
    if (visible.isEmpty) return;
    final next = visible.first.index;
    if (next != _activeCategoryIndex && mounted) {
      setState(() => _activeCategoryIndex = next);
    }
  }

  Future<_StoreDetailPayload> _load() async {
    final api = StorefrontApi(context.read<Dio>());
    final market = await api.getMarketBySlug(widget.marketSlug);
    final marketId = market['id']?.toString();
    if (marketId == null || marketId.isEmpty) throw Exception('Market missing');

    final tenant = await api.getTenantDetails(marketId, widget.storeId);
    final pillars = await api.getPillars();
    final pillarIdRaw = tenant['pillarId'] ?? tenant['pillar_id'];
    final isServicesStore =
        isServicesPillarForTenant(pillarIdRaw?.toString(), pillars);

    final brandingRaw = tenant['branding'];
    final branding = brandingRaw is Map
        ? Map<String, dynamic>.from(brandingRaw)
        : const <String, dynamic>{};
    final logoUrl = resolveImageUrl(branding['logoUrl']?.toString());
    final storeName = (tenant['name']?.toString() ?? 'متجر').trim();
    final bannerUrl = resolveImageUrl(
        tenant['bannerUrl']?.toString() ?? tenant['coverImage']?.toString());

    // Real price + optionGroups come from the typed API parsing.
    final categories = await api.getCatalogCategories(widget.storeId);
    final products = await api.getCatalogProducts(widget.storeId);
    if (mounted) {
      context.read<CartCubit>().repriceFromCatalog(widget.storeId, products);
      for (final p in products) {
        nmdDebugLog(
          'INFO catalog price ${p.name}: base=${p.basePrice} '
          'display=${p.displayPrice} customerList=${p.customerListPrice}',
        );
      }
    }
    final fallbackCategoriesById = <String, String>{};
    for (final p in products) {
      if (!fallbackCategoriesById.containsKey(p.categoryId))
        fallbackCategoriesById[p.categoryId] = p.categoryId;
    }

    final resolvedCategories = categories.isNotEmpty
        ? categories
        : fallbackCategoriesById.entries
            .map((e) => ProductCategory(id: e.key, title: e.value))
            .toList();

    final categoryIdSet = resolvedCategories.map((c) => c.id).toSet();

    final sections = <_CategorySection>[];
    for (final c in resolvedCategories) {
      final sectionProducts =
          products.where((p) => p.categoryId == c.id).toList();
      if (sectionProducts.isEmpty) continue;
      sections.add(_CategorySection(
          categoryId: c.id, title: c.title, products: sectionProducts));
    }

    final uncategorized =
        products.where((p) => !categoryIdSet.contains(p.categoryId)).toList();
    if (uncategorized.isNotEmpty) {
      sections.add(_CategorySection(
          categoryId: 'other', title: 'أخرى', products: uncategorized));
    }

    // Defensive: always have at least one section.
    final safeSections = sections.isNotEmpty
        ? sections
        : [
            if (products.isNotEmpty)
              _CategorySection(
                  categoryId: 'other', title: 'أخرى', products: products)
          ];

    final tenantIdForLeads = (tenant['id'] ?? widget.storeId).toString().trim();
    final contact = tenantContactFromTenantMap(tenant);
    final aboutPlain = stripHtmlToPlainText(tenant['about']?.toString() ?? '');

    final addrRaw = tenant['addressLine']?.toString().trim() ??
        tenant['address']?.toString().trim();
    final addressLine =
        (addrRaw != null && addrRaw.isNotEmpty) ? addrRaw : null;
    double? locLat;
    double? locLng;
    final loc = tenant['location'];
    if (loc is Map) {
      locLat = (loc['lat'] as num?)?.toDouble();
      locLng = (loc['lng'] as num?)?.toDouble();
    }

    String? pillarTag;
    final pillarIdStr = pillarIdRaw?.toString();
    if (pillarIdStr != null && pillarIdStr.isNotEmpty) {
      for (final p in pillars) {
        if (p.id == pillarIdStr) {
          pillarTag = p.titleAr.trim();
          break;
        }
      }
    }
    final openTimeRaw = tenant['openTime']?.toString().trim() ?? '';
    final closeTimeRaw = tenant['closeTime']?.toString().trim() ?? '';
    final openTime = openTimeRaw.isNotEmpty ? openTimeRaw : '08:00';
    final closeTime = closeTimeRaw.isNotEmpty ? closeTimeRaw : '17:00';
    final isAdminClosed =
        tenant['overrideStatus']?.toString() == 'FORCE_CLOSED';

    return _StoreDetailPayload(
      storeName: storeName,
      logoUrl: logoUrl,
      bannerUrl: bannerUrl,
      operatingStatus:
          (tenant['operationalStatus']?.toString() ?? 'closed').toLowerCase(),
      sections: safeSections,
      isServicesStore: isServicesStore,
      tenantIdForLeads: tenantIdForLeads,
      contact: contact,
      aboutPlain: aboutPlain,
      openTime: openTime,
      closeTime: closeTime,
      isAdminClosed: isAdminClosed,
      addressLine: addressLine,
      locationLat: locLat,
      locationLng: locLng,
      pillarTag: pillarTag,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
        textDirection: TextDirection.rtl,
        child: ColoredBox(
          color: NmdColors.surfaceBase,
          child: FutureBuilder<_StoreDetailPayload>(
            future: _future,
            builder: (context, snap) {
              if (snap.hasError) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _storeAppHeader(context, showCart: true),
                    Expanded(
                      child: AppErrorView.fromError(
                        error: snap.error!,
                        context: 'store_detail',
                        compact: true,
                        onRetry: () => setState(() => _future = _load()),
                      ),
                    ),
                  ],
                );
              }
              if (!snap.hasData) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _storeAppHeader(context, showCart: true),
                    const Expanded(
                      child: NmdLoading(message: 'جاري تحميل المتجر...'),
                    ),
                  ],
                );
              }
              final data = snap.data!;
              final sections = data.sections
                  .map(
                    (s) => _CategorySection(
                      categoryId: s.categoryId,
                      title: s.title,
                      products: s.products
                          .where((p) =>
                              _query.isEmpty ||
                              p.name.toLowerCase().contains(_query))
                          .toList(),
                    ),
                  )
                  .where((s) => s.products.isNotEmpty)
                  .toList();
              if (sections.isEmpty) {
                return Column(
                  children: [
                    _storeAppHeader(
                      context,
                      showCart: !data.isServicesStore,
                    ),
                    const Expanded(
                      child: NmdEmptyState(
                        title: 'لا توجد منتجات',
                        message: 'لا توجد منتجات في هذا المتجر حالياً.',
                        icon: Icons.inventory_2_outlined,
                      ),
                    ),
                  ],
                );
              }

              if (data.isServicesStore) {
                final serviceProducts =
                    sections.expand((s) => s.products).toList();
                return CinematicScrollChrome(
                  scrollController: _servicesScrollController,
                  title: data.storeName,
                  backgroundColor: NmdColors.surfaceBase,
                  leading: CinematicGlassIconButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onPressed: () => safeNmdBack(
                      context,
                      marketSlug: widget.marketSlug,
                    ),
                  ),
                  actions: [
                    CinematicGlassIconButton(
                      icon: Icons.person_outline_rounded,
                      onPressed: () async {
                        final ok = await ensureCustomerAuth(context);
                        if (!context.mounted || !ok) return;
                        context.go('/market/${widget.marketSlug}/account');
                      },
                    ),
                  ],
                  body: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      CustomScrollView(
                        controller: _servicesScrollController,
                        primary: false,
                        slivers: ImmersiveLuxuryStoreExperience.buildSlivers(
                          scrollController: _servicesScrollController,
                          storeName: data.storeName,
                          bannerUrl: data.bannerUrl,
                          logoUrl: data.logoUrl,
                          aboutPlain: data.aboutPlain,
                          pillarTag: data.pillarTag,
                          products: serviceProducts,
                          marketSlug: widget.marketSlug,
                          storeId: widget.storeId,
                          tenantIdForLeads: data.tenantIdForLeads,
                          officeContact: data.contact,
                        ),
                      ),
                    ],
                  ),
                );
              }

              return Column(
                children: [
                  _storeAppHeader(
                    context,
                    showCart: !data.isServicesStore,
                  ),
                  _ImmersiveStoreHero(
                    storeName: data.storeName,
                    logoUrl: data.logoUrl,
                    operatingStatus: data.operatingStatus,
                    isAdminClosed: data.isAdminClosed,
                    openTime: data.openTime,
                    closeTime: data.closeTime,
                    addressLine: data.addressLine,
                    pillarTag: data.pillarTag,
                    marketSlug: widget.marketSlug,
                    searchController: _searchController,
                    searchFocus: _searchFocus,
                    searchOpen: _searchOpen,
                    onSearchOpen: _openStoreSearch,
                    onSearchClose: _closeStoreSearch,
                    onQueryChanged: (v) =>
                        setState(() => _query = v.trim().toLowerCase()),
                    bannerUrl: data.bannerUrl,
                  ),
                  if (data.operatingStatus == 'closed' || data.isAdminClosed)
                    const _StoreClosedBanner(),
                  _CategoryTabs(
                    sections: sections,
                    activeIndex: _activeCategoryIndex,
                    onTabSelected: (index) {
                      setState(() => _activeCategoryIndex = index);
                      _itemScrollController.scrollTo(
                        index: index,
                        duration: const Duration(milliseconds: 320),
                        curve: Curves.easeOutCubic,
                      );
                    },
                  ),
                  Expanded(
                    child: ScrollablePositionedList.builder(
                      itemCount: sections.length,
                      itemScrollController: _itemScrollController,
                      itemPositionsListener: _itemPositionsListener,
                      padding: const EdgeInsets.fromLTRB(0, 8, 0, 24),
                      itemBuilder: (context, index) {
                        final section = sections[index];
                        return _CategorySectionWidget(
                          categoryId: section.categoryId,
                          title: section.title,
                          products: section.products,
                          storeId: widget.storeId,
                          marketSlug: widget.marketSlug,
                          storeClosed: data.operatingStatus == 'closed',
                          isServicesStore: data.isServicesStore,
                          tenantIdForLeads: data.tenantIdForLeads,
                          contact: data.contact,
                        );
                      },
                    ),
                  ),
                ],
              );
            },
          ),
        ));
  }

  Widget _storeAppHeader(BuildContext context, {required bool showCart}) {
    return NmdAppHeader(
      title: '',
      center: const SizedBox.shrink(),
      leading: NmdAppHeader.backLeading(
        onPressed: () => safeNmdBack(context, marketSlug: widget.marketSlug),
      ),
      actions: [
        NmdAppHeader.profileAction(
          onPressed: () async {
            final ok = await ensureCustomerAuth(context);
            if (!context.mounted || !ok) return;
            context.go('/market/${widget.marketSlug}/account');
          },
        ),
        if (showCart)
          GlobalCartIcon(
            marketSlug: widget.marketSlug,
            iconColor: NmdColors.textOnBrand,
            style: NmdAppHeader.plainIconStyle(),
          ),
      ],
    );
  }
}

class _StoreClosedBanner extends StatelessWidget {
  const _StoreClosedBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: NmdSpacing.md,
        vertical: NmdSpacing.sm,
      ),
      color: NmdColors.errorSoft,
      child: Text(
        'المحل مغلق حالياً — يمكنك تصفح المنتجات فقط',
        textAlign: TextAlign.center,
        style: NmdTypography.bodyBold.copyWith(
          color: NmdColors.error,
          fontSize: 14,
        ),
      ),
    );
  }
}

class _StoreDetailPayload {
  const _StoreDetailPayload({
    required this.storeName,
    required this.logoUrl,
    required this.bannerUrl,
    required this.operatingStatus,
    required this.sections,
    required this.isServicesStore,
    required this.tenantIdForLeads,
    required this.contact,
    required this.aboutPlain,
    required this.openTime,
    required this.closeTime,
    required this.isAdminClosed,
    this.addressLine,
    this.locationLat,
    this.locationLng,
    this.pillarTag,
  });

  final String storeName;
  final String logoUrl;
  final String bannerUrl;
  final String operatingStatus;
  final List<_CategorySection> sections;
  final bool isServicesStore;
  final String tenantIdForLeads;
  final TenantContactInfo contact;
  final String aboutPlain;
  final String openTime;
  final String closeTime;
  final bool isAdminClosed;
  final String? addressLine;
  final double? locationLat;
  final double? locationLng;
  final String? pillarTag;
}

class _CategorySection {
  const _CategorySection({
    required this.categoryId,
    required this.title,
    required this.products,
  });

  final String categoryId;
  final String title;
  final List<Product> products;
}

class _CategorySectionWidget extends StatelessWidget {
  const _CategorySectionWidget({
    required this.categoryId,
    required this.title,
    required this.products,
    required this.storeId,
    required this.marketSlug,
    required this.storeClosed,
    required this.isServicesStore,
    required this.tenantIdForLeads,
    required this.contact,
  });

  final String categoryId;
  final String title;
  final List<Product> products;
  final String storeId;
  final String marketSlug;
  final bool storeClosed;
  final bool isServicesStore;
  final String tenantIdForLeads;
  final TenantContactInfo contact;

  @override
  Widget build(BuildContext context) {
    final listHeight = isServicesStore
        ? ServiceProductCard.cardHeight
        : RetailProductCard.cardHeight;

    Widget productTile(int i) {
      final p = products[i];
      final heroTag = 'product-$storeId-${p.id}';
      final available = p.canAddToCart && !storeClosed;
      final desc = p.description.trim();
      void onTap() =>
          context.push('/market/$marketSlug/store/$storeId/product/${p.id}');
      void onAdd() => handleProductQuickAdd(
            context: context,
            product: p,
            tenantId: storeId,
            marketSlug: marketSlug,
            storeId: storeId,
            available: available,
          );
      if (isServicesStore) {
        return ServiceProductCard(
          width: MarketplaceCardLayout.stripCardWidth,
          name: p.name,
          price: p.customerListPrice,
          imageUrl: p.imageUrl,
          available: available,
          heroTag: heroTag,
          description: desc.isEmpty ? null : desc,
          onOpenDetail: () => context.push(
            '/market/$marketSlug/store/$storeId/product/${p.id}',
          ),
        );
      }
      return RetailProductCard(
        width: MarketplaceCardLayout.stripCardWidth,
        name: p.name,
        price: p.customerListPrice,
        imageUrl: p.imageUrl,
        available: available,
        heroTag: heroTag,
        description: desc.isEmpty ? null : desc,
        onTap: onTap,
        onAddTap: available ? onAdd : null,
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: NmdSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NmdSectionHeader(
            title: title,
            actionLabel: 'عرض الكل',
            onAction: () => context.push(
              '/market/$marketSlug/store/$storeId/category/$categoryId?title=${Uri.encodeComponent(title)}',
            ),
          ),
          const SizedBox(height: NmdSpacing.xxs),
          SizedBox(
            height: listHeight,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                primary: false,
                shrinkWrap: true,
                physics: MarketplaceStripScrollPhysics(
                  itemExtent: MarketplaceCardLayout.stripCardWidth,
                  separatorWidth: MarketplaceCardLayout.stripSeparator,
                  parent: const BouncingScrollPhysics(),
                ),
                padding: MarketplaceCardLayout.stripPadding,
                itemCount: products.length,
                separatorBuilder: (_, __) => const SizedBox(
                  width: MarketplaceCardLayout.stripSeparator,
                ),
                itemBuilder: (context, i) => productTile(i),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImmersiveStoreHero extends StatelessWidget {
  const _ImmersiveStoreHero({
    required this.storeName,
    required this.logoUrl,
    required this.operatingStatus,
    required this.isAdminClosed,
    required this.openTime,
    required this.closeTime,
    this.addressLine,
    this.pillarTag,
    required this.marketSlug,
    required this.searchController,
    required this.searchFocus,
    required this.searchOpen,
    required this.onSearchOpen,
    required this.onSearchClose,
    required this.onQueryChanged,
    required this.bannerUrl,
  });

  final String storeName;
  final String logoUrl;
  final String operatingStatus;
  final bool isAdminClosed;
  final String openTime;
  final String closeTime;
  final String? addressLine;
  final String? pillarTag;
  final String marketSlug;
  final TextEditingController searchController;
  final FocusNode searchFocus;
  final bool searchOpen;
  final VoidCallback onSearchOpen;
  final VoidCallback onSearchClose;
  final ValueChanged<String> onQueryChanged;
  final String bannerUrl;

  String get _statusLabel {
    if (isAdminClosed) return 'مغلق من الإدارة';
    return NmdSemantic.storeStatusLabelAr(
      NmdSemantic.storeStatusFromApi(operatingStatus),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Use [LayoutBuilder] so hero height never exceeds the Column's remaining
    // space (MediaQuery height alone can force overflow and yellow strips).
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenH = MediaQuery.sizeOf(context).height;
        var heroHeight = (screenH * 0.28).clamp(160.0, 320.0);
        if (constraints.maxHeight.isFinite) {
          heroHeight = heroHeight.clamp(120.0, constraints.maxHeight);
        }
        return SizedBox(
          height: heroHeight,
          width: double.infinity,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: bannerUrl.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: bannerUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, __) =>
                            _FallbackHero(fallbackText: storeName),
                        errorWidget: (_, __, ___) =>
                            _FallbackHero(fallbackText: storeName),
                      )
                    : _FallbackHero(fallbackText: storeName),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: PremiumMarketplaceDesignSystem.businessHeroOverlay,
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 112,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.white.withValues(alpha: 0),
                          Colors.white.withValues(alpha: 0.75),
                          Colors.white,
                        ],
                        stops: const [0.0, 0.55, 1.0],
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: AnimatedSlide(
                  duration: const Duration(milliseconds: 240),
                  curve: Curves.easeOutCubic,
                  offset: searchOpen ? Offset.zero : const Offset(0, -1.15),
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 200),
                    opacity: searchOpen ? 1 : 0,
                    child: IgnorePointer(
                      ignoring: !searchOpen,
                      child: Material(
                        color: Colors.transparent,
                        child: ClipRect(
                          child: BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.42),
                                border: const Border(
                                  bottom: BorderSide(
                                      color: Color(0x33FFFFFF), width: 0.5),
                                ),
                              ),
                              child: Row(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.close_rounded,
                                        color: Colors.white),
                                    onPressed: onSearchClose,
                                  ),
                                  Expanded(
                                    child: TextField(
                                      controller: searchController,
                                      focusNode: searchFocus,
                                      onChanged: onQueryChanged,
                                      style: NmdTypography.body.copyWith(
                                        color: NmdColors.textOnBrand,
                                      ),
                                      decoration: InputDecoration(
                                        hintText: 'ابحث داخل $storeName',
                                        hintStyle: NmdTypography.body.copyWith(
                                          color: NmdColors.textOnBrand
                                              .withValues(alpha: 0.75),
                                        ),
                                        border: InputBorder.none,
                                        isDense: true,
                                      ),
                                    ),
                                  ),
                                  const Icon(Icons.search,
                                      color: Colors.white70, size: 22),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: NmdSpacing.md,
                right: NmdSpacing.md,
                bottom: NmdSpacing.md,
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (logoUrl.isNotEmpty)
                        DecoratedBox(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: PremiumMarketplaceDesignSystem.cinematicCard(
                              accent: NmdColors.brandPrimary,
                            ),
                          ),
                          child: Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: NmdColors.surfaceBase,
                              border: Border.all(
                                color: NmdColors.surfaceBase,
                                width: 3,
                              ),
                            ),
                            child: ClipOval(
                              child: CachedNetworkImage(
                                imageUrl: logoUrl,
                                fit: BoxFit.cover,
                                errorWidget: (_, __, ___) => ColoredBox(
                                  color: NmdColors.tintAliveSoft,
                                  child: Icon(
                                    Icons.storefront_rounded,
                                    color: NmdColors.brandPrimary
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (logoUrl.isNotEmpty)
                        const SizedBox(width: NmdSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              storeName,
                              textAlign: TextAlign.right,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: NmdTypography.h1.copyWith(
                                color: NmdColors.textOnBrand,
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                shadows: const [
                                  Shadow(
                                    color: Color(0x99000000),
                                    blurRadius: 12,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _statusLabel,
                              style: NmdTypography.micro.copyWith(
                                color: NmdColors.textOnBrand.withValues(alpha: 0.7),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _FallbackHero extends StatelessWidget {
  const _FallbackHero({required this.fallbackText});

  final String fallbackText;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [NmdColors.brandDeep, NmdColors.brandPrimary],
        ),
      ),
      child: Align(
        alignment: Alignment.bottomRight,
        child: Padding(
          padding: const EdgeInsets.all(NmdSpacing.md),
          child: Text(
            fallbackText,
            textAlign: TextAlign.right,
            style: NmdTypography.h1.copyWith(color: NmdColors.textOnBrand),
          ),
        ),
      ),
    );
  }
}

class _CategoryTabs extends StatelessWidget {
  const _CategoryTabs({
    required this.sections,
    required this.activeIndex,
    required this.onTabSelected,
  });

  final List<_CategorySection> sections;
  final int activeIndex;
  final ValueChanged<int> onTabSelected;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: NmdColors.surfaceBase,
      child: SizedBox(
        height: 52,
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsetsDirectional.only(
              start: NmdSpacing.screenHorizontal,
              end: NmdSpacing.screenHorizontal,
              top: NmdSpacing.xs,
              bottom: NmdSpacing.xs,
            ),
            itemCount: sections.length,
            separatorBuilder: (_, __) => const SizedBox(width: NmdSpacing.xs),
            itemBuilder: (context, index) {
              final title = sections[index].title;
              final isActive = activeIndex == index;
              return NmdChip(
                label: title,
                selected: isActive,
                variant: NmdChipVariant.choice,
                leading: Icon(
                  _categoryIconForTitle(title),
                  size: 16,
                  color:
                      isActive ? NmdColors.textOnBrand : NmdColors.brandPrimary,
                ),
                onTap: () => onTabSelected(index),
              );
            },
          ),
        ),
      ),
    );
  }
}

IconData _categoryIconForTitle(String title) {
  final t = title.toLowerCase();
  if (t.contains('حلو') || t.contains('cake') || t.contains('dessert'))
    return Icons.cake_outlined;
  if (t.contains('قهوة') || t.contains('coffee')) return Icons.coffee_outlined;
  if (t.contains('مشروب')) return Icons.local_drink_outlined;
  if (t.contains('فطور')) return Icons.breakfast_dining_outlined;
  if (t.contains('بيتزا')) return Icons.local_pizza_outlined;
  return Icons.restaurant_menu_outlined;
}
