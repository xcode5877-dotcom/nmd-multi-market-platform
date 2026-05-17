import 'dart:ui';

import 'package:dio/dio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../api/models/product.dart';
import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../widgets/global_nmd_header.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../application/service_lead_actions.dart';
import '../../domain/service_inquiry_message.dart';
import '../../data/pillar_kind.dart';
import '../../data/tenant_contact_info.dart';
import '../widgets/available_slots_placeholder.dart';
import '../widgets/html_plain_text.dart';
import '../widgets/professional_service_list_card.dart';
import '../widgets/professional_store_info_section.dart';
import '../widgets/retail_product_card.dart';
import '../widgets/service_product_card.dart';

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
          color: Colors.white,
          child: FutureBuilder<_StoreDetailPayload>(
            future: _future,
            builder: (context, snap) {
              if (snap.hasError) {
                return Column(
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
                          child: Text(
                            snap.error.toString(),
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              }
              if (!snap.hasData) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    GlobalNmdHeader(
                      marketSlug: widget.marketSlug,
                      onLeadingPressed: () => context.pop(),
                    ),
                    const Expanded(
                      child: Center(
                          child: CircularProgressIndicator(
                              color: AppColors.primaryTeal)),
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
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      'لا توجد منتجات حالياً',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                );
              }

              void onProfessionalPrimaryContact() {
                final dio = context.read<Dio>();
                final auth = context.read<AuthBloc>().state;
                final customerPhone =
                    auth.step == AuthStep.done ? auth.phone : null;
                final office = data.contact;
                launchWhatsAppInquiry(
                  dio: dio,
                  tenantId: data.tenantIdForLeads,
                  contact: const TenantContactInfo(),
                  tenantContact: office,
                  messageOverride: storeServicesInquiryWhatsAppMessage(),
                  customerPhone: customerPhone,
                  context: context,
                );
              }

              if (data.isServicesStore) {
                final serviceProducts =
                    sections.expand((s) => s.products).toList();
                return Column(
                  children: [
                    GlobalNmdHeader(
                      marketSlug: widget.marketSlug,
                      onLeadingPressed: () => context.pop(),
                      showCart: false,
                    ),
                    Expanded(
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          CustomScrollView(
                            primary: true,
                            slivers: [
                              SliverToBoxAdapter(
                                child: _ImmersiveStoreHero(
                                  storeName: data.storeName,
                                  marketSlug: widget.marketSlug,
                                  searchController: _searchController,
                                  searchFocus: _searchFocus,
                                  searchOpen: _searchOpen,
                                  onSearchOpen: _openStoreSearch,
                                  onSearchClose: _closeStoreSearch,
                                  onQueryChanged: (v) => setState(
                                      () => _query = v.trim().toLowerCase()),
                                  bannerUrl: data.bannerUrl,
                                ),
                              ),
                              if (data.operatingStatus == 'closed')
                                SliverToBoxAdapter(
                                  child: Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 16, vertical: 10),
                                    color: const Color(0xFFFEE2E2),
                                    child: Text(
                                      'المحل مغلق حالياً، يمكنك تصفح المنتجات فقط',
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.cairo(
                                        color: const Color(0xFF991B1B),
                                        fontWeight: FontWeight.w800,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ),
                              SliverToBoxAdapter(
                                child: ProfessionalStoreInfoSection(
                                  aboutPlain: data.aboutPlain,
                                  openTime: data.openTime,
                                  closeTime: data.closeTime,
                                  operatingStatus: data.operatingStatus,
                                  isAdminClosed: data.isAdminClosed,
                                  showPrimaryContact:
                                      tenantHasDialableContact(data.contact),
                                  onPrimaryContact:
                                      onProfessionalPrimaryContact,
                                  subtitleTag: data.pillarTag,
                                ),
                              ),
                              SliverToBoxAdapter(
                                child: Padding(
                                  padding:
                                      const EdgeInsets.fromLTRB(20, 0, 20, 8),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'خدماتنا',
                                        textAlign: TextAlign.right,
                                        style: GoogleFonts.cairo(
                                          fontSize: 22,
                                          fontWeight: FontWeight.w900,
                                          color: const Color(0xFF111827),
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      Container(
                                          height: 1,
                                          color: const Color(0xFFE5E7EB)),
                                    ],
                                  ),
                                ),
                              ),
                              if (serviceProducts.isEmpty)
                                SliverToBoxAdapter(
                                  child: Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: Text(
                                      'لا توجد خدمات مطابقة',
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.cairo(
                                        fontSize: 15,
                                        color: const Color(0xFF64748B),
                                      ),
                                    ),
                                  ),
                                )
                              else
                                SliverPadding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 20),
                                  sliver: SliverList.separated(
                                    itemCount: serviceProducts.length,
                                    separatorBuilder: (_, __) =>
                                        const SizedBox(height: 16),
                                    itemBuilder: (context, i) =>
                                        ProfessionalServiceListCard(
                                      product: serviceProducts[i],
                                      marketSlug: widget.marketSlug,
                                      storeId: widget.storeId,
                                      tenantIdForLeads: data.tenantIdForLeads,
                                      officeContact: data.contact,
                                    ),
                                  ),
                                ),
                              const SliverToBoxAdapter(
                                  child: AvailableSlotsPlaceholder()),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }

              return Column(
                children: [
                  GlobalNmdHeader(
                    marketSlug: widget.marketSlug,
                    onLeadingPressed: () => context.pop(),
                    showCart: !data.isServicesStore,
                  ),
                  _ImmersiveStoreHero(
                    storeName: data.storeName,
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
                  if (data.operatingStatus == 'closed')
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      color: const Color(0xFFFEE2E2),
                      child: Text(
                        'المحل مغلق حالياً، يمكنك تصفح المنتجات فقط',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.cairo(
                          color: const Color(0xFF991B1B),
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                    ),
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
    final listHeight = isServicesStore ? 248.0 : 205.0;

    Widget productTile(int i) {
      final p = products[i];
      final heroTag = 'product-$storeId-${p.id}';
      final available = p.canAddToCart && !storeClosed;
      void onTap() =>
          context.push('/market/$marketSlug/store/$storeId/product/${p.id}');
      if (isServicesStore) {
        return ServiceProductCard(
          name: p.name,
          price: p.basePrice,
          imageUrl: p.imageUrl,
          available: available,
          heroTag: heroTag,
          onOpenDetail: () => context.push(
            '/market/$marketSlug/store/$storeId/product/${p.id}',
          ),
        );
      }
      return RetailProductCard(
        width: 122,
        name: p.name,
        price: p.basePrice,
        imageUrl: p.imageUrl,
        available: available,
        heroTag: heroTag,
        onTap: onTap,
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    title,
                    textAlign: TextAlign.right,
                    style: GoogleFonts.cairo(
                      color: const Color(0xFF111827),
                      fontWeight: FontWeight.w800,
                      fontSize: 22,
                    ),
                  ),
                ),
                InkWell(
                  borderRadius: BorderRadius.circular(999),
                  onTap: () => context.push(
                    '/market/$marketSlug/store/$storeId/category/$categoryId?title=${Uri.encodeComponent(title)}',
                  ),
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      textDirection: TextDirection.rtl,
                      children: [
                        const Icon(Icons.arrow_back_ios_new_rounded,
                            size: 16, color: AppColors.primaryTeal),
                        const SizedBox(width: 4),
                        Text(
                          'عرض الكل',
                          style: GoogleFonts.cairo(
                            color: AppColors.primaryTeal,
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: isServicesStore ? 10 : 12),
          SizedBox(
            height: listHeight,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                primary: false,
                shrinkWrap: true,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsetsDirectional.only(start: 16, end: 16),
                itemCount: products.length,
                separatorBuilder: (_, __) =>
                    SizedBox(width: isServicesStore ? 14 : 16),
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
  final String marketSlug;
  final TextEditingController searchController;
  final FocusNode searchFocus;
  final bool searchOpen;
  final VoidCallback onSearchOpen;
  final VoidCallback onSearchClose;
  final ValueChanged<String> onQueryChanged;
  final String bannerUrl;

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
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0x3D000000),
                        Color(0x0A000000),
                        Color(0xCC000000),
                      ],
                    ),
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
                                      style: GoogleFonts.cairo(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 15,
                                      ),
                                      decoration: InputDecoration(
                                        hintText: 'ابحث داخل $storeName',
                                        hintStyle: GoogleFonts.cairo(
                                          color: const Color(0xCCFFFFFF),
                                          fontWeight: FontWeight.w600,
                                          fontSize: 15,
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
                left: 16,
                right: 16,
                bottom: 16,
                child: Align(
                  alignment: Alignment.bottomRight,
                  child: Text(
                    storeName.toUpperCase(),
                    textAlign: TextAlign.right,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.cairo(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                      shadows: const [
                        Shadow(
                            color: Color(0xCC000000),
                            blurRadius: 16,
                            offset: Offset(0, 2)),
                        Shadow(
                            color: Color(0x88000000),
                            blurRadius: 6,
                            offset: Offset(0, 1)),
                      ],
                    ),
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
    return Container(
      color: Colors.white,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.network(
            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const ColoredBox(color: Colors.white),
          ),
          Container(color: const Color(0x22000000)),
          Align(
            alignment: Alignment.bottomRight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
              child: Text(
                fallbackText,
                textAlign: TextAlign.right,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
              ),
            ),
          ),
        ],
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
    return SizedBox(
      height: 96,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsetsDirectional.only(
              start: 16, end: 16, top: 8, bottom: 8),
          child: Row(
            children: [
              ...List.generate(sections.length, (index) {
                final title = sections[index].title;
                final isActive = activeIndex == index;
                return Padding(
                  padding: EdgeInsetsDirectional.only(
                      start: index == sections.length - 1 ? 0 : 10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => onTabSelected(index),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      width: 82,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        color:
                            isActive ? const Color(0xFFE6FFFB) : Colors.white,
                        border: Border.all(
                          color: isActive
                              ? const Color(0xFF14B8A6)
                              : const Color(0x1F0F172A),
                        ),
                        boxShadow: [
                          if (isActive)
                            const BoxShadow(
                              color: Color(0x5514B8A6),
                              blurRadius: 18,
                              spreadRadius: 2,
                              offset: Offset(0, 3),
                            )
                          else
                            const BoxShadow(
                              color: Color(0x0F000000),
                              blurRadius: 8,
                              offset: Offset(0, 2),
                            ),
                        ],
                      ),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final iconWrapSize =
                              (constraints.maxHeight * 0.40).clamp(24.0, 30.0);
                          final iconSize =
                              (constraints.maxHeight * 0.22).clamp(15.0, 18.0);
                          final titleSize =
                              (constraints.maxHeight * 0.14).clamp(9.0, 10.5);
                          return Column(
                            mainAxisSize: MainAxisSize.max,
                            children: [
                              Container(
                                width: iconWrapSize,
                                height: iconWrapSize,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white,
                                  boxShadow: [
                                    BoxShadow(
                                      color: isActive
                                          ? const Color(0x6614B8A6)
                                          : const Color(0x22000000),
                                      blurRadius: 10,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  _categoryIconForTitle(title),
                                  size: iconSize,
                                  color: isActive
                                      ? AppColors.primaryTeal
                                      : const Color(0xFF475569),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Expanded(
                                child: Center(
                                  child: Text(
                                    title,
                                    textAlign: TextAlign.center,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    textScaler: const TextScaler.linear(1),
                                    style: GoogleFonts.cairo(
                                      fontSize: titleSize,
                                      fontWeight: FontWeight.w700,
                                      color: isActive
                                          ? AppColors.primaryTeal
                                          : const Color(0xFF0F172A),
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
                );
              }),
              const SizedBox(width: 16),
            ],
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
