import 'dart:async';
import 'dart:developer' as developer;

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_barcode_listener/flutter_barcode_listener.dart';
import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/api/api_base.dart';
import '../../core/api/merchant_api_client.dart';
import '../../core/session/merchant_session_store.dart';
import '../../models/merchant_catalog.dart';
import '../../models/merchant_order.dart';
import '../../models/merchant_session.dart';
import '../../services/printer/sunmi_printer_service.dart';
import '../theme/app_colors.dart';

const _commandCenterBuildMarker =
    'COMMAND CENTER BUILD 2026-05-11T12:32:46Z v0.1.1+2';
const _newOrderVoiceAsset = 'sounds/new_order_ar.mp3';
const _orderReminderInterval = Duration(minutes: 2);
const _voiceAlertThrottle = Duration(milliseconds: 1800);

class OrderDashboardPage extends StatefulWidget {
  const OrderDashboardPage({
    super.key,
    required this.api,
    required this.sessionStore,
    required this.session,
    required this.onLoggedOut,
  });

  final MerchantApiClient api;
  final MerchantSessionStore sessionStore;
  final MerchantSession session;
  final VoidCallback onLoggedOut;

  @override
  State<OrderDashboardPage> createState() => _OrderDashboardPageState();
}

class _OrderDashboardPageState extends State<OrderDashboardPage>
    with WidgetsBindingObserver {
  final SunmiPrinterService _printerService = SunmiPrinterService();
  final AudioPlayer _alertPlayer = AudioPlayer();
  final List<MerchantOrder> _orders = [];
  final Set<String> _printedOrderIds = {};
  final Set<String> _knownOrderIds = {};
  final Set<String> _highlightedOrderIds = {};
  final Set<String> _updatingOrderIds = {};
  final Set<String> _acknowledgedOrderIds = {};
  final Map<String, Timer> _reminderTimers = {};
  final Map<String, DateTime> _orderFirstSeenAt = {};
  final Map<String, DateTime> _orderLastVoiceAlertAt = {};
  final TextEditingController _productSearchController =
      TextEditingController();
  Future<void> _voiceAlertQueue = Future.value();
  Timer? _pollingTimer;
  TenantSettings? _tenantSettings;
  MerchantCatalog? _catalog;
  Map<String, MerchantStats> _stats = const {};
  int _selectedIndex = 0;
  bool _isPolling = false;
  bool _isLoadingCatalog = false;
  bool _isLoadingStats = false;
  bool _isWritingCatalog = false;
  String? _ordersError;
  String? _statusMessage;
  String? _statusError;
  String? _catalogError;
  String? _syncingStatus;
  DateTime? _lastPollAt;
  DateTime? _autoPrintStartedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_enableWakeLock());
    unawaited(_configureAlertAudio());
    _bootstrap();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollingTimer?.cancel();
    _stopAllOrderReminders(reason: 'dashboard-dispose');
    unawaited(_disableWakeLock());
    unawaited(_alertPlayer.dispose());
    _productSearchController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_enableWakeLock());
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      unawaited(_disableWakeLock());
    }
  }

  Future<void> _configureAlertAudio() async {
    try {
      await _alertPlayer.setReleaseMode(ReleaseMode.stop);
    } catch (error) {
      developer.log(
        '[OrderAlert] audio configure failed: $error',
        name: 'MerchantPOS',
      );
    }
  }

  Future<void> _enableWakeLock() async {
    try {
      await WakelockPlus.enable();
      developer.log('[WakeLock] enabled', name: 'MerchantPOS');
    } catch (error) {
      developer.log('[WakeLock] enable failed: $error', name: 'MerchantPOS');
    }
  }

  Future<void> _disableWakeLock() async {
    try {
      await WakelockPlus.disable();
      developer.log('[WakeLock] disabled', name: 'MerchantPOS');
    } catch (error) {
      developer.log('[WakeLock] disable failed: $error', name: 'MerchantPOS');
    }
  }

  Future<void> _bootstrap() async {
    _printedOrderIds.addAll(await widget.sessionStore.readPrintedOrderIds());
    _autoPrintLog('loaded printed cache count=${_printedOrderIds.length}');
    await Future.wait([
      _refreshTenantSettings(),
      _refreshCatalog(),
      _refreshOrders(autoPrint: false),
      _refreshStats(),
    ]);
    _autoPrintStartedAt = DateTime.now();
    _autoPrintLog('auto-print armed at $_autoPrintStartedAt');
    _pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      _refreshOrders(silent: true);
    });
  }

  Future<void> _handleUnauthorized(Object error) async {
    if (!widget.api.isUnauthorized(error)) return;
    await _disableWakeLock();
    _stopAllOrderReminders(reason: 'unauthorized');
    await widget.sessionStore.clearSession();
    if (mounted) widget.onLoggedOut();
  }

  Future<void> _refreshTenantSettings() async {
    try {
      final settings =
          await widget.api.getTenantSettings(widget.session.tenantId);
      if (mounted) setState(() => _tenantSettings = settings);
    } catch (error) {
      await _handleUnauthorized(error);
    }
  }

  Future<void> _refreshOrders({
    bool silent = false,
    bool autoPrint = true,
  }) async {
    if (_isPolling) {
      _autoPrintLog('poll skipped because another poll is running');
      return;
    }
    if (mounted) {
      setState(() {
        _isPolling = true;
        if (!silent) _ordersError = null;
      });
    }
    try {
      _autoPrintLog('poll started tenantId=${widget.session.tenantId}');
      final orders = await widget.api.getTenantOrders(widget.session.tenantId);
      _autoPrintLog('poll fetched count=${orders.length}');
      orders.sort((a, b) {
        final at = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bt = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return bt.compareTo(at);
      });

      final previousIds = _knownOrderIds.toSet();
      final newIds = _lastPollAt == null
          ? const <String>{}
          : orders
              .where((order) => !previousIds.contains(order.id))
              .map((order) => order.id)
              .toSet();
      for (final order in orders.where((order) => newIds.contains(order.id))) {
        if (order.isActionable && !_acknowledgedOrderIds.contains(order.id)) {
          _showNewOrderAlert(order);
        }
      }

      for (final order in orders.reversed) {
        final wasKnown = previousIds.contains(order.id);
        final alreadyPrinted = _printedOrderIds.contains(order.id);
        final eligible = order.isActionable;
        final createdAt = order.createdAt;
        final createdAfterArmed = _autoPrintStartedAt != null &&
            createdAt != null &&
            createdAt.isAfter(_autoPrintStartedAt!);
        final shouldPrintNow = autoPrint &&
            eligible &&
            !alreadyPrinted &&
            (!wasKnown || createdAfterArmed);
        _autoPrintLog(
          'order id=${order.id} status=${order.status} new=${!wasKnown} '
          'eligible=$eligible alreadyPrinted=$alreadyPrinted '
          'createdAt=$createdAt shouldPrint=$shouldPrintNow '
          'fulfillment=${order.fulfillmentLabel}',
        );
        if (order.fulfillmentType == MerchantFulfillmentType.unknown) {
          _autoPrintLog(
            'unknown fulfillment id=${order.id} keys=${order.raw.keys.join(',')}',
          );
        }
        if (!shouldPrintNow) {
          continue;
        }
        try {
          _autoPrintLog('print started id=${order.id}');
          await _printerService.printOrderReceipts(
            order,
            storeName: _tenantSettings?.name ?? 'Now Market',
            itemDescriptions: _itemDescriptionsFor(order),
          );
          _printedOrderIds.add(order.id);
          await widget.sessionStore.savePrintedOrderIds(_printedOrderIds);
          _autoPrintLog('print success id=${order.id}');
        } catch (error, stackTrace) {
          _autoPrintLog('print failed id=${order.id} error=$error');
          developer.log(
            'auto-print failed',
            name: 'MerchantPOS',
            error: error,
            stackTrace: stackTrace,
          );
        }
      }
      _knownOrderIds
        ..clear()
        ..addAll(orders.map((order) => order.id));
      await widget.sessionStore.savePrintedOrderIds(_printedOrderIds);
      final actionableIds =
          orders.where((order) => order.isActionable).map((order) => order.id);
      for (final id in _reminderTimers.keys.toList()) {
        if (!actionableIds.contains(id)) {
          _stopOrderReminder(id, reason: 'order-final-or-missing');
        }
      }

      if (!mounted) return;
      setState(() {
        _orders
          ..clear()
          ..addAll(orders);
        _highlightedOrderIds.addAll(newIds);
        _highlightedOrderIds.removeWhere((id) {
          for (final order in orders) {
            if (order.id == id) return !order.isActionable;
          }
          return true;
        });
        _lastPollAt = DateTime.now();
        _ordersError = null;
      });
      if (!silent) await _refreshStats();
    } catch (error) {
      await _handleUnauthorized(error);
      if (!mounted || widget.api.isUnauthorized(error)) return;
      setState(() => _ordersError = error.toString());
    } finally {
      if (mounted) setState(() => _isPolling = false);
    }
  }

  void _autoPrintLog(String message) {
    developer.log('[AutoPrint] $message', name: 'MerchantPOS');
  }

  void _showNewOrderAlert(MerchantOrder order) {
    _orderAlertLog('new order detected id=${order.id}');
    _orderFirstSeenAt.putIfAbsent(order.id, DateTime.now);
    _playOrderVoiceAlert(reason: 'new-order', orderId: order.id);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'هناك طلبية جديدة',
            textDirection: TextDirection.rtl,
          ),
          action: SnackBarAction(
            label: 'فتح',
            onPressed: () => _acknowledgeOrder(order.id),
          ),
          duration: const Duration(seconds: 8),
        ),
      );
    }
    _scheduleOrderReminder(order.id);
  }

  void _scheduleOrderReminder(String orderId) {
    if (_acknowledgedOrderIds.contains(orderId)) return;
    _reminderTimers[orderId]?.cancel();
    _reminderTimers[orderId] = Timer(_orderReminderInterval, () {
      if (!_isOrderStillUnacknowledgedActionable(orderId)) {
        _stopOrderReminder(orderId, reason: 'not-actionable-at-reminder');
        return;
      }
      _orderAlertLog('reminder played after 2 minutes id=$orderId');
      _playOrderVoiceAlert(reason: 'reminder', orderId: orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'يوجد طلبية لم يتم استلامها',
              textDirection: TextDirection.rtl,
            ),
            duration: Duration(seconds: 8),
          ),
        );
      }
      _scheduleOrderReminder(orderId);
    });
    _orderAlertLog('reminder scheduled id=$orderId every=2m');
  }

  bool _isOrderStillUnacknowledgedActionable(String orderId) {
    if (_acknowledgedOrderIds.contains(orderId)) return false;
    return _orders.any((order) => order.id == orderId && order.isActionable);
  }

  void _playOrderVoiceAlert({
    required String reason,
    required String orderId,
  }) {
    _voiceAlertQueue = _voiceAlertQueue
        .catchError((_) {})
        .then((_) => _playOrderVoiceAlertNow(reason: reason, orderId: orderId));
  }

  Future<void> _playOrderVoiceAlertNow({
    required String reason,
    required String orderId,
  }) async {
    _orderAlertLog(
      'voice alert play attempted reason=$reason id=$orderId '
      'asset=$_newOrderVoiceAsset',
    );
    try {
      await _alertPlayer.stop();
      await _alertPlayer.play(
        AssetSource(_newOrderVoiceAsset),
        mode: PlayerMode.lowLatency,
        volume: 1,
      );
      _orderLastVoiceAlertAt[orderId] = DateTime.now();
      _orderAlertLog('voice alert played reason=$reason id=$orderId');
      await Future<void>.delayed(_voiceAlertThrottle);
    } catch (error, stackTrace) {
      _orderAlertLog(
        'voice asset missing/failure reason=$reason id=$orderId '
        'asset=$_newOrderVoiceAsset error=$error',
      );
      developer.log(
        'order voice alert failed',
        name: 'MerchantPOS',
        error: error,
        stackTrace: stackTrace,
      );
      await HapticFeedback.vibrate();
      unawaited(SystemSound.play(SystemSoundType.alert));
    }
  }

  void _orderAlertLog(String message) {
    developer.log('[OrderAlert] $message', name: 'MerchantPOS');
  }

  void _acknowledgeOrder(String orderId) {
    _orderAlertLog('order acknowledged id=$orderId');
    _stopOrderReminder(orderId, reason: 'acknowledged');
    if (!mounted) return;
    setState(() {
      _acknowledgedOrderIds.add(orderId);
      _highlightedOrderIds.remove(orderId);
    });
  }

  void _stopOrderReminder(String orderId, {required String reason}) {
    final timer = _reminderTimers.remove(orderId);
    timer?.cancel();
    _acknowledgedOrderIds.add(orderId);
    _orderFirstSeenAt.remove(orderId);
    _orderLastVoiceAlertAt.remove(orderId);
    if (timer != null) {
      _orderAlertLog('reminder stopped id=$orderId reason=$reason');
    }
  }

  void _stopAllOrderReminders({required String reason}) {
    for (final id in _reminderTimers.keys.toList()) {
      _stopOrderReminder(id, reason: reason);
    }
  }

  Map<String, String> _itemDescriptionsFor(MerchantOrder order) {
    final descriptions = <String, String>{};
    for (final item in order.itemDetails) {
      if (item.description.trim().isNotEmpty) {
        if (item.productId.isNotEmpty) {
          descriptions[item.productId] = item.description.trim();
        }
        descriptions[item.name.trim().toLowerCase()] = item.description.trim();
      }
    }
    for (final product in _catalog?.products ?? const <MerchantProduct>[]) {
      if (product.description.trim().isEmpty) continue;
      descriptions.putIfAbsent(product.id, () => product.description.trim());
      descriptions.putIfAbsent(
        product.name.trim().toLowerCase(),
        () => product.description.trim(),
      );
    }
    return descriptions;
  }

  Future<void> _refreshCatalog() async {
    setState(() {
      _isLoadingCatalog = true;
      _catalogError = null;
    });
    try {
      final catalog = await widget.api.getCatalog(widget.session.tenantId);
      if (!mounted) return;
      setState(() => _catalog = catalog);
    } catch (error) {
      await _handleUnauthorized(error);
      if (!mounted || widget.api.isUnauthorized(error)) return;
      setState(() => _catalogError = error.toString());
    } finally {
      if (mounted) setState(() => _isLoadingCatalog = false);
    }
  }

  Future<void> _refreshStats() async {
    setState(() => _isLoadingStats = true);
    try {
      final results = await Future.wait([
        widget.api.getMerchantStats('day'),
        widget.api.getMerchantStats('week'),
        widget.api.getMerchantStats('month'),
      ]);
      if (!mounted) return;
      setState(() {
        _stats = {
          'today': results[0],
          'week': results[1],
          'month': results[2],
        };
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _stats = {
          'today': _statsFromOrders(_Period.today),
          'week': _statsFromOrders(_Period.week),
          'month': _statsFromOrders(_Period.month),
        };
      });
    } finally {
      if (mounted) setState(() => _isLoadingStats = false);
    }
  }

  MerchantStats _statsFromOrders(_Period period) {
    final now = DateTime.now();
    final start = switch (period) {
      _Period.today => DateTime(now.year, now.month, now.day),
      _Period.week => DateTime(now.year, now.month, now.day)
          .subtract(Duration(days: now.weekday - 1)),
      _Period.month => DateTime(now.year, now.month),
    };
    final rows = _orders.where((order) {
      final createdAt = order.createdAt;
      if (createdAt == null || createdAt.isBefore(start)) return false;
      return order.status.toUpperCase() != 'CANCELLED';
    }).toList();
    final cash = rows.where((order) => !order.isCardPayment).toList();
    final card = rows.where((order) => order.isCardPayment).toList();
    double totalOf(List<MerchantOrder> orders) =>
        orders.fold(0, (sum, order) => sum + order.total);
    return MerchantStats(
      orderCount: rows.length,
      totalSales: totalOf(rows),
      cashOrderCount: cash.length,
      cashSales: totalOf(cash),
      cardOrderCount: card.length,
      cardSales: totalOf(card),
    );
  }

  Future<void> _setOperationalStatus(String status) async {
    setState(() {
      _syncingStatus = status;
      _statusMessage = 'Syncing ${_statusLabel(status)} with storefront...';
      _statusError = null;
    });
    try {
      await widget.api.updateOperationalStatus(widget.session.tenantId, status);
      final verified =
          await widget.api.getTenantSettings(widget.session.tenantId);
      if (!mounted) return;
      setState(() {
        _tenantSettings = verified;
        _statusMessage =
            'Saved. Customer app reads ${verified.operationalStatus}.';
        _statusError = verified.operationalStatus == status
            ? null
            : 'Backend saved ${verified.operationalStatus}, not $status.';
      });
    } catch (error) {
      await _handleUnauthorized(error);
      if (!mounted || widget.api.isUnauthorized(error)) return;
      setState(() {
        _statusError = 'Could not update store status: $error';
        _statusMessage = null;
      });
    } finally {
      if (mounted) setState(() => _syncingStatus = null);
    }
  }

  Future<void> _updateOrderStatus(MerchantOrder order, String status) async {
    _acknowledgeOrder(order.id);
    setState(() => _updatingOrderIds.add(order.id));
    try {
      await widget.api.updateOrderStatus(order.id, status);
      await _refreshOrders();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Order ${order.shortId} marked $status')),
      );
    } catch (error) {
      await _handleUnauthorized(error);
      if (!mounted || widget.api.isUnauthorized(error)) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not update order: $error')),
      );
    } finally {
      if (mounted) setState(() => _updatingOrderIds.remove(order.id));
    }
  }

  Future<void> _writeCatalog(
    MerchantCatalog Function(MerchantCatalog latest) patch,
  ) async {
    setState(() {
      _isWritingCatalog = true;
      _catalogError = null;
    });
    try {
      final catalog = await widget.api.patchCatalogSafely(
        widget.session.tenantId,
        patch,
      );
      if (!mounted) return;
      setState(() => _catalog = catalog);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Catalog synced to customer storefront')),
      );
    } catch (error) {
      await _handleUnauthorized(error);
      if (!mounted || widget.api.isUnauthorized(error)) return;
      setState(() => _catalogError = error.toString());
    } finally {
      if (mounted) setState(() => _isWritingCatalog = false);
    }
  }

  Future<void> _saveProduct(MerchantProduct? product) async {
    final values = await showDialog<_ProductFormResult>(
      context: context,
      builder: (context) => _ProductDialog(
        product: product,
        categories: _catalog?.categories ?? const [],
      ),
    );
    if (values == null) return;
    await _writeCatalog((latest) {
      final products = latest.products.toList();
      if (product == null) {
        products.add(
          MerchantProduct.fromJson({
            'id': 'pos-${DateTime.now().millisecondsSinceEpoch}',
            'name': values.name,
            'slug': slugify(values.name),
            'categoryId': values.categoryId,
            'basePrice': values.price,
            'currency': 'ILS',
            'isAvailable': true,
            'isArchived': false,
            'sortOrder': products.length + 1,
          }),
        );
      } else {
        final index = products.indexWhere((row) => row.id == product.id);
        if (index >= 0) {
          products[index] = products[index].copyWith(
            name: values.name,
            slug: slugify(values.name),
            categoryId: values.categoryId,
            basePrice: values.price,
          );
        }
      }
      return MerchantCatalog(
        categories: latest.categories,
        products: products,
        optionGroups: latest.optionGroups,
        optionItems: latest.optionItems,
        raw: latest.raw,
      );
    });
  }

  Future<void> _toggleProductArchive(MerchantProduct product) {
    return _writeCatalog((latest) {
      return MerchantCatalog(
        categories: latest.categories,
        products: latest.products
            .map((row) => row.id == product.id
                ? row.copyWith(isArchived: !row.isArchived)
                : row)
            .toList(),
        optionGroups: latest.optionGroups,
        optionItems: latest.optionItems,
        raw: latest.raw,
      );
    });
  }

  Future<void> _toggleProductAvailability(MerchantProduct product) {
    return _writeCatalog((latest) {
      return MerchantCatalog(
        categories: latest.categories,
        products: latest.products
            .map((row) => row.id == product.id
                ? row.copyWith(isAvailable: !row.isAvailable)
                : row)
            .toList(),
        optionGroups: latest.optionGroups,
        optionItems: latest.optionItems,
        raw: latest.raw,
      );
    });
  }

  Future<void> _saveCategory(MerchantCategory? category) async {
    final value = await showDialog<String>(
      context: context,
      builder: (context) => _NameDialog(
        title: category == null ? 'Add category' : 'Edit category',
        initialValue: category?.name,
      ),
    );
    if (value == null || value.trim().isEmpty) return;
    await _writeCatalog((latest) {
      final categories = latest.categories.toList();
      if (category == null) {
        categories.add(
          MerchantCategory.fromJson({
            'id': 'cat-${DateTime.now().millisecondsSinceEpoch}',
            'name': value.trim(),
            'slug': slugify(value),
            'sortOrder': categories.length + 1,
            'isVisible': true,
          }),
        );
      } else {
        final index = categories.indexWhere((row) => row.id == category.id);
        if (index >= 0) {
          categories[index] = categories[index].copyWith(
            name: value.trim(),
            slug: slugify(value),
          );
        }
      }
      return MerchantCatalog(
        categories: categories,
        products: latest.products,
        optionGroups: latest.optionGroups,
        optionItems: latest.optionItems,
        raw: latest.raw,
      );
    });
  }

  Future<void> _toggleCategoryVisible(MerchantCategory category) {
    return _writeCatalog((latest) {
      return MerchantCatalog(
        categories: latest.categories
            .map((row) => row.id == category.id
                ? row.copyWith(isVisible: !row.isVisible)
                : row)
            .toList(),
        products: latest.products,
        optionGroups: latest.optionGroups,
        optionItems: latest.optionItems,
        raw: latest.raw,
      );
    });
  }

  Future<void> _logout() async {
    await _disableWakeLock();
    _stopAllOrderReminders(reason: 'logout');
    await widget.sessionStore.clearSession();
    widget.onLoggedOut();
  }

  void _handleBarcode(String barcode) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Scanner ready: $barcode')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BarcodeKeyboardListener(
      bufferDuration: const Duration(milliseconds: 200),
      onBarcodeScanned: _handleBarcode,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          drawer: _MerchantDrawer(
            selectedIndex: _selectedIndex,
            onSelected: (index) {
              Navigator.of(context).pop();
              setState(() => _selectedIndex = index);
            },
            onLogout: () {
              Navigator.of(context).pop();
              _logout();
            },
          ),
          body: SafeArea(
            child: Column(
              children: [
                _TopBar(
                  title: _tabs[_selectedIndex].label,
                  storeName: _tenantSettings?.name ?? 'Now Market',
                  status: _tenantSettings?.operationalStatus ?? 'open',
                  isPolling: _isPolling,
                  onRefresh: _refreshCurrentTab,
                ),
                Expanded(child: _selectedBody()),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _selectedBody() {
    final activeOrders =
        _orders.where((order) => !order.isFinal).toList(growable: false);
    final completedOrders =
        _orders.where((order) => order.isCompleted).toList(growable: false);
    return switch (_selectedIndex) {
      0 => _OrdersView(
          orders: activeOrders,
          catalog: _catalog,
          highlightedOrderIds: _highlightedOrderIds,
          updatingOrderIds: _updatingOrderIds,
          printedOrderIds: _printedOrderIds,
          error: _ordersError,
          isPolling: _isPolling,
          lastPollAt: _lastPollAt,
          onRefresh: _refreshOrders,
          onClearHighlight: _acknowledgeOrder,
          onReprint: (order) {
            _acknowledgeOrder(order.id);
            unawaited(
              _printerService.printOrderReceipts(
                order,
                storeName: _tenantSettings?.name ?? 'Now Market',
                itemDescriptions: _itemDescriptionsFor(order),
              ),
            );
          },
          onStatus: _updateOrderStatus,
        ),
      1 => _OrdersView(
          orders: completedOrders,
          catalog: _catalog,
          highlightedOrderIds: const {},
          updatingOrderIds: _updatingOrderIds,
          printedOrderIds: _printedOrderIds,
          error: _ordersError,
          isPolling: _isPolling,
          lastPollAt: _lastPollAt,
          onRefresh: _refreshOrders,
          onClearHighlight: _acknowledgeOrder,
          onReprint: (order) {
            _acknowledgeOrder(order.id);
            unawaited(
              _printerService.printOrderReceipts(
                order,
                storeName: _tenantSettings?.name ?? 'Now Market',
                itemDescriptions: _itemDescriptionsFor(order),
              ),
            );
          },
          onStatus: _updateOrderStatus,
          completedMode: true,
        ),
      2 => _ProductsView(
          catalog: _catalog,
          isLoading: _isLoadingCatalog,
          isWriting: _isWritingCatalog,
          error: _catalogError,
          searchController: _productSearchController,
          onRefresh: _refreshCatalog,
          onAdd: () => _saveProduct(null),
          onEdit: _saveProduct,
          onToggleArchive: _toggleProductArchive,
          onToggleAvailable: _toggleProductAvailability,
        ),
      3 => _CategoriesView(
          catalog: _catalog,
          isLoading: _isLoadingCatalog,
          isWriting: _isWritingCatalog,
          error: _catalogError,
          onRefresh: _refreshCatalog,
          onAdd: () => _saveCategory(null),
          onEdit: _saveCategory,
          onToggleVisible: _toggleCategoryVisible,
        ),
      4 => _AnalyticsView(stats: _stats, isLoading: _isLoadingStats),
      5 => _SettingsView(
          settings: _tenantSettings,
          session: widget.session,
          syncingStatus: _syncingStatus,
          statusMessage: _statusMessage,
          statusError: _statusError,
          lastPollAt: _lastPollAt,
          onStatusChanged: _setOperationalStatus,
          onLogout: _logout,
        ),
      _ => const SizedBox.shrink(),
    };
  }

  Future<void> _refreshCurrentTab() {
    return switch (_selectedIndex) {
      0 => _refreshOrders(),
      1 => _refreshOrders(),
      2 || 3 => _refreshCatalog(),
      4 => _refreshStats(),
      5 => _refreshTenantSettings(),
      _ => Future.value(),
    };
  }
}

enum _Period { today, week, month }

const _tabs = [
  _TabItem('الطلبات', Icons.receipt_long),
  _TabItem('الطلبات المكتملة', Icons.task_alt),
  _TabItem('المنتجات', Icons.inventory_2_outlined),
  _TabItem('التصنيفات', Icons.category_outlined),
  _TabItem('التحليلات', Icons.analytics_outlined),
  _TabItem('الإعدادات', Icons.tune),
];

class _TabItem {
  const _TabItem(this.label, this.icon);
  final String label;
  final IconData icon;
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.storeName,
    required this.status,
    required this.isPolling,
    required this.onRefresh,
  });

  final String title;
  final String storeName;
  final String status;
  final bool isPolling;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      child: Row(
        children: [
          Builder(
            builder: (context) => IconButton.filled(
              onPressed: () => Scaffold.of(context).openDrawer(),
              icon: const Icon(Icons.menu),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Flexible(child: Text(storeName)),
                    const SizedBox(width: 8),
                    _StatusPill(status: status),
                  ],
                ),
                const SizedBox(height: 6),
                const _BuildMarkerPill(),
                if (!kReleaseMode)
                  Text(
                    '$kMerchantApiBaseUrl / live tenant',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          IconButton.filledTonal(
            onPressed: isPolling ? null : onRefresh,
            icon: isPolling
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
          ),
        ],
      ),
    );
  }
}

