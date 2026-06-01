import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../api/storefront_api.dart';
import '../../../../core/auth/auth_failure.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../core/network/guest_browsing_request.dart';
import '../../../../core/debug/nmd_post_login_trace.dart';
import '../../../../design_system/design_system.dart';
import '../../../cart/presentation/widgets/global_cart_icon.dart';
import '../../../contest/presentation/widgets/contest_popup_sheet.dart';
import '../../application/home_cubit.dart';
import '../../data/pillar_nav_item.dart';
import '../widgets/home_store_card.dart';
import '../widgets/home_layout_shimmer.dart';
import '../../../../core/errors/app_error_mapper.dart';
import '../../../../widgets/app_error_view.dart';
import '../widgets/marketplace_card_layout.dart';
import '../../../../widgets/nmd_search_bar.dart';
import '../../../home/domain/feed/feed_campaign.dart';
import '../../../home/domain/feed/home_feed_block.dart';
import '../../../home/domain/feed/home_feed_composer.dart';
import '../../../home/domain/feed/home_feed_sections_resolver.dart';
import '../../../home/presentation/feed/home_feed_sliver_builder.dart';
import '../../../home/presentation/feed/home_feed_store_view.dart';

/// Matches route `?pillar=` to pillar chip id from GET `/pillars` (trimmed string equality).
bool _pillarQueryMatchesChip(String? queryPillar, String itemId) =>
    (queryPillar ?? '').trim() == itemId.trim();

/// UI safety net: only rows whose `pillarId` / `subCategoryId` match the active route (strict — no null IDs).
List<Map<String, dynamic>> _strictTenantMapsForRoute(
  List<Map<String, dynamic>> rows,
  String? pillarQ,
  String? subQ,
) {
  var out = rows;
  final p = pillarQ?.trim();
  if (p != null && p.isNotEmpty) {
    out = out.where((t) {
      final pid = t['pillarId'] ?? t['pillar_id'];
      if (pid == null) return false;
      return pid.toString().trim() == p;
    }).toList();
  }
  final s = subQ?.trim();
  if (s != null && s.isNotEmpty) {
    out = out.where((t) {
      final sid = t['subCategoryId'] ?? t['sub_category_id'];
      if (sid == null) return false;
      return sid.toString().trim() == s;
    }).toList();
  }
  return out;
}

