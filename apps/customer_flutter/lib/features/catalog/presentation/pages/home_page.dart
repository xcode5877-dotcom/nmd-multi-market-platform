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
import '../../../../core/debug/nmd_feed_trace.dart';
import '../../../../core/navigation/safe_back_navigation.dart';
import '../../../../core/debug/nmd_post_login_trace.dart';
import '../../../../design_system/design_system.dart';
import '../../../cart/presentation/widgets/global_cart_icon.dart';
import '../../../contest/presentation/widgets/contest_popup_sheet.dart';
import '../../application/home_cubit.dart';
import '../../data/pillar_nav_item.dart';
import '../widgets/home_store_card.dart';
import '../widgets/restaurant_grid_store_card.dart';
import '../../../../widgets/nmd_bottom_nav.dart';
import '../widgets/home_layout_shimmer.dart';
import '../../../../core/errors/app_error_mapper.dart';
import '../../../../widgets/app_error_view.dart';
import '../widgets/marketplace_card_layout.dart';
import '../../../../widgets/nmd_search_bar.dart';
import '../../../home/domain/feed/debug_feed_campaigns.dart';
import '../../../home/domain/feed/feed_campaign.dart';
import '../../../home/domain/feed/home_feed_settings.dart';
import '../../../home/domain/feed/home_feed_block.dart';
import '../../../home/domain/feed/home_feed_composer.dart';
import '../../../home/domain/feed/home_feed_sections_resolver.dart';
import '../../../home/domain/home_page_block.dart';
import '../../../home/domain/home_page_store_block_resolver.dart';
import '../../../home/presentation/feed/home_feed_sliver_builder.dart';
import '../../../home/presentation/feed/home_feed_store_view.dart';
import '../../../home/presentation/feed/home_store_section_strip.dart';
import '../../../home/presentation/widgets/feed_campaigns/challenge_event_editorial_card.dart';
import '../../../home/presentation/widgets/feed_campaigns/custom_banner_block.dart';
import '../../../home/presentation/widgets/feed_campaigns/floating_glass_promo_strip.dart';
import '../../../home/presentation/widgets/feed_campaigns/food_mood_discovery_block.dart';
import '../../../home/presentation/widgets/feed_campaigns/new_store_story_card.dart';
import '../../../home/presentation/widgets/feed_campaigns/rewards_discovery_editorial_card.dart';
import '../../../home/presentation/feed/feed_campaign_actions.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';

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
  final status = (t['operationalStatus']?.toString() ?? 'closed').trim();
  final acceptingOrders = status == 'open' || status == 'busy';
  final tenantId = t['id']?.toString() ?? '';
  // ignore: avoid_print
  print(
    '[STORE_STATUS] tenantId=$tenantId status=$status acceptingOrders=$acceptingOrders',
  );
  return _StoreItem(
    id: tenantId,
    slug: t['slug']?.toString() ?? '',
    name: t['name']?.toString() ?? '',
    category: (t['categoryName']?.toString() ??
            t['marketCategory']?.toString() ??
            'تصنيف عام')
        .trim(),
    logoUrl: resolveImageUrl(branding['logoUrl']?.toString()),
    openStatus: status,
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CoinsBalanceCubit>().loadForReason('home');
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _applySearchQueryFromRoute(BuildContext context) {
    final q = GoRouterState.of(context).uri.queryParameters['q']?.trim();
    if (q == null || q.isEmpty) return;
    if (_searchController.text == q && _query == q.toLowerCase()) return;
    _searchController.text = q;
    setState(() => _query = q.toLowerCase());
  }

  void _scheduleTenantSyncFromRoute(BuildContext context) {
    _applySearchQueryFromRoute(context);
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
      nmdFeedTrace('[HOME_MARKET] slug=$slug');
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
      final homePageBlocksRaw = await withGuestBrowsingFallback(
        () => api.getHomePageBlocks(slug),
        const <Map<String, dynamic>>[],
      );
      final homePageBlocks = HomePageBlock.parseList(homePageBlocksRaw);
      final builderActive = homePageBlocks.isNotEmpty;

      List<FeedCampaign> feedCampaigns = const [];
      HomeFeedSettings homeFeedSettings = HomeFeedSettings.defaults;

      if (builderActive) {
        nmdFeedTrace(
          '[HOME_BUILDER] builderEnabled=true blockCount=${homePageBlocks.length} '
          'legacyDisabled=true',
        );
        final feedFetch = await _fetchFeedCampaignsRaw(api, slug);
        feedCampaigns = feedFetch.rows
            .map(FeedCampaign.fromJson)
            .where((c) => c.active && c.isWithinSchedule)
            .toList();
        nmdFeedTrace(
          '[HOME_LEGACY_DISABLED] reason=builder_active slug=$slug',
        );
      } else {
        final feedFetch = await _fetchFeedCampaignsRaw(api, slug);
        final feedSettingsRaw = await withGuestBrowsingFallback(
          () => api.getHomeFeedSettings(slug),
          const <String, dynamic>{},
        );
        homeFeedSettings = HomeFeedSettings.fromJson(feedSettingsRaw);
        final feedCampaignsRaw = feedFetch.rows;
        var parsed = feedCampaignsRaw
            .map(FeedCampaign.fromJson)
            .where((c) => c.active && c.isWithinSchedule)
            .toList();

        final usedDebugFallback = parsed.isEmpty && kDebugMode;
        if (usedDebugFallback) {
          parsed = debugFeedCampaignFallback(slug);
          if (kDebugMode) {
            debugPrint(
              '[FEED_CAMPAIGNS] debugFallback=true slug=$slug '
              'fallbackCount=${parsed.length}',
            );
          }
        }
        feedCampaigns = parsed;

        _logFeedCampaigns(
          slug: slug,
          apiCount: feedCampaignsRaw.length,
          apiStatus: feedFetch.statusCode,
          visible: feedCampaigns,
          usedDebugFallback: usedDebugFallback,
        );
      }
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
              id: (s['id']?.toString() ?? '').trim(),
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
        homeFeedSettings: homeFeedSettings,
        homePageBlocks: homePageBlocks,
        builderActive: builderActive,
      );
    } catch (e, st) {
      nmdPostLoginTrace('HOME_API_FAILED', '$e\n$st');
      rethrow;
    }
  }

  Future<({List<Map<String, dynamic>> rows, int? statusCode})>
      _fetchFeedCampaignsRaw(StorefrontApi api, String slug) async {
    try {
      final rows = await withGuestBrowsingRetry(
        () => api.getMarketFeedCampaigns(slug),
      );
      return (rows: rows, statusCode: 200);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (isGuestSafe401(e)) {
        nmdFeedTrace(
          '[FEED_CAMPAIGNS] apiCount=0 apiStatus=$status '
          'reason=guest_safe_401 (public feed endpoint blocked or stale token)',
        );
        return (rows: const <Map<String, dynamic>>[], statusCode: status);
      }
      nmdFeedTrace(
        '[FEED_CAMPAIGNS] apiCount=0 apiStatus=$status error=${e.message}',
      );
      rethrow;
    }
  }

  void _logFeedCampaigns({
    required String slug,
    required int apiCount,
    required int? apiStatus,
    required List<FeedCampaign> visible,
    bool usedDebugFallback = false,
  }) {
    nmdFeedTrace(
      '[FEED_CAMPAIGNS] slug=$slug apiCount=$apiCount apiStatus=$apiStatus '
      'visibleCount=${visible.length} debugFallback=$usedDebugFallback',
    );
    if (visible.isEmpty) {
      nmdFeedTrace(
        '[FEED_CAMPAIGNS] reason=empty_visible '
        '(api blocked, inactive, schedule, or slug mismatch)',
      );
      return;
    }
    if (kDebugMode) {
      for (final c in visible.take(6)) {
        nmdFeedTrace(
          '[FEED_CAMPAIGNS] id=${c.id} kind=${c.kind.name} '
          'placement=${c.placement.name}',
          verbose: true,
        );
      }
    }
  }

  List<HomeFeedBlock> _composeFeedBlocks({
    required List<HomeFeedStoreSection> feedSections,
    required List<FeedCampaign> campaigns,
    required bool hasLegacyTopBanner,
    required HomeFeedSettings homeFeedSettings,
  }) {
    final blocks = HomeFeedComposer.compose(
      sections: feedSections,
      campaigns: campaigns,
      settings: homeFeedSettings,
      marketSlug: widget.slug,
      hasLegacyTopBanner: hasLegacyTopBanner,
    );
    final promos = blocks.where((b) => b is! StoreSectionFeedBlock).length;
    nmdFeedTrace(
      '[FEED_COMPOSER] insertedBlocks=$promos sections=${feedSections.length} '
      'campaigns=${campaigns.length}',
    );
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
              onPressed: () => safeNmdBack(
                context,
                marketSlug: widget.slug,
                preferMarketPicker: true,
              ),
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
                      if (layout.builderActive) {
                        return const CustomScrollView(
                          primary: true,
                          slivers: [
                            SliverToBoxAdapter(child: _HomeStoresShimmer()),
                            SliverToBoxAdapter(child: SizedBox(height: 24)),
                          ],
                        );
                      }
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

                      return CustomScrollView(
                        primary: true,
                        slivers: [
                          SliverToBoxAdapter(
                            child: _PillarNavStrip(marketSlug: widget.slug),
                          ),
                          SliverToBoxAdapter(
                            child: _SubCategoryNavStrip(
                              marketSlug: widget.slug,
                            ),
                          ),
                          if (flatTitle.isNotEmpty)
                            SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(
                                  16,
                                  8,
                                  16,
                                  4,
                                ),
                                child: Align(
                                  alignment: Alignment.centerRight,
                                  child: Text(
                                    flatTitle,
                                    style: NmdTypography.h2.copyWith(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          if (flatStores.isEmpty)
                            SliverToBoxAdapter(
                              child: NmdEmptyState(
                                title: 'لا توجد محلات',
                                message: 'لا توجد محلات في هذا القسم حالياً.',
                                icon: Icons.storefront_outlined,
                              ),
                            )
                          else
                            SliverPadding(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                              sliver: SliverGrid(
                                gridDelegate:
                                    const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  mainAxisSpacing: 12,
                                  crossAxisSpacing: 12,
                                  childAspectRatio: 0.78,
                                ),
                                delegate: SliverChildBuilderDelegate(
                                  (context, index) {
                                    final s = flatStores[index];
                                    return RestaurantGridStoreCard(
                                      marketSlug: widget.slug,
                                      storeId: s.id,
                                      storeName: s.name,
                                      categoryLabel:
                                          homeStoreCategoryLabel(s.category),
                                      logoUrl: s.logoUrl,
                                      openStatus: s.openStatus,
                                    );
                                  },
                                  childCount: flatStores.length,
                                ),
                              ),
                            ),
                          SliverToBoxAdapter(
                            child: SizedBox(
                              height: NmdBottomNav.navHeight + 24,
                            ),
                          ),
                        ],
                      );
                    }

                    final storeIdBySlug = <String, String>{
                      for (final e in storesBySlug.entries) e.key: e.value.id,
                    };

                    List<HomeFeedStoreView> resolveStoreKeysOrdered(
                      List<String> keys,
                    ) {
                      final sectionTitleMatch = _query.isNotEmpty;
                      final out = <HomeFeedStoreView>[];
                      for (final key in keys) {
                        final k = key.trim();
                        if (k.isEmpty) continue;
                        final item = storesById[k] ?? storesBySlug[k];
                        if (item == null) continue;
                        if (!_matchesStoreQuery(item, _query) &&
                            !(sectionTitleMatch &&
                                item.name.toLowerCase().contains(_query))) {
                          continue;
                        }
                        out.add(
                          HomeFeedStoreView(
                            id: item.id,
                            slug: item.slug,
                            name: item.name,
                            category: item.category,
                            logoUrl: item.logoUrl,
                            openStatus: item.openStatus,
                          ),
                        );
                      }
                      return out;
                    }

                    if (layout.builderActive) {
                      nmdFeedTrace(
                        '[HOME_LEGACY_DISABLED] reason=builder_active_render slug=${widget.slug}',
                      );
                      return CustomScrollView(
                        primary: true,
                        slivers: [
                          ..._buildHomePageBlockSlivers(
                            context: context,
                            blocks: layout.homePageBlocks,
                            layout: layout,
                            marketSlug: widget.slug,
                            resolveStoreKeys: resolveStoreKeysOrdered,
                            storeIdBySlug: storeIdBySlug,
                            strictMaps: strictMaps,
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
                      hasLegacyTopBanner: layout.banners.isNotEmpty,
                      homeFeedSettings: layout.homeFeedSettings,
                    );

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

  List<Widget> _buildHomePageBlockSlivers({
    required BuildContext context,
    required List<HomePageBlock> blocks,
    required _HomeLayoutPayload layout,
    required String marketSlug,
    required List<HomeFeedStoreView> Function(List<String> keys) resolveStoreKeys,
    required Map<String, String> storeIdBySlug,
    required List<Map<String, dynamic>> strictMaps,
  }) {
    final campaignById = {for (final c in layout.feedCampaigns) c.id: c};
    final layoutLookup = layout.sections
        .map((s) => (id: s.id, storeIds: s.storeIds))
        .toList();
    final slivers = <Widget>[];
    var promoIndex = 0;
    var blockIndex = 0;

    for (final block in blocks) {
      final idx = blockIndex++;
      nmdFeedTrace(
        '[HOME_BLOCK_RENDER] index=$idx type=${block.type.name} '
        'title=${block.title}',
      );
      switch (block.type) {
        case HomePageBlockType.heroBanners:
          if (layout.banners.isNotEmpty) {
            nmdFeedTrace(
              '[HOME_BUILDER_RENDER] blockId=${block.id} blockType=HERO_BANNERS '
              'imageUrl=${layout.banners.first.imageUrl} source=api',
            );
            slivers.add(
              SliverToBoxAdapter(
                child: _BannerCarousel(banners: layout.banners),
              ),
            );
          }
          break;
        case HomePageBlockType.pillars:
          slivers.add(
            SliverToBoxAdapter(child: _PillarNavStrip(marketSlug: marketSlug)),
          );
          slivers.add(
            SliverToBoxAdapter(
              child: _SubCategoryNavStrip(marketSlug: marketSlug),
            ),
          );
          break;
        case HomePageBlockType.storeSection:
          final keys = HomePageStoreBlockResolver.resolveStoreKeys(
            config: block.config,
            tenantMaps: strictMaps,
            layoutSections: layoutLookup,
          );
          final stores = resolveStoreKeys(keys);
          if (stores.isEmpty) {
            nmdFeedTrace(
              '[HOME_BLOCK_RENDER] index=$idx type=STORE_SECTION skipped=empty_stores '
              'source=${block.config['source']}',
              verbose: true,
            );
            break;
          }
          final isGrid =
              block.config['layout']?.toString().toUpperCase() == 'GRID';
          if (isGrid) {
            slivers.add(
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      block.title,
                      style: NmdTypography.h2.copyWith(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
            );
            slivers.add(
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                sliver: SliverGrid(
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.78,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (ctx, index) {
                      final s = stores[index];
                      return RestaurantGridStoreCard(
                        marketSlug: marketSlug,
                        storeId: s.id,
                        storeName: s.name,
                        categoryLabel: homeStoreCategoryLabel(s.category),
                        logoUrl: s.logoUrl,
                        openStatus: s.openStatus,
                      );
                    },
                    childCount: stores.length,
                  ),
                ),
              ),
            );
          } else {
            slivers.add(
              SliverToBoxAdapter(
                child: HomeStoreSectionStrip(
                  marketSlug: marketSlug,
                  title: block.title,
                  stores: stores,
                ),
              ),
            );
          }
          break;
        case HomePageBlockType.editorialPromo:
          final cid = block.config['campaignId']?.toString() ?? '';
          final campaign = campaignById[cid];
          if (campaign == null) break;
          final idx = promoIndex++;
          slivers.add(
            SliverToBoxAdapter(
              child: _homeEditorialPromoWidget(
                context,
                campaign: campaign,
                marketSlug: marketSlug,
                storeIdBySlug: storeIdBySlug,
                listIndex: idx,
              ),
            ),
          );
          break;
        case HomePageBlockType.customImageBanner:
          final customUrl = block.config['imageUrl']?.toString() ?? '';
          nmdFeedTrace(
            '[HOME_BUILDER_RENDER] blockId=${block.id} blockType=CUSTOM_IMAGE_BANNER '
            'imageUrl=$customUrl source=${customUrl.trim().isEmpty ? 'fallback' : 'api'}',
          );
          slivers.add(
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: _HomeCustomImageBanner(
                  block: block,
                  marketSlug: marketSlug,
                ),
              ),
            ),
          );
          break;
      }
    }
    return slivers;
  }

  Widget _homeEditorialPromoWidget(
    BuildContext context, {
    required FeedCampaign campaign,
    required String marketSlug,
    required Map<String, String> storeIdBySlug,
    required int listIndex,
  }) {
    void openCampaign() {
      handleFeedCampaignAction(
        context,
        campaign: campaign,
        marketSlug: marketSlug,
        storeIdBySlug: storeIdBySlug,
      );
    }

    switch (campaign.kind) {
      case FeedCampaignKind.categoryDiscovery:
        return FoodMoodDiscoveryBlock(
          campaign: campaign,
          listIndex: listIndex,
          onChipTap: (chip) {
            if (!chip.isActionable) return;
            final target = chip.resolvedTarget;
            handleFeedCampaignAction(
              context,
              campaign: FeedCampaign(
                id: campaign.id,
                marketSlug: campaign.marketSlug,
                kind: campaign.kind,
                title: campaign.title,
                subtitle: campaign.subtitle,
                ctaLabel: campaign.ctaLabel,
                actionType: chip.actionType,
                targetId: chip.actionType == FeedCampaignActionType.openSearch
                    ? (target ?? chip.label.trim())
                    : target,
                targetUrl: campaign.targetUrl,
              ),
              marketSlug: marketSlug,
              storeIdBySlug: storeIdBySlug,
            );
          },
        );
      case FeedCampaignKind.competitionCard:
        return ChallengeEventEditorialCard(
          campaign: campaign,
          listIndex: listIndex,
          onTap: openCampaign,
        );
      case FeedCampaignKind.rewardCard:
        return RewardsDiscoveryEditorialCard(
          campaign: campaign,
          listIndex: listIndex,
          onTap: openCampaign,
        );
      case FeedCampaignKind.storeFeature:
        return NewStoreStoryCard(
          campaign: campaign,
          listIndex: listIndex,
          onTap: openCampaign,
        );
      case FeedCampaignKind.offerStrip:
        return FloatingGlassPromoStrip(
          campaign: campaign,
          listIndex: listIndex,
          onTap: openCampaign,
        );
      default:
        return CustomBannerBlock(
          campaign: campaign,
          listIndex: listIndex,
          onTap: openCampaign,
        );
    }
  }

}

class _HomeCustomImageBanner extends StatelessWidget {
  const _HomeCustomImageBanner({
    required this.block,
    required this.marketSlug,
  });

  final HomePageBlock block;
  final String marketSlug;

  @override
  Widget build(BuildContext context) {
    final cfg = block.config;
    final imageUrl = resolveImageUrl(cfg['imageUrl']?.toString());
    final title = cfg['title']?.toString() ?? block.title;
    final subtitle = cfg['subtitle']?.toString() ?? '';
    final cta = cfg['ctaLabel']?.toString() ?? '';
    final targetUrl = cfg['targetUrl']?.toString() ?? '';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: targetUrl.isEmpty
            ? null
            : () {
                if (targetUrl.startsWith('/')) {
                  context.push(targetUrl);
                }
              },
        borderRadius: BorderRadius.circular(20),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(
            children: [
              if (imageUrl.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: imageUrl,
                  height: 108,
                  width: double.infinity,
                  fit: BoxFit.cover,
                )
              else
                Container(
                  height: 108,
                  color: NmdColors.brandPrimary.withValues(alpha: 0.15),
                ),
              Positioned(
                left: 16,
                right: 16,
                bottom: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (title.isNotEmpty)
                      Text(
                        title,
                        style: NmdTypography.h3.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          shadows: const [
                            Shadow(blurRadius: 6, color: Colors.black54),
                          ],
                        ),
                        textAlign: TextAlign.right,
                      ),
                    if (subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        style: NmdTypography.bodySmall
                            .copyWith(color: Colors.white70),
                        textAlign: TextAlign.right,
                      ),
                    if (cta.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          cta,
                          style: NmdTypography.label.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
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
    required this.homeFeedSettings,
    this.homePageBlocks = const [],
    this.builderActive = false,
  });
  final String marketName;
  final List<_BannerItem> banners;
  final List<_SectionItem> sections;
  final List<FeedCampaign> feedCampaigns;
  final HomeFeedSettings homeFeedSettings;
  final List<HomePageBlock> homePageBlocks;
  final bool builderActive;
}

class _BannerItem {
  const _BannerItem({required this.title, required this.imageUrl});
  final String title;
  final String imageUrl;
}

class _SectionItem {
  const _SectionItem({
    required this.id,
    required this.title,
    required this.storeIds,
  });
  final String id;
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
