import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lottie/lottie.dart';

import '../../../../core/auth/auth_failure.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../core/errors/app_error_mapper.dart';
import '../../../../widgets/app_error_view.dart';
import '../../../../design_system/design_system.dart';
import '../../../../core/network/token_storage.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../cart/application/cart_cubit.dart';
import '../../../../measurement/measurement.dart';
import '../../../../api/storefront_api.dart';
import '../../../../api/models/product.dart';
import '../../../catalog/application/service_lead_actions.dart';
import '../../../catalog/data/tenant_contact_info.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import '../../../loyalty/presentation/loyalty_coins_celebration.dart';
import '../../application/orders_cubit.dart';
import '../../domain/customer_order_vm.dart';
import '../widgets/order_status_badge.dart';
import '../widgets/order_timeline_sheet.dart';
import '../widgets/store_order_tracking_panel.dart';

const _arMonths = [
  '',
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

enum _OrderBucket { active, completed, canceled }

bool _isTerminalOrderStatus(String? status) {
  final s = (status ?? '').toUpperCase();
  return s == 'DELIVERED' ||
      s == 'COMPLETED' ||
      s == 'CANCELLED' ||
      s == 'CANCELED';
}

/// نشطة: store/market lines only, while preparing or in transit (incl. READY + delivery states).
bool _isStoreActivePipelineStatus(String? status) {
  final s = (status ?? '').toUpperCase();
  switch (s) {
    case 'PREPARING':
    case 'READY':
    case 'OUT_FOR_DELIVERY':
    case 'PICKED_UP':
    case 'RECEIVED_FROM_STORE':
    case 'ON_THE_WAY':
    case 'IN_PROGRESS':
      return true;
    default:
      return false;
  }
}

/// First store line that should show live tracking (no leads / Royal Drip; not terminal).
CustomerOrderVm? _trackingOrderForGroup(CustomerOrderGroup g) {
  for (final o in g.orders) {
    if (o.suppressesDeliveryTracking) continue;
    if (!_isTerminalOrderStatus(o.status)) return o;
  }
  return null;
}

_OrderBucket _bucketForGroup(CustomerOrderGroup g) {
  final allCanceled = g.orders.every((o) {
    final s = (o.status ?? '').toUpperCase();
    return s == 'CANCELLED' || s == 'CANCELED';
  });
  if (allCanceled) return _OrderBucket.canceled;

  // SERVICE orders: always مكتملة — never نشطة (see [CustomerOrderVm.isServiceOrder]).
  if (g.orders.any((o) => o.isServiceOrder)) {
    return _OrderBucket.completed;
  }

  final allDone = g.orders.every((o) {
    final s = (o.status ?? '').toUpperCase();
    return s == 'DELIVERED' || s == 'COMPLETED';
  });
  if (allDone) return _OrderBucket.completed;

  final anyPipeline =
      g.orders.any((o) => _isStoreActivePipelineStatus(o.status));
  if (anyPipeline) return _OrderBucket.active;

  // e.g. NEW / PENDING / CONFIRMED — not shown under نشطة.
  return _OrderBucket.completed;
}

String shortOrderId(String id) {
  final alnum = id.replaceAll(RegExp(r'[^A-Za-z0-9]'), '');
  if (alnum.isEmpty) return '#—';
  final tail = alnum.length <= 6 ? alnum : alnum.substring(alnum.length - 6);
  return '#${tail.toUpperCase()}';
}

String? _paymentMethodLabelAr(CustomerOrderVm order) {
  final p = (order.raw['paymentMethod'] ?? order.raw['payment']?['method'])
      ?.toString()
      .toUpperCase();
  if (p == null || p.isEmpty) return null;
  if (p == 'CARD') return 'بطاقة';
  if (p == 'CASH') return 'نقداً';
  return null;
}

String _fulfillmentLabelAr(String? fulfillmentType) {
  final t = (fulfillmentType ?? '').toUpperCase();
  return t == 'PICKUP' ? 'استلام' : 'توصيل';
}

String _formatOrderDate(CustomerOrderVm? order) {
  if (order == null || !order.hasReliableCreatedAt) return '';
  final d = order.createdAt!;
  return '${d.day}/${d.month}/${d.year}';
}

String _stickyDateLabel(DateTime day, DateTime now) {
  if (day.year <= 1970 || day.month < 1 || day.month > 12) {
    return '';
  }
  final t = DateTime(now.year, now.month, now.day);
  final y = t.subtract(const Duration(days: 1));
  final d = DateTime(day.year, day.month, day.day);
  if (d == t) return 'اليوم';
  if (d == y) return 'أمس';
  return '${day.day} ${_arMonths[day.month]} ${day.year}';
}

/// Day keys come only from [CustomerOrderGroup.sortDate] (requires [CustomerOrderVm.hasReliableCreatedAt]).
List<({DateTime? day, List<CustomerOrderGroup> groups})> _groupsByDay(
  List<CustomerOrderGroup> groups,
) {
  final dated = <DateTime, List<CustomerOrderGroup>>{};
  final undated = <CustomerOrderGroup>[];
  for (final g in groups) {
    final sd = g.sortDate;
    if (sd == null) {
      undated.add(g);
      continue;
    }
    final day = DateTime(sd.year, sd.month, sd.day);
    dated.putIfAbsent(day, () => []).add(g);
  }
  final keys = dated.keys.toList()..sort((a, b) => b.compareTo(a));
  final out = <({DateTime? day, List<CustomerOrderGroup> groups})>[
    for (final k in keys) (day: k, groups: dated[k]!),
  ];
  if (undated.isNotEmpty) {
    out.add((day: null, groups: undated));
  }
  return out;
}

class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    final token = await context.read<TokenStorage>().getCustomerToken();
    if (!mounted) return;
    if (token == null || token.trim().isEmpty) {
      context.read<OrdersCubit>().reportLoginRequired();
      return;
    }
    await context.read<OrdersCubit>().load();
  }

  /// Sync coins after orders load and show celebration when balance increased.
  /// Used after pull-to-refresh as well: [OrdersCubit] may skip emitting if state is
  /// unchanged, so [BlocListener] alone would not always run.
  Future<void> _syncCoinsAfterOrdersLoad(BuildContext context) async {
    final coins = context.read<CoinsBalanceCubit>();
    final before = coins.state.balance;
    await coins.load();
    if (!context.mounted) return;
    final after = context.read<CoinsBalanceCubit>().state.balance;
    if (before != null && after != null && after > before) {
      showLoyaltyCoinsCelebration(
        context,
        coinsEarned: after - before,
      );
    }
  }

  Future<void> _onOrdersLoad() async {
    await context.read<OrdersCubit>().load();
    if (!mounted) return;
    if (context.read<OrdersCubit>().state.status == OrdersStatus.success) {
      await _syncCoinsAfterOrdersLoad(context);
    }
  }

  Future<void> _reorderGroup(CustomerOrderGroup group) async {
    final cart = context.read<CartCubit>();
    final dio = context.read<Dio>();
    final api = StorefrontApi(dio);
    final catalogByTenant = <String, Map<String, Product>>{};
    var addedLines = 0;
    var blockedLines = 0;
    String? blockedTenantId;
    String? blockedProductId;
    for (final o in group.orders) {
      final items = o.items;
      if (items == null) continue;
      if (!catalogByTenant.containsKey(o.tenantId)) {
        try {
          final products = await api.getCatalogProducts(o.tenantId);
          catalogByTenant[o.tenantId] = {for (final p in products) p.id: p};
        } catch (_) {
          catalogByTenant[o.tenantId] = {};
        }
      }
      final catalog = catalogByTenant[o.tenantId]!;
      for (final raw in items) {
        if (raw is! Map) continue;
        final m = Map<String, dynamic>.from(raw);
        final pid = m['productId']?.toString() ?? '';
        if (pid.isEmpty) continue;
        final catalogProduct = catalog[pid];
        if (catalogProduct != null && !catalogProduct.canAddToCart) {
          blockedLines++;
          blockedTenantId ??= o.tenantId;
          blockedProductId ??= pid;
          continue;
        }
        final check = evaluateReorderLine(
          orderItem: m,
          currentCatalogMeasurement: catalogProduct?.measurement,
        );
        if (check.blocked) {
          blockedLines++;
          blockedTenantId ??= o.tenantId;
          blockedProductId ??= pid;
          continue;
        }
        final qty = check.quantity!;
        final measurement = check.measurement!;
        final unit = _reorderUnitPrice(m, qty);
        cart.addOrIncrement(
          tenantId: o.tenantId,
          productId: pid,
          name: m['productName']?.toString() ??
              catalogProduct?.name ??
              'منتج',
          unitPrice: catalogProduct?.customerListPrice ?? unit,
          merchantUnitPrice: catalogProduct?.basePrice ?? unit,
          imageUrl: m['imageUrl']?.toString() ??
              catalogProduct?.imageUrl ??
              '',
          addQty: qty,
          measurement: measurement,
        );
        addedLines++;
      }
    }
    if (!mounted) return;
    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';
    void openBlockedProduct() {
      if (slug.isEmpty ||
          blockedTenantId == null ||
          blockedProductId == null) {
        return;
      }
      context.push(
        '/market/$slug/store/$blockedTenantId/product/$blockedProductId',
      );
    }

    if (addedLines == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            blockedLines > 0
                ? kReorderConfigChangedAr
                : 'لا توجد أصناف متاحة لإعادة الطلب',
            style: GoogleFonts.cairo(),
          ),
          action: blockedLines > 0 &&
                  blockedTenantId != null &&
                  blockedProductId != null &&
                  slug.isNotEmpty
              ? SnackBarAction(
                  label: 'اختيار كمية',
                  onPressed: openBlockedProduct,
                )
              : null,
        ),
      );
      return;
    }
    final msg = blockedLines > 0
        ? 'أُضيفت بعض المنتجات. $kReorderConfigChangedAr'
        : 'تمت إضافة المنتجات إلى السلة';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.cairo()),
        action: blockedLines > 0 &&
                blockedTenantId != null &&
                blockedProductId != null &&
                slug.isNotEmpty
            ? SnackBarAction(
                label: 'اختيار كمية',
                onPressed: openBlockedProduct,
              )
            : null,
      ),
    );
  }

  double _reorderUnitPrice(Map<String, dynamic> m, String qty) {
    if (m['basePrice'] is num) {
      return (m['basePrice'] as num).toDouble();
    }
    final tp = (m['totalPrice'] as num?)?.toDouble() ?? 0;
    final q = parseMeasurementDecimalStrict(qty);
    if (!q.ok || q.milli <= 0) return tp;
    final totalAgora = shekelsToAgora(tp) ?? 0;
    return agoraToShekels((totalAgora * kMeasurementScale) ~/ q.milli);
  }

  Future<void> _contactStore(CustomerOrderVm order) async {
    final digits = order.tenantWhatsappDigits?.trim();
    if (digits == null || digits.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('لا يتوفر واتساب لهذا المتجر',
                style: GoogleFonts.cairo())),
      );
      return;
    }
    final dio = context.read<Dio>();
    final auth = context.read<AuthBloc>().state;
    final phone = auth.step == AuthStep.done ? auth.phone : null;
    final contact =
        TenantContactInfo(whatsappDigits: digits, phoneDigits: digits);
    final sid = shortOrderId(order.id);
    await launchWhatsAppInquiry(
      dio: dio,
      tenantId: order.tenantId,
      contact: contact,
      tenantContact: contact,
      serviceName: 'متابعة الطلب $sid',
      messageOverride: 'السلام عليكم، أود متابعة طلبي رقم $sid',
      customerPhone: phone,
      context: context,
    );
  }

  List<CustomerOrderGroup> _filter(
    List<CustomerOrderGroup> all,
    _OrderBucket bucket,
  ) {
    return all.where((g) => _bucketForGroup(g) == bucket).toList();
  }

  @override
  Widget build(BuildContext context) {
    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: ColoredBox(
        color: NmdColors.surfaceMuted,
        child: Scaffold(
          backgroundColor: NmdColors.surfaceMuted,
          body: BlocListener<OrdersCubit, OrdersState>(
            listenWhen: (p, c) =>
                c.status == OrdersStatus.success &&
                p.status == OrdersStatus.loading,
            listener: (context, state) async {
              await _syncCoinsAfterOrdersLoad(context);
            },
            child: BlocBuilder<OrdersCubit, OrdersState>(
              builder: (context, state) {
                if (state.status == OrdersStatus.initial ||
                    state.status == OrdersStatus.loading) {
                  return const NmdLoading(
                    fullscreen: true,
                    message: 'جاري تحميل طلباتك...',
                  );
                }
                if (state.status == OrdersStatus.loginRequired) {
                  return _AuthGate(
                    title: kLoginRequiredMessage,
                    subtitle:
                        'سجّل دخولك لعرض طلباتك ومتابعة حالتها بكل وضوح.',
                    onShop: () => context.go('/market/$slug'),
                    onLogin: () async {
                      final ok = await ensureCustomerAuth(context);
                      if (!context.mounted || !ok) return;
                      await context.read<OrdersCubit>().load();
                    },
                  );
                }
                if (state.status == OrdersStatus.sessionExpired) {
                  return _AuthGate(
                    title: kSessionExpiredMessage,
                    subtitle: kSessionExpiredMessage,
                    onShop: () => context.go('/market/$slug'),
                    onLogin: () async {
                      final ok = await handleSessionExpired(context);
                      if (!context.mounted || !ok) return;
                      await context.read<OrdersCubit>().load();
                    },
                  );
                }
                if (state.status == OrdersStatus.error) {
                  return AppErrorView(
                    title: 'تعذّر تحميل الطلبات',
                    message: state.message ?? AppErrorMapper.unknownMessage,
                    compact: true,
                    onRetry: () => context.read<OrdersCubit>().load(),
                  );
                }
                if (state.status == OrdersStatus.empty) {
                  return RefreshIndicator(
                    color: NmdColors.brandPrimary,
                    onRefresh: () async {
                      await context.read<OrdersCubit>().load();
                      if (!context.mounted) return;
                      if (context.read<OrdersCubit>().state.status ==
                          OrdersStatus.success) {
                        await _syncCoinsAfterOrdersLoad(context);
                      }
                    },
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: SizedBox(
                        height: MediaQuery.sizeOf(context).height * 0.75,
                        child: _EmptyOrders(
                          onShop: () => context.go('/market/$slug'),
                          title: 'لا توجد طلبات بعد',
                          subtitle:
                              'ابدأ التسوق وستظهر طلباتك هنا — نرافقك في كل خطوة.',
                          showCta: true,
                        ),
                      ),
                    ),
                  );
                }

                final all = state.groups;
                return DefaultTabController(
                  length: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const NmdSectionHeader(
                        title: 'طلباتي',
                        subtitle: 'تابع طلباتك بكل وضوح واطمئنان',
                        padding: EdgeInsets.fromLTRB(
                          NmdSpacing.screenHorizontal,
                          NmdSpacing.sm,
                          NmdSpacing.screenHorizontal,
                          0,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          NmdSpacing.screenHorizontal,
                          NmdSpacing.xs,
                          NmdSpacing.screenHorizontal,
                          NmdSpacing.sm,
                        ),
                        child: _OrdersTabBar(),
                      ),
                      Expanded(
                        child: TabBarView(
                          children: [
                            _OrdersCategoryScroll(
                              bucket: _OrderBucket.active,
                              groups: _filter(all, _OrderBucket.active),
                              slug: slug,
                              emptyTitle: 'لا طلبات نشطة',
                              emptySubtitle:
                                  'عندما تكون لديك طلبات قيد التنفيذ ستظهر هنا.',
                              emptyShowShopCta: true,
                              onReorder: _reorderGroup,
                              onContactStore: _contactStore,
                              onLoad: _onOrdersLoad,
                            ),
                            _OrdersCategoryScroll(
                              bucket: _OrderBucket.completed,
                              groups: _filter(all, _OrderBucket.completed),
                              slug: slug,
                              emptyTitle: 'لا طلبات مكتملة بعد',
                              emptySubtitle:
                                  'ستجد هنا الطلبات التي تم توصيلها أو استلامها.',
                              emptyShowShopCta: true,
                              onReorder: _reorderGroup,
                              onContactStore: _contactStore,
                              onLoad: _onOrdersLoad,
                            ),
                            _OrdersCategoryScroll(
                              bucket: _OrderBucket.canceled,
                              groups: _filter(all, _OrderBucket.canceled),
                              slug: slug,
                              emptyTitle: 'لا طلبات ملغاة',
                              emptySubtitle:
                                  'الطلبات التي تم إلغاؤها تظهر في هذا التبويب.',
                              emptyShowShopCta: false,
                              onReorder: _reorderGroup,
                              onContactStore: _contactStore,
                              onLoad: _onOrdersLoad,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _OrdersTabBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return NmdSurface(
      mode: NmdSurfaceMode.commerce,
      padding: const EdgeInsets.all(4),
      child: TabBar(
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorPadding: const EdgeInsets.all(4),
        labelPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
        indicator: BoxDecoration(
          borderRadius: NmdRadius.borderSm,
          color: NmdColors.tintAliveSoft,
          border: Border.all(
            color: NmdColors.brandPrimary.withValues(alpha: 0.2),
          ),
        ),
        splashBorderRadius: NmdRadius.borderSm,
        overlayColor: WidgetStateProperty.all(Colors.transparent),
        labelColor: NmdColors.brandPrimary,
        unselectedLabelColor: NmdColors.textSecondary,
        labelStyle: NmdTypography.label.copyWith(fontWeight: FontWeight.w900),
        unselectedLabelStyle:
            NmdTypography.label.copyWith(fontWeight: FontWeight.w600),
        dividerColor: Colors.transparent,
        tabs: const [
          Tab(text: 'نشطة'),
          Tab(text: 'مكتملة'),
          Tab(text: 'ملغاة'),
        ],
      ),
    );
  }
}

class _OrdersCategoryScroll extends StatelessWidget {
  const _OrdersCategoryScroll({
    required this.bucket,
    required this.groups,
    required this.slug,
    required this.emptyTitle,
    required this.emptySubtitle,
    this.emptyShowShopCta = true,
    required this.onReorder,
    required this.onContactStore,
    required this.onLoad,
  });

  final _OrderBucket bucket;
  final List<CustomerOrderGroup> groups;
  final String slug;
  final String emptyTitle;
  final String emptySubtitle;
  final bool emptyShowShopCta;
  final void Function(CustomerOrderGroup) onReorder;
  final Future<void> Function(CustomerOrderVm) onContactStore;
  final Future<void> Function() onLoad;

  @override
  Widget build(BuildContext context) {
    if (groups.isEmpty) {
      return RefreshIndicator(
        color: NmdColors.brandPrimary,
        onRefresh: onLoad,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.72,
            child: _EmptyOrders(
              onShop: () => context.go('/market/$slug'),
              title: emptyTitle,
              subtitle: emptySubtitle,
              showCta: emptyShowShopCta,
            ),
          ),
        ),
      );
    }

    final now = DateTime.now();
    final byDay = _groupsByDay(groups);
    final slivers = <Widget>[
      const SliverToBoxAdapter(child: SizedBox(height: 4)),
    ];

    for (final section in byDay) {
      final day = section.day;
      if (day != null) {
        final label = _stickyDateLabel(day, now);
        if (label.isNotEmpty) {
          slivers.add(
            SliverPersistentHeader(
              pinned: true,
              delegate: _StickyDayHeaderDelegate(label: label),
            ),
          );
        }
      }
      slivers.add(
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            NmdSpacing.screenHorizontal,
            0,
            NmdSpacing.screenHorizontal,
            4,
          ),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final g = section.groups[i];
                return Padding(
                  padding: EdgeInsets.only(
                    bottom: i == section.groups.length - 1 ? 10 : 14,
                  ),
                  child: _OrderGroupCard(
                    bucket: bucket,
                    group: g,
                    onOpenDetail: () =>
                        showOrderTimelineSheet(context, orders: g.orders),
                    onReorder: () => onReorder(g),
                    onContact: () async {
                      if (g.orders.length == 1) {
                        await onContactStore(g.orders.single);
                      } else {
                        if (!context.mounted) return;
                        await showModalBottomSheet<void>(
                          context: context,
                          backgroundColor: Colors.transparent,
                          builder: (ctx) => Container(
                            decoration: const BoxDecoration(
                              color: NmdColors.surfaceBase,
                              borderRadius: BorderRadius.vertical(
                                top: Radius.circular(24),
                              ),
                            ),
                            child: SafeArea(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const SizedBox(height: NmdSpacing.sm),
                                  Container(
                                    width: 40,
                                    height: 4,
                                    decoration: BoxDecoration(
                                      color: NmdColors.borderSubtle,
                                      borderRadius: NmdRadius.borderPill,
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(
                                        NmdSpacing.screenHorizontal),
                                    child: Text(
                                      'اختر المتجر للتواصل',
                                      style: NmdTypography.h3,
                                    ),
                                  ),
                                  for (final o in g.orders)
                                    ListTile(
                                      leading: Icon(
                                        Icons.storefront_outlined,
                                        color: NmdColors.brandPrimary,
                                      ),
                                      title: Text(
                                        o.tenantName ?? 'متجر',
                                        style: NmdTypography.label,
                                      ),
                                      onTap: () async {
                                        Navigator.pop(ctx);
                                        await onContactStore(o);
                                      },
                                    ),
                                  const SizedBox(height: NmdSpacing.sm),
                                ],
                              ),
                            ),
                          ),
                        );
                      }
                    },
                  ),
                );
              },
              childCount: section.groups.length,
            ),
          ),
        ),
      );
    }

    slivers.add(const SliverToBoxAdapter(child: SizedBox(height: 100)));

    return RefreshIndicator(
      color: NmdColors.brandPrimary,
      onRefresh: onLoad,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        slivers: slivers,
      ),
    );
  }
}