class _BuildMarkerPill extends StatelessWidget {
  const _BuildMarkerPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.neonTeal, width: 1.2),
      ),
      child: const Text(
        _commandCenterBuildMarker,
        style: TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _MerchantDrawer extends StatelessWidget {
  const _MerchantDrawer({
    required this.selectedIndex,
    required this.onSelected,
    required this.onLogout,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: 292,
      backgroundColor: AppColors.darkBg,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              const Text(
                'Now Market',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Text(
                'Merchant Command Center',
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 24),
              for (var index = 0; index < _tabs.length; index++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NavButton(
                    tab: _tabs[index],
                    selected: selectedIndex == index,
                    onTap: () => onSelected(index),
                  ),
                ),
              const Spacer(),
              _NavButton(
                tab: const _TabItem('تسجيل الخروج', Icons.logout),
                selected: false,
                onTap: onLogout,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.tab,
    required this.selected,
    required this.onTap,
  });

  final _TabItem tab;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryTeal : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            Icon(tab.icon, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                tab.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrdersView extends StatelessWidget {
  const _OrdersView({
    required this.orders,
    required this.catalog,
    required this.highlightedOrderIds,
    required this.updatingOrderIds,
    required this.printedOrderIds,
    required this.error,
    required this.isPolling,
    required this.lastPollAt,
    required this.onRefresh,
    required this.onClearHighlight,
    required this.onReprint,
    required this.onStatus,
    this.completedMode = false,
  });

  final List<MerchantOrder> orders;
  final MerchantCatalog? catalog;
  final Set<String> highlightedOrderIds;
  final Set<String> updatingOrderIds;
  final Set<String> printedOrderIds;
  final String? error;
  final bool isPolling;
  final DateTime? lastPollAt;
  final Future<void> Function() onRefresh;
  final ValueChanged<String> onClearHighlight;
  final ValueChanged<MerchantOrder> onReprint;
  final Future<void> Function(MerchantOrder order, String status) onStatus;
  final bool completedMode;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _InfoStrip(
            icon: Icons.sync,
            title:
                completedMode ? 'الطلبات المكتملة' : 'تحديث الطلبات كل 8 ثواني',
            subtitle: lastPollAt == null
                ? 'بانتظار أول تحديث'
                : 'آخر تحديث ${_formatTime(lastPollAt!)}',
          ),
          if (error != null) _ErrorBanner(message: error!, onRetry: onRefresh),
          if (orders.isEmpty)
            const _EmptyState(
              icon: Icons.receipt_long,
              title: 'لا توجد طلبات',
              subtitle: 'الطلبات الجديدة تظهر هنا وتطبع مرة واحدة فقط.',
            )
          else
            ...orders.map((order) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _OrderCard(
                  order: order,
                  catalog: catalog,
                  isNew: highlightedOrderIds.contains(order.id),
                  isUpdating: updatingOrderIds.contains(order.id),
                  isPrinted: printedOrderIds.contains(order.id),
                  completedMode: completedMode,
                  onSeen: () => onClearHighlight(order.id),
                  onReprint: () => onReprint(order),
                  onStatus: (status) => onStatus(order, status),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.catalog,
    required this.isNew,
    required this.isUpdating,
    required this.isPrinted,
    required this.completedMode,
    required this.onSeen,
    required this.onReprint,
    required this.onStatus,
  });

  final MerchantOrder order;
  final MerchantCatalog? catalog;
  final bool isNew;
  final bool isUpdating;
  final bool isPrinted;
  final bool completedMode;
  final VoidCallback onSeen;
  final VoidCallback onReprint;
  final ValueChanged<String> onStatus;

  @override
  Widget build(BuildContext context) {
    final borderColor = isNew ? AppColors.neonTeal : Colors.transparent;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: borderColor, width: isNew ? 2 : 0),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onSeen,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '#${order.shortId}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  if (isNew) _Badge(text: 'جديد', color: AppColors.neonTeal),
                  const SizedBox(width: 6),
                  _Badge(
                      text: order.status,
                      color: _orderStatusColor(order.status)),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _TinyInfo(icon: Icons.person, text: order.customerName),
                  if (order.customerPhone.isNotEmpty)
                    _TinyInfo(icon: Icons.phone, text: order.customerPhone),
                  _TinyInfo(icon: Icons.payments, text: order.paymentLabel),
                  if (isPrinted)
                    const _TinyInfo(icon: Icons.print, text: 'Printed'),
                ],
              ),
              const SizedBox(height: 10),
              Text(order.deliveryAddress),
              const Divider(height: 22),
              ..._orderItemRows(),
              if (order.specialInstructions.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Notes: ${order.specialInstructions}'),
              ],
              const SizedBox(height: 10),
              Text(
                'Customer pays ${order.total.toStringAsFixed(2)} ILS',
                style:
                    const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: onReprint,
                    icon: const Icon(Icons.print),
                    label: const Text('Reprint'),
                  ),
                  if (isNew)
                    OutlinedButton.icon(
                      onPressed: onSeen,
                      icon: const Icon(Icons.visibility),
                      label: const Text('استلام'),
                    ),
                  if (!completedMode)
                    for (final action in const [
                      ('Confirm', 'CONFIRMED'),
                      ('Preparing', 'PREPARING'),
                      ('Ready', 'READY'),
                      ('Completed', 'COMPLETED'),
                    ])
                      FilledButton(
                        onPressed:
                            isUpdating ? null : () => onStatus(action.$2),
                        child: Text(isUpdating ? 'Saving...' : action.$1),
                      ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _orderItemRows() {
    if (order.itemDetails.isEmpty) {
      return order.items
          .map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                item,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          )
          .toList();
    }
    return order.itemDetails
        .map(
          (item) => _OrderItemRow(
            item: item,
            imageUrl: _imageUrlFor(item),
            description: _descriptionFor(item),
          ),
        )
        .toList();
  }

  String _imageUrlFor(MerchantOrderItem item) {
    if (item.imageUrl.trim().isNotEmpty) return item.imageUrl.trim();
    for (final product in catalog?.products ?? const <MerchantProduct>[]) {
      final sameId = item.productId.isNotEmpty && product.id == item.productId;
      final sameName =
          product.name.trim().toLowerCase() == item.name.trim().toLowerCase();
      if ((sameId || sameName) && product.imageUrl.trim().isNotEmpty) {
        return product.imageUrl.trim();
      }
    }
    return '';
  }

  String _descriptionFor(MerchantOrderItem item) {
    if (item.description.trim().isNotEmpty) return item.description.trim();
    for (final product in catalog?.products ?? const <MerchantProduct>[]) {
      final sameId = item.productId.isNotEmpty && product.id == item.productId;
      final sameName =
          product.name.trim().toLowerCase() == item.name.trim().toLowerCase();
      if ((sameId || sameName) && product.description.trim().isNotEmpty) {
        return product.description.trim();
      }
    }
    return '';
  }
}

class _OrderItemRow extends StatelessWidget {
  const _OrderItemRow({
    required this.item,
    required this.imageUrl,
    required this.description,
  });

  final MerchantOrderItem item;
  final String imageUrl;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ProductThumb(imageUrl: imageUrl),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${item.quantityLabel}x ${item.name}',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                if (description.trim().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      'وصف: ${description.trim()}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.black87,
                          ),
                    ),
                  ),
                for (final modifier in item.modifiers)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '- $modifier',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                if (item.notes.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('ملاحظة: ${item.notes}'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductThumb extends StatelessWidget {
  const _ProductThumb({required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: AppColors.lightBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Icon(Icons.fastfood, size: 22),
    );
    if (imageUrl.trim().isEmpty) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Image.network(
        imageUrl,
        width: 48,
        height: 48,
        fit: BoxFit.cover,
        gaplessPlayback: true,
        errorBuilder: (_, __, ___) => placeholder,
      ),
    );
  }
}

class _AnalyticsView extends StatelessWidget {
  const _AnalyticsView({required this.stats, required this.isLoading});

  final Map<String, MerchantStats> stats;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final today = stats['today'] ?? MerchantStats.zero();
    final week = stats['week'] ?? MerchantStats.zero();
    final month = stats['month'] ?? MerchantStats.zero();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (isLoading) const LinearProgressIndicator(),
        _InfoStrip(
          icon: Icons.insights,
          title: 'Lightweight analytics',
          subtitle:
              'Uses merchant stats when available, otherwise live orders.',
        ),
        _StatsGrid(stats: today, label: 'Today'),
        _StatsGrid(stats: week, label: 'This week'),
        _StatsGrid(stats: month, label: 'This month'),
      ],
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats, required this.label});

  final MerchantStats stats;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _MetricCard('Orders', stats.orderCount.toString()),
                _MetricCard('Sales', _money(stats.totalSales)),
                _MetricCard('Cash',
                    '${stats.cashOrderCount} / ${_money(stats.cashSales)}'),
                _MetricCard('Card',
                    '${stats.cardOrderCount} / ${_money(stats.cardSales)}'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductsView extends StatefulWidget {
  const _ProductsView({
    required this.catalog,
    required this.isLoading,
    required this.isWriting,
    required this.error,
    required this.searchController,
    required this.onRefresh,
    required this.onAdd,
    required this.onEdit,
    required this.onToggleArchive,
    required this.onToggleAvailable,
  });

  final MerchantCatalog? catalog;
  final bool isLoading;
  final bool isWriting;
  final String? error;
  final TextEditingController searchController;
  final Future<void> Function() onRefresh;
  final VoidCallback onAdd;
  final ValueChanged<MerchantProduct> onEdit;
  final ValueChanged<MerchantProduct> onToggleArchive;
  final ValueChanged<MerchantProduct> onToggleAvailable;

  @override
  State<_ProductsView> createState() => _ProductsViewState();
}

class _ProductsViewState extends State<_ProductsView> {
  @override
  void initState() {
    super.initState();
    widget.searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    widget.searchController.removeListener(_onSearchChanged);
    super.dispose();
  }

  void _onSearchChanged() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final query = widget.searchController.text.trim().toLowerCase();
    final products = (widget.catalog?.products ?? const <MerchantProduct>[])
        .where((product) =>
            query.isEmpty || product.name.toLowerCase().contains(query))
        .toList();
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (widget.isLoading || widget.isWriting)
            const LinearProgressIndicator(),
          _InfoStrip(
            icon: Icons.shield_outlined,
            title: 'Safe catalog writes enabled',
            subtitle:
                'Every edit fetches latest catalog before PUT full catalog.',
          ),
          TextField(
            controller: widget.searchController,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search products',
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: widget.isWriting ? null : widget.onAdd,
            icon: const Icon(Icons.add),
            label: const Text('Add product'),
          ),
          if (widget.error != null)
            _ErrorBanner(message: widget.error!, onRetry: widget.onRefresh),
          if (products.isEmpty)
            const _EmptyState(
              icon: Icons.inventory_2_outlined,
              title: 'No products',
              subtitle: 'Products from the canonical catalog appear here.',
            )
          else
            ...products.map(
              (product) => _ProductCard(
                product: product,
                categoryName:
                    _categoryNameFor(product.categoryId) ?? 'No category',
                onEdit: () => widget.onEdit(product),
                onToggleArchive: () => widget.onToggleArchive(product),
                onToggleAvailable: () => widget.onToggleAvailable(product),
              ),
            ),
        ],
      ),
    );
  }

  String? _categoryNameFor(String categoryId) {
    for (final category
        in widget.catalog?.categories ?? const <MerchantCategory>[]) {
      if (category.id == categoryId) return category.name;
    }
    return null;
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.categoryName,
    required this.onEdit,
    required this.onToggleArchive,
    required this.onToggleAvailable,
  });

  final MerchantProduct product;
  final String categoryName;
  final VoidCallback onEdit;
  final VoidCallback onToggleArchive;
  final VoidCallback onToggleAvailable;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    product.name,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                _Badge(
                  text: product.isArchived
                      ? 'Archived'
                      : product.isAvailable
                          ? 'Visible'
                          : 'Unavailable',
                  color: product.isArchived
                      ? Colors.grey
                      : product.isAvailable
                          ? AppColors.primaryTeal
                          : Colors.orange,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('$categoryName - ${product.basePrice.toStringAsFixed(2)} ILS'),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit),
                  label: const Text('Edit'),
                ),
                OutlinedButton.icon(
                  onPressed: onToggleAvailable,
                  icon: Icon(product.isAvailable
                      ? Icons.visibility_off
                      : Icons.visibility),
                  label:
                      Text(product.isAvailable ? 'Unavailable' : 'Available'),
                ),
                FilledButton.tonalIcon(
                  onPressed: onToggleArchive,
                  icon: Icon(
                      product.isArchived ? Icons.unarchive : Icons.archive),
                  label: Text(product.isArchived ? 'Unarchive' : 'Archive'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoriesView extends StatelessWidget {
  const _CategoriesView({
    required this.catalog,
    required this.isLoading,
    required this.isWriting,
    required this.error,
    required this.onRefresh,
    required this.onAdd,
    required this.onEdit,
    required this.onToggleVisible,
  });

  final MerchantCatalog? catalog;
  final bool isLoading;
  final bool isWriting;
  final String? error;
  final Future<void> Function() onRefresh;
  final VoidCallback onAdd;
  final ValueChanged<MerchantCategory> onEdit;
  final ValueChanged<MerchantCategory> onToggleVisible;

  @override
  Widget build(BuildContext context) {
    final categories = catalog?.categories ?? const <MerchantCategory>[];
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (isLoading || isWriting) const LinearProgressIndicator(),
          _InfoStrip(
            icon: Icons.category_outlined,
            title: 'Customer visibility parity',
            subtitle: 'Hidden categories are removed from customer Flutter.',
          ),
          FilledButton.icon(
            onPressed: isWriting ? null : onAdd,
            icon: const Icon(Icons.add),
            label: const Text('Add category'),
          ),
          if (error != null) _ErrorBanner(message: error!, onRetry: onRefresh),
          if (categories.isEmpty)
            const _EmptyState(
              icon: Icons.category_outlined,
              title: 'No categories',
              subtitle: 'Categories from the canonical catalog appear here.',
            )
          else
            ...categories.map(
              (category) {
                final count = catalog?.products
                        .where((product) => product.categoryId == category.id)
                        .length ??
                    0;
                return Card(
                  margin: const EdgeInsets.only(top: 12),
                  child: ListTile(
                    title: Text(
                      category.name,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    subtitle: Text('$count products'),
                    leading: Icon(
                      category.isVisible
                          ? Icons.visibility
                          : Icons.visibility_off,
                    ),
                    trailing: Wrap(
                      spacing: 6,
                      children: [
                        IconButton(
                          onPressed: () => onEdit(category),
                          icon: const Icon(Icons.edit),
                        ),
                        IconButton(
                          onPressed: () => onToggleVisible(category),
                          icon: Icon(
                            category.isVisible
                                ? Icons.archive
                                : Icons.unarchive,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

class _SettingsView extends StatelessWidget {
  const _SettingsView({
    required this.settings,
    required this.session,
    required this.syncingStatus,
    required this.statusMessage,
    required this.statusError,
    required this.lastPollAt,
    required this.onStatusChanged,
    required this.onLogout,
  });

  final TenantSettings? settings;
  final MerchantSession session;
  final String? syncingStatus;
  final String? statusMessage;
  final String? statusError;
  final DateTime? lastPollAt;
  final ValueChanged<String> onStatusChanged;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final status = settings?.operationalStatus ?? 'open';
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  settings?.name ?? 'Store Status',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 18),
                ),
                const SizedBox(height: 8),
                _StatusPill(status: status),
                const SizedBox(height: 14),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'open', label: Text('Open')),
                    ButtonSegment(value: 'busy', label: Text('Busy')),
                    ButtonSegment(value: 'closed', label: Text('Closed')),
                  ],
                  selected: {status},
                  onSelectionChanged: syncingStatus == null
                      ? (value) => onStatusChanged(value.single)
                      : null,
                ),
                if (syncingStatus != null) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(),
                ],
                if (statusMessage != null) ...[
                  const SizedBox(height: 12),
                  _InfoStrip(
                    icon: Icons.verified,
                    title: 'Status synced',
                    subtitle: statusMessage!,
                  ),
                ],
                if (statusError != null)
                  _ErrorBanner(
                    message: statusError!,
                    onRetry: () async {},
                  ),
              ],
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.account_circle_outlined),
            title: Text(session.userEmail ?? 'Merchant account'),
            subtitle: Text('Tenant ${session.tenantId}'),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.print),
            title: const Text('Sunmi printer'),
            subtitle: const Text('Auto-print once per new actionable order'),
            trailing: Icon(
              defaultTargetPlatform == TargetPlatform.android
                  ? Icons.check_circle
                  : Icons.info_outline,
              color: AppColors.primaryTeal,
            ),
          ),
        ),
        if (lastPollAt != null)
          Card(
            child: ListTile(
              leading: const Icon(Icons.sync),
              title: const Text('Last orders sync'),
              subtitle: Text(_formatTime(lastPollAt!)),
            ),
          ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: onLogout,
          icon: const Icon(Icons.logout),
          label: const Text('Logout'),
        ),
      ],
    );
  }
}

