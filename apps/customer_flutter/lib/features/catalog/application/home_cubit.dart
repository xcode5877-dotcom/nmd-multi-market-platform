import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../api/storefront_api.dart';
import '../data/pillar_nav_item.dart';
import '../data/sub_category_nav_item.dart';

enum HomeCategoriesStatus { initial, loading, loaded, failure }

enum TenantsStatus { initial, loading, loaded, failure }

class HomeCubitState extends Equatable {
  const HomeCubitState({
    this.pillarStatus = HomeCategoriesStatus.initial,
    this.pillars = const [],
    this.pillarErrorMessage,
    this.subCategoriesStatus = HomeCategoriesStatus.initial,
    this.subCategories = const [],
    this.subCategoriesForPillarId,
    this.tenantsStatus = TenantsStatus.initial,
    this.tenantMaps = const [],
    this.tenantsErrorMessage,
  });

  final HomeCategoriesStatus pillarStatus;
  final List<PillarNavItem> pillars;
  final String? pillarErrorMessage;

  /// Sub-filters for the selected pillar (`GET /sub-categories?pillarId=`).
  final HomeCategoriesStatus subCategoriesStatus;
  final List<SubCategoryNavItem> subCategories;
  final String? subCategoriesForPillarId;

  final TenantsStatus tenantsStatus;
  final List<Map<String, dynamic>> tenantMaps;
  final String? tenantsErrorMessage;

  HomeCubitState copyWith({
    HomeCategoriesStatus? pillarStatus,
    List<PillarNavItem>? pillars,
    String? pillarErrorMessage,
    HomeCategoriesStatus? subCategoriesStatus,
    List<SubCategoryNavItem>? subCategories,
    String? subCategoriesForPillarId,
    TenantsStatus? tenantsStatus,
    List<Map<String, dynamic>>? tenantMaps,
    String? tenantsErrorMessage,
  }) {
    return HomeCubitState(
      pillarStatus: pillarStatus ?? this.pillarStatus,
      pillars: pillars ?? this.pillars,
      pillarErrorMessage: pillarErrorMessage ?? this.pillarErrorMessage,
      subCategoriesStatus: subCategoriesStatus ?? this.subCategoriesStatus,
      subCategories: subCategories ?? this.subCategories,
      subCategoriesForPillarId:
          subCategoriesForPillarId ?? this.subCategoriesForPillarId,
      tenantsStatus: tenantsStatus ?? this.tenantsStatus,
      tenantMaps: tenantMaps ?? this.tenantMaps,
      tenantsErrorMessage: tenantsErrorMessage ?? this.tenantsErrorMessage,
    );
  }

  @override
  List<Object?> get props => [
        pillarStatus,
        pillars,
        pillarErrorMessage,
        subCategoriesStatus,
        subCategories,
        subCategoriesForPillarId,
        tenantsStatus,
        tenantMaps,
        tenantsErrorMessage,
      ];
}

/// Pillars: `GET /pillars`. Sub-categories: `GET /sub-categories?pillarId=`. Tenants: `GET /markets/:id/tenants` with `pillar_id` / `sub_category_id` (web [MarketSectionPage] parity).
final class HomeCubit extends Cubit<HomeCubitState> {
  HomeCubit(this._dio) : super(const HomeCubitState());

  final Dio _dio;

  StorefrontApi get _api => StorefrontApi(_dio);

  int _tenantSyncGeneration = 0;

  Future<void> loadPillars() async {
    emit(state.copyWith(
        pillarStatus: HomeCategoriesStatus.loading, pillarErrorMessage: null));
    try {
      final response = await _dio.get<dynamic>(
        '/pillars',
        queryParameters: {
          '_t': DateTime.now().millisecondsSinceEpoch.toString()
        },
      );
      final raw = response.data;
      final List<dynamic> list;
      if (raw is List) {
        list = raw;
      } else if (raw is Map && raw['data'] is List) {
        list = raw['data'] as List<dynamic>;
      } else {
        list = const [];
      }
      final rows = list
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      rows.sort((a, b) {
        final sa = a['sortOrder'] ?? a['sort_order'];
        final sb = b['sortOrder'] ?? b['sort_order'];
        final ia = sa is num ? sa.toInt() : 999;
        final ib = sb is num ? sb.toInt() : 999;
        return ia.compareTo(ib);
      });
      final items = rows
          .map(PillarNavItem.fromJson)
          .where((p) => p.id.isNotEmpty && p.titleAr.isNotEmpty)
          .toList();
      emit(state.copyWith(
        pillarStatus: HomeCategoriesStatus.loaded,
        pillars: items,
      ));
    } catch (e) {
      emit(state.copyWith(
        pillarStatus: HomeCategoriesStatus.failure,
        pillars: const [],
        pillarErrorMessage: e.toString(),
      ));
    }
  }