class _StickyDayHeaderDelegate extends SliverPersistentHeaderDelegate {
  _StickyDayHeaderDelegate({required this.label});

  final String label;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      color: NmdColors.surfaceMuted,
      padding: const EdgeInsets.fromLTRB(4, 10, 4, 8),
      alignment: Alignment.centerRight,
      child: Text(
        label,
        style: NmdTypography.label.copyWith(
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          color: NmdColors.textSecondary,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  @override
  double get maxExtent => 40;

  @override
  double get minExtent => 40;

  @override
  bool shouldRebuild(covariant _StickyDayHeaderDelegate oldDelegate) =>
      oldDelegate.label != label;
}

class _OrderGroupCard extends StatelessWidget {
  const _OrderGroupCard({
    required this.bucket,
    required this.group,
    required this.onOpenDetail,
    required this.onReorder,
    required this.onContact,
  });

  final _OrderBucket bucket;
  final CustomerOrderGroup group;
  final VoidCallback onOpenDetail;
  final VoidCallback onReorder;
  final VoidCallback onContact;

  String _timeLine(CustomerOrderVm? o) {
    if (o == null || !o.hasReliableCreatedAt) return '';
    final d = o.createdAt!;
    return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  int _itemTotal(CustomerOrderGroup g) =>
      g.orders.fold<int>(0, (s, o) => s + o.itemCount);

  @override
  Widget build(BuildContext context) {
    final primary = group.orders.isNotEmpty ? group.orders.first : null;
    final trackingOrder = _trackingOrderForGroup(group);
    final sid = primary != null ? shortOrderId(primary.id) : '#—';
    final simpleServiceCompleted =
        bucket == _OrderBucket.completed && group.isServiceOnlyGroup;
    final dateLabel = _formatOrderDate(primary);
    final paymentLabel =
        primary != null ? _paymentMethodLabelAr(primary) : null;
    final fulfillmentLabel = _fulfillmentLabelAr(primary?.fulfillmentType);

    return NmdCard(
      variant: NmdCardVariant.elevated,
      onTap: onOpenDetail,
      padding: const EdgeInsets.all(NmdSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _LogoRow(orders: group.orders),
              const SizedBox(width: NmdSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      group.isMultiStore
                          ? 'طلب مجمع'
                          : (primary?.tenantName ?? 'طلب'),
                      style: NmdTypography.h3.copyWith(
                        fontWeight: FontWeight.w900,
                        height: 1.25,
                      ),
                    ),
                    if (group.isMultiStore)
                      Padding(
                        padding: const EdgeInsets.only(top: NmdSpacing.xxs),
                        child: Text(
                          group.orders
                              .map((e) => e.tenantName ?? '')
                              .where((s) => s.isNotEmpty)
                              .join(' • '),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.bodySmall,
                        ),
                      ),
                    const SizedBox(height: NmdSpacing.xxs),
                    Text(
                      [
                        'طلب $sid',
                        if (!simpleServiceCompleted &&
                            _timeLine(primary).isNotEmpty)
                          _timeLine(primary),
                        if (dateLabel.isNotEmpty) dateLabel,
                      ].join(' · '),
                      style: NmdTypography.bodySmall.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: NmdSpacing.xs),
                    Wrap(
                      spacing: NmdSpacing.xs,
                      runSpacing: NmdSpacing.xxs,
                      children: [
                        NmdChip(
                          label: fulfillmentLabel,
                          variant: NmdChipVariant.status,
                          backgroundColor: NmdColors.infoSoft,
                          foregroundColor: NmdColors.info,
                        ),
                        if (paymentLabel != null)
                          NmdChip(
                            label: paymentLabel,
                            variant: NmdChipVariant.status,
                            backgroundColor: NmdColors.surfaceMuted,
                            foregroundColor: NmdColors.textSecondary,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              if (primary != null)
                simpleServiceCompleted
                    ? OrderStatusChip(
                        status: primary.status,
                        fulfillmentType: primary.fulfillmentType,
                        compact: true,
                        isServiceLead: true,
                      )
                    : (trackingOrder != null ||
                            primary.suppressesDeliveryTracking)
                        ? OrderTrackingStatusChip(
                            order: trackingOrder ?? primary,
                            compact: true,
                          )
                        : OrderStatusChip(
                            status: primary.status,
                            fulfillmentType: primary.fulfillmentType,
                            compact: true,
                            isServiceLead: false,
                          ),
            ],
          ),
          if (!simpleServiceCompleted) ...[
            if (trackingOrder != null) ...[
              const SizedBox(height: NmdSpacing.sm),
              StoreOrderTrackingPanel(order: trackingOrder),
            ],
            const SizedBox(height: NmdSpacing.md),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _itemTotal(group) > 0
                        ? '${_itemTotal(group)} منتجات'
                        : 'ملخص الطلب',
                    style: NmdTypography.bodySmall,
                  ),
                ),
                Text(
                  NmdFormat.money(group.combinedTotal),
                  style: NmdTypography.h2.copyWith(
                    color: NmdColors.brandPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: NmdSpacing.md),
            Row(
              children: [
                Expanded(
                  child: NmdButton(
                    label: 'إعادة طلب',
                    size: NmdButtonSize.compact,
                    icon: const Icon(
                      Icons.replay_rounded,
                      size: 18,
                      color: NmdColors.textOnBrand,
                    ),
                    onPressed: onReorder,
                  ),
                ),
                const SizedBox(width: NmdSpacing.sm),
                Expanded(
                  child: NmdButton(
                    label: 'تواصل',
                    size: NmdButtonSize.compact,
                    variant: NmdButtonVariant.secondary,
                    icon: Icon(
                      Icons.chat_rounded,
                      size: 18,
                      color: NmdColors.brandPrimary,
                    ),
                    onPressed: onContact,
                  ),
                ),
              ],
            ),
          ] else ...[
            const SizedBox(height: NmdSpacing.sm),
            Row(
              children: [
                const Spacer(),
                Text(
                  NmdFormat.money(group.combinedTotal),
                  style: NmdTypography.h2.copyWith(
                    color: NmdColors.brandPrimary,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _LogoRow extends StatelessWidget {
  const _LogoRow({required this.orders});

  final List<CustomerOrderVm> orders;

  @override
  Widget build(BuildContext context) {
    final urls = orders
        .map((e) => e.tenantLogoUrl)
        .whereType<String>()
        .where((u) => u.isNotEmpty)
        .take(3)
        .toList();
    if (urls.isEmpty) {
      return Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: NmdColors.tintAliveSoft,
          borderRadius: NmdRadius.borderMd,
          border: Border.all(
            color: NmdColors.brandPrimary.withValues(alpha: 0.15),
          ),
        ),
        child: const Icon(
          Icons.storefront_outlined,
          color: NmdColors.brandPrimary,
        ),
      );
    }
    if (urls.length == 1) {
      return ClipRRect(
        borderRadius: NmdRadius.borderMd,
        child: SizedBox(
          width: 52,
          height: 52,
          child: CachedNetworkImage(
            imageUrl: urls.first,
            fit: BoxFit.cover,
            errorWidget: (_, __, ___) =>
                ColoredBox(color: NmdColors.borderSubtle),
          ),
        ),
      );
    }
    return SizedBox(
      width: 58,
      height: 52,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (var i = 0; i < urls.length && i < 3; i++)
            PositionedDirectional(
              start: i * 12.0,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    width: 38,
                    height: 38,
                    child: CachedNetworkImage(
                      imageUrl: urls[i],
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) =>
                          ColoredBox(color: NmdColors.borderSubtle),
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

class _EmptyOrders extends StatelessWidget {
  const _EmptyOrders({
    required this.onShop,
    required this.title,
    required this.subtitle,
    this.showCta = true,
  });

  final VoidCallback onShop;
  final String title;
  final String subtitle;
  final bool showCta;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(NmdSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              height: 160,
              child: Lottie.asset(
                'assets/lottie/orders_empty.json',
                fit: BoxFit.contain,
                repeat: true,
              ),
            ),
            const SizedBox(height: NmdSpacing.xs),
            Text(
              title,
              textAlign: TextAlign.center,
              style: NmdTypography.h2,
            ),
            const SizedBox(height: NmdSpacing.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: NmdTypography.bodySmall.copyWith(height: 1.55),
            ),
            if (showCta) ...[
              const SizedBox(height: NmdSpacing.xl),
              NmdButton(
                label: 'تسوق الآن',
                onPressed: onShop,
                expand: false,
                size: NmdButtonSize.medium,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate({
    required this.title,
    required this.subtitle,
    required this.onShop,
    required this.onLogin,
  });

  final String title;
  final String subtitle;
  final VoidCallback onShop;
  final Future<void> Function() onLogin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(NmdSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.lock_outline_rounded,
            size: 56,
            color: NmdColors.brandPrimary.withValues(alpha: 0.85),
          ),
          const SizedBox(height: NmdSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: NmdTypography.h2,
          ),
          const SizedBox(height: NmdSpacing.xs),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: NmdTypography.bodySmall.copyWith(height: 1.45),
          ),
          const SizedBox(height: NmdSpacing.xl),
          NmdButton(
            label: 'تسجيل الدخول',
            onPressed: () async => onLogin(),
          ),
          const SizedBox(height: NmdSpacing.sm),
          NmdButton(
            label: 'العودة للرئيسية',
            variant: NmdButtonVariant.ghost,
            onPressed: onShop,
          ),
        ],
      ),
    );
  }
}
