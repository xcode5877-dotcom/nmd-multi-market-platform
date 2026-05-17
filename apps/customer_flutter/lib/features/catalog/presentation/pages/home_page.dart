import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../contest/presentation/widgets/contest_popup_sheet.dart';
import '../../application/home_cubit.dart';
import '../../data/pillar_nav_item.dart';
import '../../../../widgets/global_nmd_header.dart';
import '../../../../widgets/nmd_search_bar.dart';

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
    final api = StorefrontApi(context.read<Dio>());
    final slug = widget.slug;
    final market = await api.getMarketBySlug(slug);
    final marketId = market['id']?.toString();
    if (marketId == null || marketId.isEmpty) throw Exception('Market missing');

    final sectionsRaw = await api.getMarketLayout(slug);
    final bannersRaw = await api.getMarketBanners(slug);
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

    return _HomeLayoutPayload(
      banners: banners,
      sections: sections,
    );
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
      color: Colors.white,
      child: Column(
        children: [
          GlobalNmdHeader(
            marketSlug: widget.slug,
            onLeadingPressed: () => context.go('/main'),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
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
                if (!snap.hasData) {
                  return const Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primaryTeal));
                }
                final layout = snap.data!;
                _scheduleContestPopupAfterLayoutReady();
                return BlocBuilder<HomeCubit, HomeCubitState>(
                  builder: (context, cState) {
                    if (cState.tenantsStatus == TenantsStatus.failure) {
                      return Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                cState.tenantsErrorMessage ??
                                    'تعذر تحميل المحلات',
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              TextButton(
                                onPressed: () {
                                  _tenantSyncToken = null;
                                  final pillar = GoRouterState.of(context)
                                      .uri
                                      .queryParameters['pillar'];
                                  final sub = GoRouterState.of(context)
                                      .uri
                                      .queryParameters['sub'];
                                  context
                                      .read<HomeCubit>()
                                      .syncTenantsForMarket(
                                        widget.slug,
                                        pillarId: pillar?.trim(),
                                        subCategoryId: sub?.trim(),
                                      );
                                },
                                child: const Text('إعادة المحاولة'),
                              ),
                            ],
                          ),
                        ),
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
                          SliverToBoxAdapter(
                            child: _FilteredPillarStoreList(
                              marketSlug: widget.slug,
                              sectionTitle: flatTitle,
                              stores: flatStores,
                            ),
                          ),
                          if (flatStores.isEmpty)
                            SliverToBoxAdapter(
                              child: Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(24, 24, 24, 16),
                                child: Text(
                                  'لا توجد محلات في هذا القسم.',
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: const Color(0xFF6B7280),
                                      ),
                                ),
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
                        ...layout.sections.map(
                          (section) => SliverToBoxAdapter(
                            child: _StoreSection(
                              marketSlug: widget.slug,
                              section: section,
                              storesById: storesById,
                              storesBySlug: storesBySlug,
                              query: _query,
                            ),
                          ),
                        ),
                        if (layout.sections.isNotEmpty && !hasVisibleStore)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding:
                                  const EdgeInsets.fromLTRB(24, 32, 24, 16),
                              child: Text(
                                'لا توجد محلات في هذا التصنيف ضمن أقسام الصفحة.',
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      color: const Color(0xFF6B7280),
                                    ),
                              ),
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
      color: Colors.white,
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
                    baseColor: const Color(0xFFE5E7EB),
                    highlightColor: Colors.white,
                    child: Container(
                      width: 58,
                      height: 58,
                      decoration: const BoxDecoration(
                        color: Color(0xFFE5E7EB),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Shimmer.fromColors(
                    baseColor: const Color(0xFFE5E7EB),
                    highlightColor: Colors.white,
                    child: Container(
                      width: 56,
                      height: 12,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE5E7EB),
                        borderRadius: BorderRadius.circular(6),
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
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Shimmer.fromColors(
            baseColor: const Color(0xFFE5E7EB),
            highlightColor: Colors.white,
            child: Container(
              height: 18,
              width: 140,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(6),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 212,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              primary: false,
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: 4,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, __) => Shimmer.fromColors(
                baseColor: const Color(0xFFE5E7EB),
                highlightColor: Colors.white,
                child: Container(
                  width: 144,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(12),
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
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Text(
              state.pillarErrorMessage ?? 'تعذر تحميل الأعمدة',
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: const Color(0xFFDC2626)),
            ),
          );
        }
        if (state.pillars.isEmpty) {
          return const SizedBox.shrink();
        }
        return ColoredBox(
          color: Colors.white,
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
                  // RTL: start = physical right — first pillar flush to the right edge.
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
                        borderRadius: BorderRadius.circular(14),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 58,
                                height: 58,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    width: selected ? 2.5 : 1,
                                    color: selected
                                        ? AppColors.primaryTeal
                                        : const Color(0xFFE5E7EB),
                                  ),
                                  boxShadow: selected
                                      ? [
                                          BoxShadow(
                                            color: AppColors.primaryTeal
                                                .withValues(alpha: 0.28),
                                            blurRadius: 10,
                                            offset: const Offset(0, 3),
                                          ),
                                        ]
                                      : null,
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
                                  style: GoogleFonts.cairo(
                                    fontWeight: selected
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    fontSize: 11,
                                    height: 1.15,
                                    color: selected
                                        ? AppColors.primaryTeal
                                        : const Color(0xFF111827),
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
          color: const Color(0xFFF8FAFC),
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
                      _SubCategoryChip(
                        label: 'الكل',
                        selected: selectedSubId == null ||
                            selectedSubId.trim().isEmpty,
                        compact: true,
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
                          _SubCategoryChip(
                            label: sub.titleAr,
                            compact: true,
                            selected:
                                (selectedSubId ?? '').trim() == sub.id.trim(),
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
      color: const Color(0xFFF8FAFC),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 8, 10),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            child: Shimmer.fromColors(
              baseColor: const Color(0xFFE5E7EB),
              highlightColor: Colors.white,
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
                        color: const Color(0xFFE5E7EB),
                        borderRadius: BorderRadius.circular(999),
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

class _SubCategoryChip extends StatelessWidget {
  const _SubCategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.compact = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: EdgeInsets.symmetric(
              horizontal: compact ? 12 : 14, vertical: compact ? 6 : 8),
          constraints: const BoxConstraints(minHeight: 32),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primaryTeal.withValues(alpha: 0.12)
                : Colors.white,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected
                  ? AppColors.primaryTeal.withValues(alpha: 0.35)
                  : const Color(0xFFE5E7EB),
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.cairo(
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? AppColors.primaryTeal : const Color(0xFF374151),
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
                  strokeWidth: 2, color: AppColors.primaryTeal),
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
                strokeWidth: 2, color: AppColors.primaryTeal),
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
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: CarouselSlider.builder(
        itemCount: banners.length,
        itemBuilder: (_, i, __) {
          final b = banners[i];
          return ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Hero(
                  tag: 'home-banner-$i-${b.imageUrl}',
                  child: Image.network(
                    b.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        Container(color: AppColors.primaryTeal),
                  ),
                ),
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x20000000), Color(0xB0000000)],
                    ),
                  ),
                ),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Text(
                      b.title,
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                              ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
        options: CarouselOptions(
          height: 190,
          viewportFraction: 1,
          autoPlay: true,
          autoPlayInterval: const Duration(seconds: 5),
        ),
      ),
    );
  }
}