  Future<void> _loadTenantsForMarket(
    String marketSlug, {
    String? pillarId,
    String? subCategoryId,
  }) async {
    final gen = ++_tenantSyncGeneration;
    final p = pillarId?.trim();
    final sub = subCategoryId?.trim();

    final samePillarAsBefore = p != null &&
        p.isNotEmpty &&
        state.subCategoriesForPillarId == p &&
        state.subCategories.isNotEmpty;

    emit(HomeCubitState(
      pillarStatus: state.pillarStatus,
      pillars: state.pillars,
      pillarErrorMessage: state.pillarErrorMessage,
      subCategoriesStatus: samePillarAsBefore
          ? state.subCategoriesStatus
          : (p != null && p.isNotEmpty
              ? HomeCategoriesStatus.loading
              : HomeCategoriesStatus.initial),
      subCategories: samePillarAsBefore
          ? state.subCategories
          : (p != null && p.isNotEmpty ? const [] : const []),
      subCategoriesForPillarId: p,
      tenantsStatus: TenantsStatus.loading,
      tenantMaps: const [],
      tenantsErrorMessage: null,
    ));

    try {
      final market = await _api.getMarketBySlug(marketSlug);
      final marketId = market['id']?.toString();
      if (marketId == null || marketId.isEmpty) {
        throw Exception('Market missing');
      }

      // Tenants first — never blocked by /sub-categories failing or being slow.
      final list = await _api.getMarketTenants(
        marketId,
        pillarId: p?.isNotEmpty == true ? p : null,
        subCategoryId: sub != null && sub.isNotEmpty ? sub : null,
      );

      List<SubCategoryNavItem> subs = const [];
      if (p != null && p.isNotEmpty) {
        try {
          subs = await _api.getSubCategories(pillarId: p);
        } catch (_) {
          subs = const [];
        }
      }

      if (gen != _tenantSyncGeneration) return;
      emit(HomeCubitState(
        pillarStatus: state.pillarStatus,
        pillars: state.pillars,
        pillarErrorMessage: state.pillarErrorMessage,
        subCategoriesStatus: p != null && p.isNotEmpty
            ? HomeCategoriesStatus.loaded
            : HomeCategoriesStatus.initial,
        subCategories: subs,
        subCategoriesForPillarId: p,
        tenantsStatus: TenantsStatus.loaded,
        tenantMaps: list,
        tenantsErrorMessage: null,
      ));
    } catch (e) {
      if (gen != _tenantSyncGeneration) return;
      emit(HomeCubitState(
        pillarStatus: state.pillarStatus,
        pillars: state.pillars,
        pillarErrorMessage: state.pillarErrorMessage,
        subCategoriesStatus: HomeCategoriesStatus.failure,
        subCategories: const [],
        subCategoriesForPillarId: p,
        tenantsStatus: TenantsStatus.failure,
        tenantMaps: const [],
        tenantsErrorMessage: e.toString(),
      ));
    }
  }

  Future<void> filterTenantsByPillar(String marketSlug, String pillarId) async {
    final id = pillarId.trim();
    if (id.isEmpty) return;
    emit(state.copyWith(
        tenantMaps: const [],
        tenantsStatus: TenantsStatus.loading,
        tenantsErrorMessage: null));
    await _loadTenantsForMarket(marketSlug, pillarId: id, subCategoryId: null);
  }

  /// Sub-chip tap — same as web `selectedSubId` filter (`subCategoryId` on tenant).
  Future<void> filterTenantsBySubCategory(
    String marketSlug,
    String pillarId,
    String subCategoryId,
  ) async {
    final pid = pillarId.trim();
    final sid = subCategoryId.trim();
    if (pid.isEmpty || sid.isEmpty) return;
    emit(state.copyWith(
        tenantMaps: const [],
        tenantsStatus: TenantsStatus.loading,
        tenantsErrorMessage: null));
    await _loadTenantsForMarket(marketSlug, pillarId: pid, subCategoryId: sid);
  }

  /// "الكل" within a pillar — all stores in that pillar, any sub-category.
  Future<void> clearSubCategoryFilter(
      String marketSlug, String pillarId) async {
    final id = pillarId.trim();
    if (id.isEmpty) return;
    emit(state.copyWith(
        tenantMaps: const [],
        tenantsStatus: TenantsStatus.loading,
        tenantsErrorMessage: null));
    await _loadTenantsForMarket(marketSlug, pillarId: id, subCategoryId: null);
  }

  Future<void> clearTenantPillarFilter(String marketSlug) async {
    emit(state.copyWith(
        tenantMaps: const [],
        tenantsStatus: TenantsStatus.loading,
        tenantsErrorMessage: null));
    await _loadTenantsForMarket(marketSlug,
        pillarId: null, subCategoryId: null);
  }

  Future<void> syncTenantsForMarket(
    String marketSlug, {
    String? pillarId,
    String? subCategoryId,
  }) async {
    emit(state.copyWith(
        tenantMaps: const [],
        tenantsStatus: TenantsStatus.loading,
        tenantsErrorMessage: null));
    await _loadTenantsForMarket(
      marketSlug,
      pillarId: pillarId?.trim(),
      subCategoryId: subCategoryId?.trim(),
    );
  }

  Future<void> load() => loadPillars();
}
