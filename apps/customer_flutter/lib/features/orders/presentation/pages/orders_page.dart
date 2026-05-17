import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lottie/lottie.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../core/network/token_storage.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../cart/application/cart_cubit.dart';
import '../../../catalog/application/service_lead_actions.dart';
import '../../../catalog/data/tenant_contact_info.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import '../../../loyalty/presentation/loyalty_coins_celebration.dart';
import '../../application/orders_cubit.dart';
import '../../domain/customer_order_vm.dart';
import '../widgets/order_status_badge.dart';
import '../widgets/order_timeline_sheet.dart';
import '../widgets/store_order_tracking_panel.dart';

const double _kCardRadius = 16;

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
      context.read<OrdersCubit>().reportUnauthorized();
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

  void _reorderGroup(CustomerOrderGroup group) {
    final cart = context.read<CartCubit>();
    var addedLines = 0;
    for (final o in group.orders) {
      final items = o.items;
      if (items == null) continue;
      for (final raw in items) {
        if (raw is! Map) continue;
        final m = Map<String, dynamic>.from(raw);
        final pid = m['productId']?.toString() ?? '';
        if (pid.isEmpty) continue;
        final qty = (m['quantity'] as num?)?.toInt() ?? 1;
        double unit;
        if (m['basePrice'] is num) {
          unit = (m['basePrice'] as num).toDouble();
        } else {
          final tp = (m['totalPrice'] as num?)?.toDouble() ?? 0;
          unit = qty > 0 ? tp / qty : tp;
        }
        cart.addOrIncrement(
          tenantId: o.tenantId,
          productId: pid,
          name: m['productName']?.toString() ?? 'منتج',
          unitPrice: unit,
          imageUrl: m['imageUrl']?.toString() ?? '',
          addQty: qty,
        );
        addedLines++;
      }
    }
    if (addedLines == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('لا توجد أصناف متاحة لإعادة الطلب',
                style: GoogleFonts.cairo())),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content:
              Text('تمت إضافة المنتجات إلى السلة', style: GoogleFonts.cairo())),
    );
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
        color: const Color(0xFFF8FAFC),
        child: Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
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
                  return const Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primaryTeal));
                }
                if (state.status == OrdersStatus.unauthorized) {
                  return _Unauthorized(
                    onShop: () => context.go('/market/$slug'),
                    onLogin: () async {
                      final ok = await ensureCustomerAuth(context);
                      if (!context.mounted || !ok) return;
                      await context.read<OrdersCubit>().load();
                    },
                  );
                }
                if (state.status == OrdersStatus.error) {
                  return _ErrorState(
                    message: state.message ?? 'خطأ',
                    onRetry: () => context.read<OrdersCubit>().load(),
                  );
                }
                if (state.status == OrdersStatus.empty) {
                  return RefreshIndicator(
                    color: AppColors.primaryTeal,
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
                              'ابدأ التسوق وستظهر طلباتك هنا بكل ترتيب ووضوح.',
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
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
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
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: TabBar(
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorPadding: const EdgeInsets.fromLTRB(4, 6, 4, 6),
        labelPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
        indicator: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: AppColors.primaryTeal.withValues(alpha: 0.14),
        ),
        splashBorderRadius: BorderRadius.circular(12),
        overlayColor: WidgetStateProperty.all(Colors.transparent),
        labelColor: AppColors.primaryTeal,
        unselectedLabelColor: const Color(0xFF64748B),
        labelStyle: GoogleFonts.cairo(
          fontWeight: FontWeight.w900,
          fontSize: 13,
        ),
        unselectedLabelStyle: GoogleFonts.cairo(
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
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
        color: AppColors.primaryTeal,
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
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
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
                          shape: const RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.vertical(top: Radius.circular(16)),
                          ),
                          builder: (ctx) => SafeArea(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Text(
                                    'اختر المتجر للتواصل',
                                    style: GoogleFonts.cairo(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 16),
                                  ),
                                ),
                                for (final o in g.orders)
                                  ListTile(
                                    leading:
                                        const Icon(Icons.storefront_outlined),
                                    title: Text(o.tenantName ?? 'متجر',
                                        style: GoogleFonts.cairo()),
                                    onTap: () async {
                                      Navigator.pop(ctx);
                                      await onContactStore(o);
                                    },
                                  ),
                              ],
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
      color: AppColors.primaryTeal,
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
      color: const Color(0xFFF8FAFC),
      padding: const EdgeInsets.fromLTRB(4, 10, 4, 8),
      alignment: Alignment.centerRight,
      child: Text(
        label,
        style: GoogleFonts.cairo(
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          color: const Color(0xFF64748B),
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
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(_kCardRadius),
        onTap: onOpenDetail,
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(_kCardRadius),
            border: Border.all(color: const Color(0xFFE8EDF2)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: AppColors.primaryTeal.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _LogoRow(orders: group.orders),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            group.isMultiStore
                                ? 'طلب مجمع'
                                : (primary?.tenantName ?? 'طلب'),
                            style: GoogleFonts.cairo(
                              fontWeight: FontWeight.w900,
                              fontSize: 16,
                              color: AppColors.textPrimary,
                              height: 1.25,
                            ),
                          ),
                          if (group.isMultiStore)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                group.orders
                                    .map((e) => e.tenantName ?? '')
                                    .where((s) => s.isNotEmpty)
                                    .join(' • '),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.cairo(
                                  fontSize: 12,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                            ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Text(
                                'طلب $sid',
                                style: GoogleFonts.cairo(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF475569),
                                ),
                              ),
                              if (!simpleServiceCompleted &&
                                  _timeLine(primary).isNotEmpty) ...[
                                Text(
                                  ' · ',
                                  style: GoogleFonts.cairo(
                                      color: const Color(0xFFCBD5E1)),
                                ),
                                Text(
                                  _timeLine(primary),
                                  style: GoogleFonts.cairo(
                                    fontSize: 13,
                                    color: const Color(0xFF94A3B8),
                                  ),
                                ),
                              ],
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
                    const SizedBox(height: 12),
                    StoreOrderTrackingPanel(order: trackingOrder),
                  ],
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _itemTotal(group) > 0
                              ? '${_itemTotal(group)} منتجات'
                              : 'ملخص الطلب',
                          style: GoogleFonts.cairo(
                            fontSize: 13,
                            color: const Color(0xFF475569),
                          ),
                        ),
                      ),
                      Text(
                        '₪${group.combinedTotal.toStringAsFixed(2)}',
                        style: GoogleFonts.cairo(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          color: AppColors.primaryTeal,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _GradientPrimaryButton(
                          onPressed: onReorder,
                          icon: Icons.replay_rounded,
                          label: 'إعادة طلب',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _GradientOutlineButton(
                          onPressed: onContact,
                          icon: Icons.chat_rounded,
                          label: 'تواصل',
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Spacer(),
                      Text(
                        '₪${group.combinedTotal.toStringAsFixed(2)}',
                        style: GoogleFonts.cairo(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          color: AppColors.primaryTeal,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GradientPrimaryButton extends StatelessWidget {
  const _GradientPrimaryButton({
    required this.onPressed,
    required this.icon,
    required this.label,
  });

  final VoidCallback onPressed;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.shellTeal,
            AppColors.primaryTeal,
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryTeal.withValues(alpha: 0.32),
            blurRadius: 12,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 18, color: Colors.white),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: GoogleFonts.cairo(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: Colors.white,
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

class _GradientOutlineButton extends StatelessWidget {
  const _GradientOutlineButton({
    required this.onPressed,
    required this.icon,
    required this.label,
  });

  final VoidCallback onPressed;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: LinearGradient(
          colors: [
            Colors.white,
            AppColors.primaryTeal.withValues(alpha: 0.06),
          ],
        ),
        border: Border.all(
          color: AppColors.primaryTeal.withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 18, color: AppColors.primaryTeal),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: GoogleFonts.cairo(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: AppColors.primaryTeal,
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
          color: const Color(0xFFE0F2F1),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFCCFBF1)),
        ),
        child:
            const Icon(Icons.storefront_outlined, color: AppColors.primaryTeal),
      );
    }
    if (urls.length == 1) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          width: 52,
          height: 52,
          child: CachedNetworkImage(
            imageUrl: urls.first,
            fit: BoxFit.cover,
            errorWidget: (_, __, ___) =>
                const ColoredBox(color: Color(0xFFE2E8F0)),
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
                          const ColoredBox(color: Color(0xFFE2E8F0)),
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
        padding: const EdgeInsets.all(28),
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
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.cairo(
                fontSize: 21,
                fontWeight: FontWeight.w900,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: GoogleFonts.cairo(
                fontSize: 15,
                height: 1.55,
                color: const Color(0xFF64748B),
              ),
            ),
            if (showCta) ...[
              const SizedBox(height: 26),
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(
                    colors: [
                      AppColors.shellTeal,
                      AppColors.primaryTeal,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryTeal.withValues(alpha: 0.28),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: onShop,
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 14,
                      ),
                      child: Text(
                        'تسوق الآن',
                        style: GoogleFonts.cairo(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Unauthorized extends StatelessWidget {
  const _Unauthorized({
    required this.onShop,
    required this.onLogin,
  });

  final VoidCallback onShop;
  final Future<void> Function() onLogin;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.lock_outline_rounded,
                size: 56, color: AppColors.primaryTeal.withValues(alpha: 0.85)),
            const SizedBox(height: 16),
            Text(
              'يرجى تسجيل الدخول',
              textAlign: TextAlign.center,
              style: GoogleFonts.cairo(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'سجّل دخولك لعرض طلباتك ومتابعة حالتها.',
              textAlign: TextAlign.center,
              style: GoogleFonts.cairo(
                  fontSize: 14, height: 1.45, color: const Color(0xFF64748B)),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async => onLogin(),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primaryTeal,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('تسجيل الدخول',
                    style: GoogleFonts.cairo(fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: onShop,
              child: Text('العودة للرئيسية',
                  style: GoogleFonts.cairo(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryTeal)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(message,
                textAlign: TextAlign.center, style: GoogleFonts.cairo()),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              child: Text('إعادة المحاولة',
                  style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