class _ProductDialog extends StatefulWidget {
  const _ProductDialog({required this.product, required this.categories});

  final MerchantProduct? product;
  final List<MerchantCategory> categories;

  @override
  State<_ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<_ProductDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  String? _categoryId;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.product?.name ?? '');
    _priceController = TextEditingController(
      text: widget.product?.basePrice.toStringAsFixed(2) ?? '',
    );
    _categoryId = widget.product?.categoryId ??
        (widget.categories.isEmpty ? null : widget.categories.first.id);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.product == null ? 'Add product' : 'Edit product'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Product name'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _priceController,
              decoration: const InputDecoration(labelText: 'Price'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _categoryId,
              decoration: const InputDecoration(labelText: 'Category'),
              items: widget.categories
                  .map((category) => DropdownMenuItem(
                        value: category.id,
                        child: Text(category.name),
                      ))
                  .toList(),
              onChanged: (value) => setState(() => _categoryId = value),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final name = _nameController.text.trim();
            final price = double.tryParse(_priceController.text.trim()) ?? 0;
            if (name.isEmpty || _categoryId == null || price <= 0) return;
            Navigator.pop(
              context,
              _ProductFormResult(name, price, _categoryId!),
            );
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _NameDialog extends StatefulWidget {
  const _NameDialog({required this.title, this.initialValue});

  final String title;
  final String? initialValue;

  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        decoration: const InputDecoration(labelText: 'Name'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _ProductFormResult {
  const _ProductFormResult(this.name, this.price, this.categoryId);
  final String name;
  final double price;
  final String categoryId;
}

class _InfoStrip extends StatelessWidget {
  const _InfoStrip({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primaryTeal),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: MaterialBanner(
        content: Text(message),
        leading: const Icon(Icons.warning_amber),
        actions: [
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 64),
      child: Column(
        children: [
          Icon(icon, size: 56, color: AppColors.primaryTeal),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(subtitle, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 148,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primaryTeal.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text.toUpperCase(),
        style:
            TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 12),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: _Badge(text: _statusLabel(status), color: color),
    );
  }
}

class _TinyInfo extends StatelessWidget {
  const _TinyInfo({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 17),
      label: Text(text),
      visualDensity: VisualDensity.compact,
    );
  }
}

Color _statusColor(String status) {
  return switch (status.toLowerCase()) {
    'open' => AppColors.primaryTeal,
    'busy' => Colors.orange,
    _ => Colors.red,
  };
}

Color _orderStatusColor(String status) {
  return switch (status.toUpperCase()) {
    'PENDING' || 'NEW' || 'PLACED' || 'WAITING_APPROVAL' => Colors.orange,
    'CONFIRMED' || 'PREPARING' => Colors.blue,
    'READY' => AppColors.neonTeal,
    'COMPLETED' => AppColors.primaryTeal,
    _ => Colors.grey,
  };
}

String _statusLabel(String status) {
  return switch (status.toLowerCase()) {
    'open' => 'Open',
    'busy' => 'Busy',
    'closed' => 'Closed',
    _ => status,
  };
}

String _formatTime(DateTime value) {
  return '${value.hour.toString().padLeft(2, '0')}:'
      '${value.minute.toString().padLeft(2, '0')}:'
      '${value.second.toString().padLeft(2, '0')}';
}

String _money(double value) => '${value.toStringAsFixed(2)} ILS';