_StoreItem _storeItemFromTenantMap(Map<String, dynamic> t) {
  final brandingRaw = t['branding'];
  final Map<String, dynamic> branding = brandingRaw is Map
      ? Map<String, dynamic>.from(brandingRaw)
      : const <String, dynamic>{};
  return _StoreItem(
    id: t['id']?.toString() ?? '',
    slug: t['slug']?.toString() ?? '',
    name: t['name']?.toString() ?? '',
    category: (t['categoryName']?.toString() ??
            t['marketCategory']?.toString() ??
            'تصنيف عام')
        .trim(),
    logoUrl: resolveImageUrl(branding['logoUrl']?.toString()),
    openStatus: (t['operationalStatus']?.toString() ?? 'closed').trim(),
    pillarId: (t['pillarId']?.toString() ?? '').trim(),
  );
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.slug});

  /// Route param from web: `/:slug` (e.g. `dabburiyya`, `iksal`).
  final String slug;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();
  late Future<_HomeLayoutPayload> _layoutFuture;
  String _query = '';
  bool _contestPopupAttempted = false;

  /// Last slug we synced tenants for (reset when market changes).
  String? _tenantSyncSlug;

  /// Token `${slug}|pillar|sub` — includes sub-category filter.
  String? _tenantSyncToken;
  bool _homeRenderedLogged = false;

  @override
  void initState() {
    super.initState();
    _layoutFuture = _fetchLayout();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _scheduleTenantSyncFromRoute(BuildContext context) {
    if (_tenantSyncSlug != widget.slug) {
      _tenantSyncSlug = widget.slug;
      _tenantSyncToken = null;
    }
    final pillar = GoRouterState.of(context).uri.queryParameters['pillar'];
    final sub = GoRouterState.of(context).uri.queryParameters['sub'];
    final token = '${widget.slug}|${pillar ?? ''}|${sub ?? ''}';
    if (_tenantSyncToken == token) return;
    _tenantSyncToken = token;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<HomeCubit>().syncTenantsForMarket(
            widget.slug,
            pillarId: pillar?.trim(),
            subCategoryId: sub?.trim(),
          );
    });
  }

  /// Banners + layout sections; tenants from [HomeCubit] (`pillar_id` + optional `sub_category_id`).
  Future<_HomeLayoutPayload> _fetchLayout() async {
    nmdPostLoginTrace('HOME_API_START slug=${widget.slug}');
    try {
      final api = StorefrontApi(context.read<Dio>());
      final slug = widget.slug;
      final market = await withGuestBrowsingRetry(
        () => api.getMarketBySlug(slug),
      );
      final marketId = market['id']?.toString();
      if (marketId == null || marketId.isEmpty) throw Exception('Market missing');

      final sectionsRaw = await withGuestBrowsingFallback(
        () => api.getMarketLayout(slug),
        const <Map<String, dynamic>>[],
      );
      final bannersRaw = await withGuestBrowsingFallback(
        () => api.getMarketBanners(slug),
        const <Map<String, dynamic>>[],
      );
      final feedCampaignsRaw = await withGuestBrowsingFallback(
        () => api.getMarketFeedCampaigns(slug),
        const <Map<String, dynamic>>[],
      );
      final feedCampaigns = feedCampaignsRaw
          .map(FeedCampaign.fromJson)
          .where((c) => c.active && c.isWithinSchedule)
          .toList();
      _logFeedCampaigns(
        slug: slug,
        rawCount: feedCampaignsRaw.length,
        visible: feedCampaigns,
      );
      final campaigns = <Map<String, dynamic>>[];

      final campaignBanners = campaigns
          .map((c) => _BannerItem(
                title: (c['name']?.toString() ?? 'Now Market').trim(),
                imageUrl: resolveImageUrl(
                    c['imageUrl']?.toString() ?? c['bannerUrl']?.toString()),
              ))
          .where((b) => b.imageUrl.isNotEmpty)
          .toList();
      final marketBanners = bannersRaw
          .map((b) => _BannerItem(
                title: (b['title']?.toString() ?? 'Now Market').trim(),
                imageUrl: resolveImageUrl(b['imageUrl']?.toString()),
              ))
          .where((b) => b.imageUrl.isNotEmpty)
          .toList();
      final banners =
          campaignBanners.isNotEmpty ? campaignBanners : marketBanners;

      final sections = sectionsRaw
          .map(
            (s) => _SectionItem(
              title: (s['title']?.toString() ?? '').trim(),
              storeIds: ((s['storeIds'] as List?) ?? const [])
                  .map((e) => e.toString())
                  .toList(),
            ),
          )
          .where((s) => s.title.isNotEmpty && s.storeIds.isNotEmpty)
          .toList();

      nmdPostLoginTrace('HOME_API_SUCCESS slug=$slug');
      return _HomeLayoutPayload(
        marketName: _marketDisplayName(market),
        banners: banners,
        sections: sections,
        feedCampaigns: feedCampaigns,
      );
    } catch (e, st) {
      nmdPostLoginTrace('HOME_API_FAILED', '$e\n$st');
      rethrow;
    }
  }

  void _logFeedCampaigns({
    required String slug,
    required int rawCount,
    required List<FeedCampaign> visible,
  }) {
    if (!kDebugMode) return;
    debugPrint(
      '[FEED_CAMPAIGNS] slug=$slug count=$rawCount activeVisible=${visible.length}',
    );
    for (final c in visible.take(5)) {
      debugPrint(
        '[FEED_CAMPAIGNS] id=${c.id} kind=${c.kind.name} placement=${c.placement.name}',
      );
    }
  }

  List<HomeFeedBlock> _composeFeedBlocks({
    required List<HomeFeedStoreSection> feedSections,
    required List<FeedCampaign> campaigns,
  }) {
    final blocks = campaigns.isEmpty
        ? feedSections.map((s) => StoreSectionFeedBlock(section: s)).toList()
        : HomeFeedComposer.compose(
            sections: feedSections,
            campaigns: campaigns,
          );
    if (kDebugMode) {
      final promos = blocks.where((b) => b is! StoreSectionFeedBlock).length;
      debugPrint(
        '[FEED_COMPOSER] insertedBlocks=$promos sections=${feedSections.length} '
        'campaigns=${campaigns.length}',
      );
    }
    return blocks;
  }

  String _marketDisplayName(Map<String, dynamic> market) {
    final ar = (market['nameAr'] ?? market['name_ar'] ?? '').toString().trim();
    if (ar.isNotEmpty) return ar;
    return (market['name'] ?? market['title'] ?? '').toString().trim();
  }

  /// Web parity: `ContestPopUp` loads when `onMarketPage` (here: `/market/:slug` home).
  /// Fires once right after layout payload is ready — no wait for tenant list (same as web query).
  ///
  /// Participation gate + `GET /contest/me` session cache: see
  /// `showContestPopupIfNeeded` in contest_popup_sheet.dart (logged-in users
  /// skip the sheet if already joined; guests always eligible).
  void _scheduleContestPopupAfterLayoutReady() {
    if (_contestPopupAttempted) return;
    _contestPopupAttempted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      showContestPopupIfNeeded(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    _scheduleTenantSyncFromRoute(context);

    return ColoredBox(
      color: NmdColors.surfaceBase,
      child: Column(
        children: [
          NmdAppHeader(
            center: SvgPicture.asset(
              'assets/branding/logo-nowmarket.svg',
              height: 26,
            ),
            leading: NmdAppHeader.backLeading(
              onPressed: () => context.go('/main'),
            ),
            actions: [
              NmdAppHeader.profileAction(
                onPressed: () =>
                    openCustomerAccount(context, widget.slug),
              ),
              GlobalCartIcon(
                marketSlug: widget.slug,
                iconColor: NmdColors.textOnBrand,
                style: NmdAppHeader.plainIconStyle(),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              NmdSpacing.screenHorizontal,
              NmdSpacing.sm,
              NmdSpacing.screenHorizontal,
              NmdSpacing.xs,
            ),
            child: NmdSearchBar(
              controller: _searchController,
              focusNode: _searchFocus,
              hintText: 'بحث باسم المحل...',
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            ),
          ),
          Expanded(
            child: FutureBuilder<_HomeLayoutPayload>(
              future: _layoutFuture,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const HomeLayoutShimmer();
                }
                if (snap.hasError) {
                  final err = snap.error!;
                  if (err is DioException && isGuestSafe401(err)) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (!mounted) return;
                      setState(() => _layoutFuture = _fetchLayout());
                    });
                    return const HomeLayoutShimmer();
                  }
                  return AppErrorView.fromError(
                    error: err,
                    context: 'home_layout',
                    compact: true,
                    onRetry: () {
                      setState(() {
                        _layoutFuture = _fetchLayout();
                      });
                    },
                  );
                }
                final layout = snap.data!;
                if (!_homeRenderedLogged) {
                  _homeRenderedLogged = true;
                  nmdPostLoginTrace('HOME_SCREEN_RENDERED slug=${widget.slug}');
                }
                _scheduleContestPopupAfterLayoutReady();
                return BlocBuilder<HomeCubit, HomeCubitState>(
                  builder: (context, cState) {
                    if (cState.tenantsStatus == TenantsStatus.failure) {
                      return AppErrorView(
                        title: 'تعذر تحميل المحلات',
                        message: cState.tenantsErrorMessage ??
                            AppErrorMapper.unknownMessage,
                        compact: true,
                        onRetry: () {
                          _tenantSyncToken = null;
                          final pillar = GoRouterState.of(context)
                              .uri
                              .queryParameters['pillar'];
                          final sub = GoRouterState.of(context)
                              .uri
                              .queryParameters['sub'];
                          context.read<HomeCubit>().syncTenantsForMarket(
                                widget.slug,
                                pillarId: pillar?.trim(),
                                subCategoryId: sub?.trim(),
                              );
                        },
                      );
                    }
                    if (cState.tenantsStatus == TenantsStatus.loading ||
                        cState.tenantsStatus == TenantsStatus.initial) {
                      return CustomScrollView(
                        primary: true,
                        slivers: [
                          if (layout.banners.isNotEmpty)
                            SliverToBoxAdapter(
                                child:
                                    _BannerCarousel(banners: layout.banners)),
                          SliverToBoxAdapter(
                              child: _PillarNavStrip(marketSlug: widget.slug)),
                          SliverToBoxAdapter(
                              child: _SubCategoryNavStrip(
                                  marketSlug: widget.slug)),
                          const SliverToBoxAdapter(child: _HomeStoresShimmer()),
                          const SliverToBoxAdapter(child: SizedBox(height: 24)),
                        ],
                      );
                    }
                    final routePillar =
                        GoRouterState.of(context).uri.queryParameters['pillar'];
                    final routeSub =
                        GoRouterState.of(context).uri.queryParameters['sub'];
                    final strictMaps = _strictTenantMapsForRoute(
                      List<Map<String, dynamic>>.from(cState.tenantMaps),
                      routePillar,
                      routeSub,
                    );

                    final storesById = <String, _StoreItem>{};
                    final storesBySlug = <String, _StoreItem>{};
                    for (final t in strictMaps) {
                      final item = _storeItemFromTenantMap(t);
                      if (item.id.isNotEmpty && item.name.isNotEmpty) {
                        storesById[item.id] = item;
                        if (item.slug.isNotEmpty) {
                          storesBySlug[item.slug] = item;
                        }
                      }
                    }

                    final filterActive =
                        routePillar != null && routePillar.trim().isNotEmpty;

                    if (filterActive) {
                      final pid = routePillar.trim();
                      final subId = routeSub?.trim();
                      String flatTitle = 'المحلات';
                      if (subId != null && subId.isNotEmpty) {
                        var subMatched = false;
                        for (final sc in cState.subCategories) {
                          if (sc.id.trim() == subId) {
                            flatTitle = sc.titleAr;
                            subMatched = true;
                            break;
                          }
                        }
                        if (!subMatched) {
                          for (final p in cState.pillars) {
                            if (p.id.trim() == pid) {
                              flatTitle = p.titleAr;
                              break;
                            }
                          }
                        }
                      } else {
                        for (final p in cState.pillars) {
                          if (p.id.trim() == pid) {
                            flatTitle = p.titleAr;
                            break;
                          }
                        }
                      }
                      final flatStores = strictMaps
                          .map(_storeItemFromTenantMap)
                          .where((s) =>
                              s.id.isNotEmpty &&
                              s.name.isNotEmpty &&
                              _matchesStoreQuery(s, _query))
                          .toList();

                      final pillarFeedSections =
                          syntheticSectionsFromStoreIds(
                        flatStores.map((s) => s.id).toList(),
                        sectionTitle: flatTitle,
                      );
                      final pillarFeedBlocks = _composeFeedBlocks(
                        feedSections: pillarFeedSections,
                        campaigns: layout.feedCampaigns,
                      );

                      List<HomeFeedStoreView> resolvePillarSection(
                        HomeFeedStoreSection section,
                      ) {
                        return section.storeIds
                            .map((id) {
                              for (final s in flatStores) {
                                if (s.id == id) return s;
                              }
                              return null;
                            })
                            .whereType<_StoreItem>()
                            .map(
                              (s) => HomeFeedStoreView(
                                id: s.id,
                                slug: s.slug,
                                name: s.name,
                                category: s.category,
                                logoUrl: s.logoUrl,
                                openStatus: s.openStatus,
                              ),
                            )
                            .toList();
                      }

                      final pillarStoreIdBySlug = {
                        for (final s in flatStores)
                          if (s.slug.isNotEmpty) s.slug: s.id,
                      };

                      return CustomScrollView(
                        primary: true,
                        slivers: [
                          if (layout.banners.isNotEmpty)
                            SliverToBoxAdapter(
                                child:
                                    _BannerCarousel(banners: layout.banners)),
                          SliverToBoxAdapter(
                              child: _PillarNavStrip(marketSlug: widget.slug)),
                          SliverToBoxAdapter(
                              child: _SubCategoryNavStrip(
                                  marketSlug: widget.slug)),
                          ...HomeFeedSliverBuilder.buildSlivers(
                            context: context,
                            blocks: pillarFeedBlocks,
                            marketSlug: widget.slug,
                            resolveStores: resolvePillarSection,
                            storeIdBySlug: pillarStoreIdBySlug,
                          ),
                          if (flatStores.isEmpty)
                            SliverToBoxAdapter(
                              child: NmdEmptyState(
                                title: 'لا توجد محلات',
                                message: 'لا توجد محلات في هذا القسم حالياً.',
                                icon: Icons.storefront_outlined,
                              ),
                            ),
                          const SliverToBoxAdapter(child: SizedBox(height: 16)),
                        ],
                      );
                    }

                    var hasVisibleStore = false;
                    for (final section in layout.sections) {
                      final sectionTitleMatch = _query.isNotEmpty &&
                          section.title.toLowerCase().contains(_query);
                      for (final id in section.storeIds) {
                        final s = storesById[id] ?? storesBySlug[id];
                        if (s != null &&
                            (sectionTitleMatch ||
                                _matchesStoreQuery(s, _query))) {
                          hasVisibleStore = true;
                          break;
                        }
                      }
                      if (hasVisibleStore) break;
                    }

                    final feedSections = resolveHomeFeedSections(
                      layoutSections: layout.sections
                          .map(
                            (s) => (
                              title: s.title,
                              storeIds: s.storeIds,
                            ),
                          )
                          .toList(),
                      tenantStoreIds: storesById.keys.toList(),
                    );

                    final feedBlocks = _composeFeedBlocks(
                      feedSections: feedSections,
                      campaigns: layout.feedCampaigns,
                    );

                    final storeIdBySlug = <String, String>{
                      for (final e in storesBySlug.entries) e.key: e.value.id,
                    };

                    List<HomeFeedStoreView> resolveSectionStores(
                      HomeFeedStoreSection section,
                    ) {
                      final sectionTitleMatch = _query.isNotEmpty &&
                          section.title.toLowerCase().contains(_query);
                      return section.storeIds
                          .map((id) => storesById[id] ?? storesBySlug[id])
                          .whereType<_StoreItem>()
                          .where(
                            (s) =>
                                sectionTitleMatch ||
                                _matchesStoreQuery(s, _query),
                          )
                          .map(
                            (s) => HomeFeedStoreView(
                              id: s.id,
                              slug: s.slug,
                              name: s.name,
                              category: s.category,
                              logoUrl: s.logoUrl,
                              openStatus: s.openStatus,
                            ),
                          )
                          .toList();
                    }

                    return CustomScrollView(
                      primary: true,
                      slivers: [
                        if (layout.banners.isNotEmpty)
                          SliverToBoxAdapter(
                              child: _BannerCarousel(banners: layout.banners)),
                        SliverToBoxAdapter(
                            child: _PillarNavStrip(marketSlug: widget.slug)),
                        SliverToBoxAdapter(
                            child:
                                _SubCategoryNavStrip(marketSlug: widget.slug)),
                        ...HomeFeedSliverBuilder.buildSlivers(
                          context: context,
                          blocks: feedBlocks,
                          marketSlug: widget.slug,
                          resolveStores: resolveSectionStores,
                          storeIdBySlug: storeIdBySlug,
                        ),
                        if (layout.sections.isNotEmpty && !hasVisibleStore)
                          SliverToBoxAdapter(
                            child: NmdEmptyState(
                              title: 'لا توجد نتائج',
                              message:
                                  'لا توجد محلات تطابق بحثك ضمن أقسام الصفحة.',
                              icon: Icons.search_off_rounded,
                            ),
                          ),
                        const SliverToBoxAdapter(child: SizedBox(height: 16)),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

}

/// Horizontal chips matching pillar row height — shown while GET `/pillars` loads.
class _PillarStripShimmer extends StatelessWidget {
  const _PillarStripShimmer();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: NmdColors.surfaceBase,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Padding(
          padding: const EdgeInsets.only(top: 2, bottom: 10),
          child: SizedBox(
            width: double.infinity,
            height: 104,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              primary: false,
              shrinkWrap: true,
              padding: const EdgeInsetsDirectional.only(start: 0, end: 16),
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 6,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, __) => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Shimmer.fromColors(
                    baseColor: NmdColors.borderSubtle,
                    highlightColor: NmdColors.surfaceBase,
                    child: Container(
                      width: 58,
                      height: 58,
                      decoration: const BoxDecoration(
                        color: NmdColors.borderSubtle,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Shimmer.fromColors(
                    baseColor: NmdColors.borderSubtle,
                    highlightColor: NmdColors.surfaceBase,
                    child: Container(
                      width: 56,
                      height: 12,
                      decoration: BoxDecoration(
                        color: NmdColors.borderSubtle,
                        borderRadius: NmdRadius.borderXs,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeStoresShimmer extends StatelessWidget {
  const _HomeStoresShimmer();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 12, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Shimmer.fromColors(
            baseColor: NmdColors.borderSubtle,
            highlightColor: NmdColors.surfaceBase,
            child: Container(
              height: 18,
              width: 140,
              decoration: BoxDecoration(
                color: NmdColors.borderSubtle,
                borderRadius: NmdRadius.borderXs,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: HomeStoreCard.cardHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              primary: false,
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: 4,
              separatorBuilder: (_, __) => const SizedBox(
                width: MarketplaceCardLayout.stripSeparator,
              ),
              itemBuilder: (_, __) => Shimmer.fromColors(
                baseColor: NmdColors.borderSubtle,
                highlightColor: NmdColors.surfaceBase,
                child: Container(
                  width: HomeStoreCard.cardWidth,
                  height: HomeStoreCard.cardHeight,
                  decoration: BoxDecoration(
                    color: NmdColors.borderSubtle,
                    borderRadius: NmdRadius.borderMd,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PillarNavStrip extends StatelessWidget {
  const _PillarNavStrip({required this.marketSlug});

  final String marketSlug;

  @override
  Widget build(BuildContext context) {
    final selectedPillarId =
        GoRouterState.of(context).uri.queryParameters['pillar'];
    return BlocBuilder<HomeCubit, HomeCubitState>(
      builder: (context, state) {
        if (state.pillarStatus == HomeCategoriesStatus.loading ||
            state.pillarStatus == HomeCategoriesStatus.initial) {
          return const _PillarStripShimmer();
        }
        if (state.pillarStatus == HomeCategoriesStatus.failure) {
          return Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: NmdSpacing.screenHorizontal,
              vertical: NmdSpacing.sm,
            ),
            child: AppErrorView(
              title: 'تعذر تحميل الأقسام',
              message: state.pillarErrorMessage ??
                  AppErrorMapper.unknownMessage,
              compact: true,
              onRetry: () => context.read<HomeCubit>().loadPillars(),
            ),
          );
        }
        if (state.pillars.isEmpty) {
          return const SizedBox.shrink();
        }
        return ColoredBox(
          color: NmdColors.surfaceBase,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Padding(
              padding: const EdgeInsets.only(top: 2, bottom: 10),
              child: SizedBox(
                width: double.infinity,
                height: 104,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  primary: false,
                  shrinkWrap: true,
                  padding: const EdgeInsetsDirectional.only(start: 0, end: 16),
                  physics: const BouncingScrollPhysics(),
                  itemCount: state.pillars.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, i) {
                    final item = state.pillars[i];
                    final selected =
                        _pillarQueryMatchesChip(selectedPillarId, item.id);
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          if (_pillarQueryMatchesChip(
                              selectedPillarId, item.id)) {
                            context
                                .read<HomeCubit>()
                                .clearTenantPillarFilter(marketSlug);
                            context.go('/market/$marketSlug');
                            return;
                          }
                          context
                              .read<HomeCubit>()
                              .filterTenantsByPillar(marketSlug, item.id);
                          context.go(
                              '/market/$marketSlug?pillar=${Uri.encodeComponent(item.id.trim())}');
                        },
                        borderRadius: NmdRadius.borderSm,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 58,
                                height: 58,
                                decoration: BoxDecoration(
                                  color: NmdColors.surfaceBase,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    width: selected ? 2.5 : 1,
                                    color: selected
                                        ? NmdColors.brandPrimary
                                        : NmdColors.borderSubtle,
                                  ),
                                  boxShadow:
                                      selected ? NmdShadows.brandGlow() : null,
                                ),
                                child: ClipOval(
                                  child: _PillarDiskIcon(item: item),
                                ),
                              ),
                              const SizedBox(height: 6),
                              SizedBox(
                                width: 74,
                                child: Text(
                                  item.titleAr,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: NmdTypography.micro.copyWith(
                                    fontWeight: selected
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    fontSize: 11,
                                    height: 1.15,
                                    color: selected
                                        ? NmdColors.brandPrimary
                                        : NmdColors.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Web [MarketSectionPage] parity: horizontal sub-filters when a pillar is selected (`?pillar=` + optional `?sub=` id).
class _SubCategoryNavStrip extends StatelessWidget {
  const _SubCategoryNavStrip({required this.marketSlug});

  final String marketSlug;

  @override
  Widget build(BuildContext context) {
    final pillarId = GoRouterState.of(context).uri.queryParameters['pillar'];
    final selectedSubId = GoRouterState.of(context).uri.queryParameters['sub'];
    if (pillarId == null || pillarId.trim().isEmpty) {
      return const SizedBox.shrink();
    }
    final pid = pillarId.trim();

    return BlocBuilder<HomeCubit, HomeCubitState>(
      builder: (context, state) {
        final aligned = state.subCategoriesForPillarId == pid;
        if (!aligned) {
          if (state.tenantsStatus == TenantsStatus.loading ||
              state.tenantsStatus == TenantsStatus.initial) {
            return const _SubCategoryShimmerBar();
          }
          return const SizedBox.shrink();
        }
        if (state.tenantsStatus == TenantsStatus.loading ||
            state.subCategoriesStatus == HomeCategoriesStatus.loading) {
          return const _SubCategoryShimmerBar();
        }
        if (state.subCategories.isEmpty) {
          return const SizedBox.shrink();
        }

        return ColoredBox(
          color: NmdColors.surfaceMuted,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 10),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsetsDirectional.only(start: 8, end: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    textDirection: TextDirection.rtl,
                    children: [
                      NmdChip(
                        label: 'الكل',
                        selected: selectedSubId == null ||
                            selectedSubId.trim().isEmpty,
                        variant: NmdChipVariant.filter,
                        onTap: () {
                          context
                              .read<HomeCubit>()
                              .clearSubCategoryFilter(marketSlug, pid);
                          context.go(
                              '/market/$marketSlug?pillar=${Uri.encodeComponent(pid)}');
                        },
                      ),
                      ...state.subCategories.expand(
                        (sub) => [
                          const SizedBox(width: 8),
                          NmdChip(
                            label: sub.titleAr,
                            selected:
                                (selectedSubId ?? '').trim() == sub.id.trim(),
                            variant: NmdChipVariant.filter,
                            onTap: () {
                              context
                                  .read<HomeCubit>()
                                  .filterTenantsBySubCategory(
                                      marketSlug, pid, sub.id);
                              context.go(
                                '/market/$marketSlug?pillar=${Uri.encodeComponent(pid)}&sub=${Uri.encodeComponent(sub.id)}',
                              );
                            },
                          ),
                        ],
                      ),
                      const SizedBox(width: 24),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SubCategoryShimmerBar extends StatelessWidget {
  const _SubCategoryShimmerBar();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: NmdColors.surfaceMuted,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 8, 10),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            child: Shimmer.fromColors(
              baseColor: NmdColors.borderSubtle,
              highlightColor: NmdColors.surfaceBase,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                textDirection: TextDirection.rtl,
                children: List.generate(
                  5,
                  (i) => Padding(
                    padding: EdgeInsetsDirectional.only(start: i == 0 ? 0 : 8),
                    child: Container(
                      width: 64,
                      height: 32,
                      decoration: BoxDecoration(
                        color: NmdColors.borderSubtle,
                        borderRadius: NmdRadius.borderPill,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PillarDiskIcon extends StatelessWidget {
  const _PillarDiskIcon({required this.item});

  final PillarNavItem item;

  @override
  Widget build(BuildContext context) {
    final url = item.resolvedNetworkIconUrl;
    if (url != null && url.isNotEmpty) {
      final resolved = resolveImageUrl(url);
      if (resolved.toLowerCase().endsWith('.svg')) {
        return SvgPicture.network(
          resolved,
          fit: BoxFit.contain,
          width: 36,
          height: 36,
          allowDrawingOutsideViewBox: true,
          placeholderBuilder: (_) => const Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: NmdColors.brandPrimary),
            ),
          ),
        );
      }
      return CachedNetworkImage(
        imageUrl: resolved,
        fit: BoxFit.cover,
        width: 58,
        height: 58,
        memCacheWidth: 180,
        memCacheHeight: 180,
        filterQuality: FilterQuality.high,
        fadeInDuration: const Duration(milliseconds: 150),
        placeholder: (_, __) => const Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
                strokeWidth: 2, color: NmdColors.brandPrimary),
          ),
        ),
        errorWidget: (_, __, ___) =>
            _PillarEmojiFallback(iconRaw: item.iconRaw),
      );
    }
    return _PillarEmojiFallback(iconRaw: item.iconRaw);
  }
}

class _PillarEmojiFallback extends StatelessWidget {
  const _PillarEmojiFallback({required this.iconRaw});

  final String iconRaw;

  @override
  Widget build(BuildContext context) {
    final text = iconRaw.trim().isEmpty ? '📦' : iconRaw;
    return Center(
      child: Text(text,
          style: const TextStyle(fontSize: 26), textAlign: TextAlign.center),
    );
  }
}

class _BannerCarousel extends StatelessWidget {
  const _BannerCarousel({required this.banners});
  final List<_BannerItem> banners;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 12, 8),
      child: CarouselSlider.builder(
        itemCount: banners.length,
        itemBuilder: (_, i, __) {
          final b = banners[i];
          return ClipRRect(
            borderRadius: NmdRadius.borderLg,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Hero(
                  tag: 'home-banner-$i-${b.imageUrl}',
                  child: Image.network(
                    b.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        const ColoredBox(color: NmdColors.brandPrimary),
                  ),
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.08),
                        Colors.black.withValues(alpha: 0.55),
                      ],
                    ),
                  ),
                ),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: NmdSpacing.md),
                    child: Text(
                      b.title,
                      textAlign: TextAlign.center,
                      style: NmdTypography.h2.copyWith(
                        color: NmdColors.textOnBrand,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
        options: CarouselOptions(
          height: 184,
          viewportFraction: 1,
          autoPlay: banners.length > 1,
          autoPlayInterval: const Duration(seconds: 5),
        ),
      ),
    );
  }
}

bool _matchesStoreQuery(_StoreItem s, String query) {
  if (query.isEmpty) return true;
  final q = query;
  if (s.name.toLowerCase().contains(q)) return true;
  final cat = s.category.toLowerCase();
  if (cat.contains(q)) return true;
  if (homeStoreCategoryLabel(s.category).toLowerCase().contains(q)) return true;
  return false;
}

class _HomeLayoutPayload {
  const _HomeLayoutPayload({
    required this.marketName,
    required this.banners,
    required this.sections,
    required this.feedCampaigns,
  });
  final String marketName;
  final List<_BannerItem> banners;
  final List<_SectionItem> sections;
  final List<FeedCampaign> feedCampaigns;
}

class _BannerItem {
  const _BannerItem({required this.title, required this.imageUrl});
  final String title;
  final String imageUrl;
}

class _SectionItem {
  const _SectionItem({required this.title, required this.storeIds});
  final String title;
  final List<String> storeIds;
}

class _StoreItem {
  const _StoreItem({
    required this.id,
    required this.slug,
    required this.name,
    required this.category,
    required this.logoUrl,
    required this.openStatus,
    required this.pillarId,
  });
  final String id;
  final String slug;
  final String name;
  final String category;
  final String logoUrl;
  final String openStatus;
  final String pillarId;
}