/// Pillar/sub active: one flat horizontal list (web section page parity) — no admin layout sections.
class _FilteredPillarStoreList extends StatelessWidget {
  const _FilteredPillarStoreList({
    required this.marketSlug,
    required this.sectionTitle,
    required this.stores,
  });

  final String marketSlug;
  final String sectionTitle;
  final List<_StoreItem> stores;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Text(
              sectionTitle,
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFF111827),
                    fontWeight: FontWeight.w900,
                  ),
            ),
          ),
          SizedBox(
            height: 212,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                primary: false,
                shrinkWrap: true,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsetsDirectional.only(start: 16, end: 16),
                itemCount: stores.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, i) =>
                    _StoreCard(marketSlug: marketSlug, store: stores[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StoreSection extends StatelessWidget {
  const _StoreSection({
    required this.marketSlug,
    required this.section,
    required this.storesById,
    required this.storesBySlug,
    required this.query,
  });
  final String marketSlug;
  final _SectionItem section;
  final Map<String, _StoreItem> storesById;
  final Map<String, _StoreItem> storesBySlug;
  final String query;

  @override
  Widget build(BuildContext context) {
    final sectionTitleMatch =
        query.isNotEmpty && section.title.toLowerCase().contains(query);
    final stores = section.storeIds
        .map((id) => storesById[id] ?? storesBySlug[id])
        .whereType<_StoreItem>()
        .where((s) => sectionTitleMatch || _matchesStoreQuery(s, query))
        .toList();
    if (stores.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
            child: Text(
              section.title,
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFF111827),
                    fontWeight: FontWeight.w900,
                  ),
            ),
          ),
          SizedBox(
            height: 212,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                primary: false,
                shrinkWrap: true,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsetsDirectional.only(start: 16, end: 16),
                itemCount: stores.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, i) => _StoreCard(
                  marketSlug: marketSlug,
                  store: stores[i],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StoreCard extends StatelessWidget {
  const _StoreCard({required this.marketSlug, required this.store});
  final String marketSlug;
  final _StoreItem store;

  @override
  Widget build(BuildContext context) {
    final status = _storeStatusMeta(store.openStatus);

    return SizedBox(
      width: 144,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.push('/market/$marketSlug/store/${store.id}'),
          borderRadius: BorderRadius.circular(12),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x08000000),
                    blurRadius: 4,
                    offset: Offset(0, 1)),
              ],
            ),
            child: Column(
              children: [
                Container(
                  height: 108,
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(12)),
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Hero(
                          tag: 'store-logo-${store.id}',
                          child: Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border:
                                  Border.all(color: const Color(0xFFE5E7EB)),
                            ),
                            child: ClipOval(
                              child: Image.network(
                                store.logoUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    const ColoredBox(color: Colors.white),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        right: 6,
                        top: 6,
                        child: _StoreStatusBadge(
                          label: status.$1,
                          color: status.$2,
                          pulsing: store.openStatus.toLowerCase() == 'open',
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 10, 8, 2),
                  child: Text(
                    store.name,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    _categoryLabel(store.category),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF6B7280),
                        ),
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

bool _matchesStoreQuery(_StoreItem s, String query) {
  if (query.isEmpty) return true;
  final q = query;
  if (s.name.toLowerCase().contains(q)) return true;
  final cat = s.category.toLowerCase();
  if (cat.contains(q)) return true;
  if (_categoryLabel(s.category).toLowerCase().contains(q)) return true;
  return false;
}

(String, Color) _storeStatusMeta(String raw) {
  switch (raw.toLowerCase()) {
    case 'open':
      return ('مفتوح الآن', const Color(0xFF16A34A));
    case 'busy':
      return ('مشغول - قد يتأخر الطلب', const Color(0xFFF59E0B));
    default:
      return ('مغلق حالياً', const Color(0xFFDC2626));
  }
}

class _StoreStatusBadge extends StatefulWidget {
  const _StoreStatusBadge({
    required this.label,
    required this.color,
    required this.pulsing,
  });

  final String label;
  final Color color;
  final bool pulsing;

  @override
  State<_StoreStatusBadge> createState() => _StoreStatusBadgeState();
}

class _StoreStatusBadgeState extends State<_StoreStatusBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dot = Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          widget.pulsing
              ? AnimatedBuilder(
                  animation: _pulse,
                  builder: (_, __) => Transform.scale(
                    scale: 0.9 + (_pulse.value * 0.2),
                    child: dot,
                  ),
                )
              : dot,
          const SizedBox(width: 5),
          Text(
            widget.label,
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w700, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

String _categoryLabel(String raw) {
  final code = raw.toUpperCase();
  if (code == 'FOOD') return 'مطاعم';
  if (code == 'CLOTHING') return 'ملابس';
  if (code == 'GROCERIES') return 'خضار';
  if (code == 'BUTCHER') return 'ملحمة';
  if (code == 'OFFERS') return 'عروض';
  if (raw.isEmpty) return 'عام';
  return raw;
}

class _HomeLayoutPayload {
  const _HomeLayoutPayload({
    required this.banners,
    required this.sections,
  });
  final List<_BannerItem> banners;
  final List<_SectionItem> sections;
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
