import 'dart:convert';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../api/models/product.dart';
import '../../../../api/storefront_api.dart';
import '../../../../core/errors/app_error_mapper.dart';
import '../../../../design_system/design_system.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import '../../application/cart_cubit.dart';
import '../widgets/cart_modifier_lines.dart';
import '../widgets/premium_checkout_dock.dart';
import '../widgets/premium_coupon_apply_row.dart';
import '../../../../widgets/app_error_view.dart';

/// Maps Hyp session API errors (502/503) to a snackbar string with result code when present.
String _hypSessionErrorMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map) {
      final m = Map<String, dynamic>.from(data);
      final code = m['code']?.toString().trim();
      if (code == 'HYP_CONFIG_ERROR' || code == 'HYP_DISABLED') {
        return m['details']?.toString().trim().isNotEmpty == true
            ? m['details'].toString()
            : 'بوابة الدفع: تحقق من إعدادات الخادم (.env)';
      }
      final hyp = m['hypResult']?.toString().trim();
      final hypMsg = m['hypMessage']?.toString().trim();
      final details = m['details']?.toString().trim();
      final err = m['error']?.toString().trim();
      final httpStatus = m['httpStatus'];
      final parts = <String>[];
      if (hyp != null && hyp.isNotEmpty && hyp != '000') {
        parts.add('خطأ $hyp');
      }
      if (hypMsg != null && hypMsg.isNotEmpty) {
        parts.add(hypMsg);
      } else if (details != null && details.isNotEmpty) {
        parts.add(details);
      }
      if (parts.isNotEmpty) {
        return parts.join(' — ');
      }
      if (err != null && err.isNotEmpty) return err;
      if (httpStatus != null) {
        final msg = error.message;
        return 'HTTP $httpStatus${msg != null && msg.trim().isNotEmpty ? ' — $msg' : ''}';
      }
    }
    final m = error.message;
    if (m != null && m.trim().isNotEmpty) return m;
    return 'تعذّر بدء الدفع';
  }
  return error.toString();
}

/// Same as web `ADDITIONAL_STORE_DELIVERY_FEE_NIS` (`apps/storefront/src/store/cart.ts`).
const double _kAdditionalStoreDeliveryFeeNis = 5;

/// Web parity: `DEFAULT_DELIVERY_ADDRESS` in `CheckoutPage.tsx`.
const String _kDefaultDeliveryAddress =
    'دبورية - تواصل معي بالواتساب لتحديد الموقع';

/// Native checkout — API orders, coupons, delivery zones (no WhatsApp / points).
class CheckoutPage extends StatefulWidget {
  const CheckoutPage({super.key, required this.marketSlug});

  final String marketSlug;

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController(text: _kDefaultDeliveryAddress);
  final _notesCtrl = TextEditingController();
  final _couponCtrl = TextEditingController();

  Future<_CheckoutBootstrap>? _bootstrap;
  List<Map<String, dynamic>> _suggestedCoupons = const [];
  _Fulfillment _fulfillment = _Fulfillment.delivery;
  _PaymentMethod _paymentMethod = _PaymentMethod.cash;
  String? _selectedZoneId;
  _AppliedCoupon? _appliedCoupon;
  String? _couponError;
  bool _couponLoading = false;
  bool _submitting = false;
  final Set<String> _touched = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startBootstrap());
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _notesCtrl.dispose();
    _couponCtrl.dispose();
    super.dispose();
  }

  void _startBootstrap() {
    if (!mounted) return;
    final cartCubit = context.read<CartCubit>();
    final cart = cartCubit.state;
    if (cart.isEmpty) {
      context.pop();
      return;
    }
    setState(() {
      _bootstrap = _loadBootstrap(context.read<Dio>(), cart, cartCubit);
    });
  }

  Future<void> _refreshProfileAndRewards(StorefrontApi api) async {
    final me = await api.getCustomerMe();
    if (!mounted || me == null) return;
    final name = me['name']?.toString().trim();
    final phone = me['phone']?.toString().trim();
    setState(() {
      if (name != null && name.isNotEmpty) _nameCtrl.text = name;
      if (phone != null && phone.isNotEmpty) _phoneCtrl.text = phone;
    });
    final rewards = await api.getCustomerRewards();
    if (!mounted) return;
    setState(() => _suggestedCoupons = rewards);
  }

  Future<_CheckoutBootstrap> _loadBootstrap(
      Dio dio, List<CartLine> lines, CartCubit cartCubit) async {
    final api = StorefrontApi(dio);
    final tenantIds = <String>[];
    for (final line in lines) {
      if (!tenantIds.contains(line.tenantId)) tenantIds.add(line.tenantId);
    }
    final productsByTenant = <String, List<Product>>{};
    for (final tid in tenantIds) {
      productsByTenant[tid] = await api.getCatalogProducts(tid);
    }
    if (mounted) {
      await cartCubit.repriceFromCatalogForTenants(productsByTenant);
    }
    lines = cartCubit.state;
    final market = await api.getMarketBySlug(widget.marketSlug);
    final marketId = market['id']?.toString();
    if (marketId == null || marketId.isEmpty) throw Exception('Market missing');

    final tenants = await api.getTenants(marketId);
    final allowed = <String, String>{};
    for (final t in tenants) {
      final id = t['id']?.toString();
      if (id == null || id.isEmpty) continue;
      allowed[id] = (t['name']?.toString() ?? 'متجر').trim();
    }

    final orderedTenantIds = <String>[];
    for (final line in lines) {
      if (!orderedTenantIds.contains(line.tenantId))
        orderedTenantIds.add(line.tenantId);
    }

    var sameMarket = true;
    for (final tid in orderedTenantIds) {
      if (!allowed.containsKey(tid)) {
        sameMarket = false;
        break;
      }
    }

    final primaryTenantId = orderedTenantIds.first;
    final deliverySettings = await api.getDeliverySettings(primaryTenantId);
    final zonesRaw = await api.getDeliveryZones(primaryTenantId);
    final zones = zonesRaw.where((z) => z['isActive'] != false).toList();
    final tenantFullResponse = await dio
        .get<dynamic>('/tenants/by-id/${Uri.encodeComponent(primaryTenantId)}');
    final tenantFullRaw = tenantFullResponse.data;
    final tenantFull = tenantFullRaw is Map<String, dynamic>
        ? tenantFullRaw
        : (tenantFullRaw is Map
            ? Map<String, dynamic>.from(tenantFullRaw)
            : <String, dynamic>{});
    final globalPaymentsResponse =
        await dio.get<dynamic>('/config/payment-methods');
    final globalPaymentsRaw = globalPaymentsResponse.data;
    final globalPayments = globalPaymentsRaw is Map<String, dynamic>
        ? globalPaymentsRaw
        : (globalPaymentsRaw is Map
            ? Map<String, dynamic>.from(globalPaymentsRaw)
            : <String, dynamic>{});

    if (mounted) {
      await _refreshProfileAndRewards(api);
      if (_selectedZoneId == null && zones.isNotEmpty) {
        setState(() => _selectedZoneId = zones.first['id']?.toString());
      }
    }

    return _CheckoutBootstrap(
      marketId: marketId,
      primaryTenantId: primaryTenantId,
      orderedTenantIds: orderedTenantIds,
      tenantNames: allowed,
      sameMarketOk: sameMarket,
      deliverySettings: deliverySettings,
      zones: zones,
      tenantPaymentMethods: tenantFull['paymentMethods'] is Map
          ? Map<String, dynamic>.from(tenantFull['paymentMethods'] as Map)
          : const <String, dynamic>{},
      globalPaymentMethods: globalPayments['paymentMethods'] is Map
          ? Map<String, dynamic>.from(globalPayments['paymentMethods'] as Map)
          : const <String, dynamic>{},
    );
  }

  Future<void> _applyCoupon(
    StorefrontApi api, {
    required String code,
    required String primaryTenantId,
    required List<String> cartStoreIds,
    required double subtotalAll,
    String? customerPhone,
  }) async {
    final trimmed = code.trim();
    if (trimmed.isEmpty) return;
    setState(() {
      _couponLoading = true;
      _couponError = null;
    });
    try {
      final res = await api.validateCoupon(
        code: trimmed,
        tenantId: primaryTenantId,
        cartStoreIds: cartStoreIds,
        subtotal: subtotalAll,
        customerPhone: customerPhone,
      );
      if (!mounted) return;
      final valid = res['valid'] == true;
      final coupon = res['coupon'];
      if (valid && coupon is Map) {
        final m = Map<String, dynamic>.from(coupon);
        final id = m['id']?.toString() ?? '';
        final c = m['code']?.toString() ?? trimmed.toUpperCase();
        final discount = (m['discountAmount'] is num)
            ? (m['discountAmount'] as num).toDouble()
            : 0.0;
        setState(() {
          _appliedCoupon =
              _AppliedCoupon(id: id, code: c, discountAmount: discount);
          _couponCtrl.text = c;
          _couponError = null;
        });
      } else {
        setState(() {
          _appliedCoupon = null;
          _couponError = res['error']?.toString() ?? 'الكود غير صحيح';
        });
      }
    } on DioException catch (e) {
      if (!mounted) return;
      if (e.response?.statusCode == 401) {
        setState(() => _couponError = 'يرجى تسجيل الدخول لاستخدام الكود');
      } else {
        setState(() => _couponError = 'تعذّر التحقق من الكود');
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _couponError = 'تعذّر التحقق من الكود');
    } finally {
      if (mounted) setState(() => _couponLoading = false);
    }
  }

  String _orderGroupId() {
    final r = math.Random();
    final bytes = List<int>.generate(16, (_) => r.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = '0123456789abcdef';
    final sb = StringBuffer();
    for (var i = 0; i < 16; i++) {
      sb.write(hex[bytes[i] >> 4]);
      sb.write(hex[bytes[i] & 0x0f]);
      if (i == 3 || i == 5 || i == 7 || i == 9) sb.write('-');
    }
    return sb.toString();
  }

  Map<String, dynamic> _lineToOrderItem(CartLine line) {
    final merchantTotal = line.merchantUnitPrice * line.quantity;
    final modifierLines =
        modifierLinesFromCart(line.selectedOptions, line.optionGroupsJson);
    final modifierSummaryAr = modifierLines.map((m) => m.text).toList();
    final selected = line.selectedOptions
        .map(
          (o) => <String, dynamic>{
            'optionGroupId': o.optionGroupId,
            'optionItemIds': o.optionItemIds,
            if (o.sliceSelection != null && o.sliceSelection!.isNotEmpty)
              'sliceSelection': o.sliceSelection,
            if (o.optionPlacements.isNotEmpty)
              'optionPlacements': o.optionPlacements,
          },
        )
        .toList();
    return <String, dynamic>{
      'id': 'line-${line.lineKey}',
      'productId': line.productId,
      'productName': line.name,
      'quantity': line.quantity,
      'basePrice': line.merchantUnitPrice,
      'selectedOptions': selected,
      'optionGroups': jsonDecode(line.optionGroupsJson) as List<dynamic>,
      if (modifierSummaryAr.isNotEmpty) 'modifierSummaryAr': modifierSummaryAr,
      'totalPrice': merchantTotal,
      if (line.imageUrl.isNotEmpty) 'imageUrl': line.imageUrl,
    };
  }

  Future<void> _submit(
    BuildContext context,
    _CheckoutBootstrap data,
    List<CartLine> lines,
    double deliveryFee,
    double couponDiscount,
    double grandTotal,
  ) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    final dio = context.read<Dio>();
    final api = StorefrontApi(dio);
    final cartCubit = context.read<CartCubit>();
    final slug = widget.marketSlug;
    final messenger = ScaffoldMessenger.maybeOf(context);
    final router = GoRouter.of(context);
    final coinsCubit = context.read<CoinsBalanceCubit>();

    try {
      final ok = await ensureCustomerAuth(context);
      if (!mounted || !ok) return;

      final name = _nameCtrl.text.trim();
      final phone = _phoneCtrl.text.trim();
      final addressText =
          _fulfillment == _Fulfillment.delivery ? _addressCtrl.text.trim() : '';
      final notes = _notesCtrl.text.trim();

      if (name.isEmpty || phone.isEmpty) {
        messenger?.showSnackBar(
            const SnackBar(content: Text('الاسم ورقم الجوال مطلوبان')));
        return;
      }
      if (_fulfillment == _Fulfillment.delivery) {
        if (addressText.isEmpty) {
          messenger?.showSnackBar(
              const SnackBar(content: Text('عنوان التوصيل مطلوب')));
          return;
        }
        if (data.zones.isNotEmpty &&
            (_selectedZoneId == null || _selectedZoneId!.isEmpty)) {
          messenger?.showSnackBar(
              const SnackBar(content: Text('اختر منطقة التوصيل')));
          return;
        }
      }

      if (!data.sameMarketOk) {
        messenger?.showSnackBar(
          const SnackBar(
              content:
                  Text('لا يمكن الجمع بين متاجر من أسواق مختلفة في طلب واحد.')),
        );
        return;
      }

      Map<String, dynamic>? selectedZone;
      for (final z in data.zones) {
        if (z['id']?.toString() == _selectedZoneId) {
          selectedZone = z;
          break;
        }
      }

      final groupId = _orderGroupId();
      final tenantIds = data.orderedTenantIds;

      for (var i = 0; i < tenantIds.length; i++) {
        final tid = tenantIds[i];
        final storeLines = lines.where((l) => l.tenantId == tid).toList();
        if (storeLines.isEmpty) continue;
        final items = storeLines.map(_lineToOrderItem).toList();
        final isFirst = i == 0;
        final orderDeliveryFee =
            _fulfillment == _Fulfillment.delivery && isFirst ? deliveryFee : 0;

        final body = <String, dynamic>{
          'tenantId': tid,
          'items': items,
          'fulfillmentType':
              _fulfillment == _Fulfillment.delivery ? 'DELIVERY' : 'PICKUP',
          'paymentMethod':
              _paymentMethod == _PaymentMethod.card ? 'CARD' : 'CASH',
          if (notes.isNotEmpty) 'notes': notes,
          'customerName': name,
          'customerPhone': phone,
          if (_fulfillment == _Fulfillment.delivery && addressText.isNotEmpty)
            'deliveryAddress': addressText,
          'orderGroupId': groupId,
          'delivery': <String, dynamic>{
            'method':
                _fulfillment == _Fulfillment.delivery ? 'DELIVERY' : 'PICKUP',
            if (selectedZone != null) 'zoneId': selectedZone['id']?.toString(),
            if (selectedZone != null)
              'zoneName': selectedZone['name']?.toString(),
            if (_fulfillment == _Fulfillment.delivery) 'fee': orderDeliveryFee,
            if (_fulfillment == _Fulfillment.delivery)
              'addressText': addressText,
          },
          if (isFirst && _appliedCoupon != null) 'couponId': _appliedCoupon!.id,
          if (isFirst && _appliedCoupon != null)
            'couponDiscountAmount': _appliedCoupon!.discountAmount,
        };

        await api.postOrder(body);
      }

      if (_paymentMethod == _PaymentMethod.card) {
        try {
          final hyp = await api.postHypPaymentSession(orderGroupId: groupId);
          final paymentUrl = hyp['url']?.toString().trim() ??
              hyp['paymentUrl']?.toString().trim() ??
              '';
          if (paymentUrl.isEmpty) {
            final fallback =
                hyp['details']?.toString() ?? hyp['error']?.toString() ?? '';
            messenger?.showSnackBar(
              SnackBar(
                content: Text(
                  fallback.isNotEmpty
                      ? 'رابط الدفع غير مُتاح: $fallback'
                      : 'رابط الدفع غير مُتاح (استجابة فارغة)',
                ),
              ),
            );
            return;
          }
          if (!mounted) return;
          final paid = await router.push<bool?>(
            '/market/$slug/payment/hyp',
            extra: paymentUrl,
          );
          if (!mounted) return;
          if (paid != true) {
            messenger?.showSnackBar(
              const SnackBar(
                  content: Text(
                      'لم يكتمل الدفع بالبطاقة بعد. يرجى إكمال الدفع داخل صفحة البطاقة.')),
            );
            return;
          }
          cartCubit.clear();
          await coinsCubit.load();
          messenger?.showSnackBar(
              const SnackBar(content: Text('تم الدفع بنجاح عبر البطاقة')));
          router.go('/market/$slug/orders');
        } catch (e) {
          if (!mounted) return;
          messenger?.showSnackBar(
            SnackBar(content: Text(_hypSessionErrorMessage(e))),
          );
        }
        return;
      }

      if (!mounted) return;
      cartCubit.clear();
      messenger
          ?.showSnackBar(const SnackBar(content: Text('تم إرسال طلبك بنجاح')));
      router.go('/market/$slug/orders');
    } on DioException catch (e) {
      if (!mounted) return;
      final msg =
          e.response?.data is Map && (e.response!.data as Map)['error'] != null
              ? (e.response!.data as Map)['error'].toString()
              : 'تعذّر إتمام الطلب';
      messenger?.showSnackBar(SnackBar(content: Text(msg)));
    } catch (e) {
      if (!mounted) return;
      messenger?.showSnackBar(SnackBar(content: Text('تعذّر إتمام الطلب: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final slug = widget.marketSlug;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: ColoredBox(
        color: NmdColors.surfaceMuted,
        child: Scaffold(
          backgroundColor: NmdColors.surfaceMuted,
          body: Column(
            children: [
              NmdAppHeader(
                title: 'إتمام الطلب',
                leading: NmdAppHeader.backLeading(
                  onPressed: () {
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/market/$slug/cart');
                    }
                  },
                ),
              ),
              Expanded(
                child: BlocBuilder<CartCubit, List<CartLine>>(
                  builder: (context, lines) {
                    if (lines.isEmpty) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (context.mounted) context.pop();
                      });
                      return const SizedBox.shrink();
                    }

                    final subtotalAll =
                        lines.fold<double>(0, (s, e) => s + e.lineTotal);
                    if (_bootstrap == null) {
                      return const NmdLoading(
                          message: 'جاري تحميل بيانات الطلب...');
                    }

                    return FutureBuilder<_CheckoutBootstrap>(
                      future: _bootstrap,
                      builder: (context, snap) {
                        if (snap.connectionState != ConnectionState.done) {
                          return const NmdLoading(
                              message: 'جاري تحميل بيانات الطلب...');
                        }
                        if (snap.hasError) {
                          return AppErrorView.fromError(
                            error: snap.error!,
                            context: 'checkout_bootstrap',
                            compact: true,
                            onRetry: () => setState(
                              () => _bootstrap = _loadBootstrap(
                                context.read<Dio>(),
                                context.read<CartCubit>().state,
                                context.read<CartCubit>(),
                              ),
                            ),
                          );
                        }
                        if (!snap.hasData) {
                          return AppErrorView(
                            title: 'تعذّر تحميل بيانات الطلب',
                            message: AppErrorMapper.unknownMessage,
                            compact: true,
                            onRetry: () => setState(
                              () => _bootstrap = _loadBootstrap(
                                context.read<Dio>(),
                                context.read<CartCubit>().state,
                                context.read<CartCubit>(),
                              ),
                            ),
                          );
                        }
                        final data = snap.data!;
                        final dio = context.read<Dio>();
                        final api = StorefrontApi(dio);

                        final deliveryMode =
                            data.deliverySettings['modes'] is Map
                                ? (data.deliverySettings['modes']
                                        as Map)['delivery'] !=
                                    false
                                : true;
                        final pickupMode = data.deliverySettings['modes'] is Map
                            ? (data.deliverySettings['modes']
                                    as Map)['pickup'] !=
                                false
                            : true;

                        if (!deliveryMode &&
                            _fulfillment == _Fulfillment.delivery) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted)
                              setState(
                                  () => _fulfillment = _Fulfillment.pickup);
                          });
                        }
                        if (!pickupMode &&
                            _fulfillment == _Fulfillment.pickup) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted)
                              setState(
                                  () => _fulfillment = _Fulfillment.delivery);
                          });
                        }

                        final baseDeliveryFee =
                            (data.deliverySettings['deliveryFee'] is num)
                                ? (data.deliverySettings['deliveryFee'] as num)
                                    .toDouble()
                                : 0.0;
                        Map<String, dynamic>? selectedZoneForFee;
                        for (final z in data.zones) {
                          if (z['id']?.toString() == _selectedZoneId) {
                            selectedZoneForFee = z;
                            break;
                          }
                        }
                        final baseZoneFee = _fulfillment ==
                                _Fulfillment.delivery
                            ? ((selectedZoneForFee != null &&
                                    selectedZoneForFee['fee'] is num)
                                ? (selectedZoneForFee['fee'] as num).toDouble()
                                : baseDeliveryFee)
                            : 0.0;
                        final storeCount = data.orderedTenantIds.length;
                        final additionalStoreFee = _fulfillment ==
                                    _Fulfillment.delivery &&
                                storeCount > 1
                            ? (storeCount - 1) * _kAdditionalStoreDeliveryFeeNis
                            : 0.0;
                        final deliveryFee =
                            _fulfillment == _Fulfillment.delivery
                                ? baseZoneFee + additionalStoreFee
                                : 0.0;
                        final couponDiscount =
                            _appliedCoupon?.discountAmount ?? 0.0;
                        final grandTotal = math.max(
                            0.0, subtotalAll + deliveryFee - couponDiscount);

                        final nameOk = _nameCtrl.text.trim().isNotEmpty;
                        final phoneOk = _phoneCtrl.text.trim().isNotEmpty;
                        final addressOk =
                            _fulfillment != _Fulfillment.delivery ||
                                _addressCtrl.text.trim().isNotEmpty;
                        final zoneOk = _fulfillment != _Fulfillment.delivery ||
                            data.zones.isEmpty ||
                            (_selectedZoneId != null &&
                                _selectedZoneId!.isNotEmpty);
                        final cashEnabled =
                            data.tenantPaymentMethods['cash'] != false;
                        if (_paymentMethod == _PaymentMethod.card) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted) {
                              setState(
                                  () => _paymentMethod = _PaymentMethod.cash);
                            }
                          });
                        }
                        final hasPaymentOption = cashEnabled;
                        final canSubmit = nameOk &&
                            phoneOk &&
                            addressOk &&
                            zoneOk &&
                            data.sameMarketOk &&
                            hasPaymentOption;

                        return Column(
                          children: [
                            Expanded(
                              child: ListView(
                                primary: true,
                                padding: const EdgeInsets.fromLTRB(
                                  NmdSpacing.screenHorizontal,
                                  NmdSpacing.xxs,
                                  NmdSpacing.screenHorizontal,
                                  NmdSpacing.xxs,
                                ),
                                children: [
                                  _CheckoutTrustBadge(),
                                  if (!data.sameMarketOk) ...[
                                    const SizedBox(height: NmdSpacing.xs),
                                    _CheckoutSection(
                                      child: Text(
                                        'لا يمكن الجمع بين متاجر من أسواق مختلفة في طلب واحد.',
                                        style: NmdTypography.label.copyWith(
                                          color: NmdColors.error,
                                        ),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: NmdSpacing.xxs),
                                  _CheckoutSection(
                                    title: 'طريقة الاستلام',
                                    child: _FulfillmentToggle(
                                      delivery: deliveryMode,
                                      pickup: pickupMode,
                                      value: _fulfillment,
                                      onChanged: (v) =>
                                          setState(() => _fulfillment = v),
                                    ),
                                  ),
                                  if (_fulfillment ==
                                      _Fulfillment.delivery) ...[
                                    const SizedBox(height: NmdSpacing.xs),
                                    _CheckoutSection(
                                      title: 'العنوان والمنطقة',
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          if (data.zones.isNotEmpty)
                                            DropdownButtonFormField<String>(
                                              // ignore: deprecated_member_use
                                              value: _selectedZoneId != null &&
                                                      data.zones.any((z) =>
                                                          z['id']?.toString() ==
                                                          _selectedZoneId)
                                                  ? _selectedZoneId
                                                  : null,
                                              decoration: _inputDecoration(
                                                  'منطقة التوصيل'),
                                              items: data.zones
                                                  .map(
                                                    (z) => DropdownMenuItem(
                                                      value:
                                                          z['id']?.toString(),
                                                      child: Text(
                                                        '${z['name'] ?? ''} — ₪${((z['fee'] is num) ? (z['fee'] as num).toStringAsFixed(0) : '0')}',
                                                        style: NmdTypography
                                                            .bodySmall,
                                                      ),
                                                    ),
                                                  )
                                                  .toList(),
                                              onChanged: (v) => setState(
                                                  () => _selectedZoneId = v),
                                            ),
                                          if (data.zones.isNotEmpty)
                                            const SizedBox(
                                                height: NmdSpacing.xs),
                                          TextField(
                                            controller: _addressCtrl,
                                            minLines: 2,
                                            maxLines: 3,
                                            onChanged: (_) => setState(() {}),
                                            decoration: _inputDecoration(
                                                    'عنوان التوصيل',
                                                    hint:
                                                        _kDefaultDeliveryAddress)
                                                .copyWith(
                                              errorText: _touched.contains(
                                                          'address') &&
                                                      _addressCtrl.text
                                                          .trim()
                                                          .isEmpty
                                                  ? 'مطلوب للتوصيل'
                                                  : null,
                                            ),
                                            onTap: () => setState(
                                                () => _touched.add('address')),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: NmdSpacing.xs),
                                  _CheckoutSection(
                                    title: 'بيانات التواصل',
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        _LabeledField(
                                          label: 'الاسم',
                                          controller: _nameCtrl,
                                          touched: _touched.contains('name'),
                                          errorText: _touched
                                                      .contains('name') &&
                                                  _nameCtrl.text.trim().isEmpty
                                              ? 'مطلوب'
                                              : null,
                                          onChanged: (_) => setState(() {}),
                                          onTap: () => setState(
                                              () => _touched.add('name')),
                                        ),
                                        const SizedBox(height: NmdSpacing.xs),
                                        _LabeledField(
                                          label: 'رقم الجوال',
                                          controller: _phoneCtrl,
                                          keyboardType: TextInputType.phone,
                                          touched: _touched.contains('phone'),
                                          errorText: _touched
                                                      .contains('phone') &&
                                                  _phoneCtrl.text.trim().isEmpty
                                              ? 'مطلوب'
                                              : null,
                                          onChanged: (_) => setState(() {}),
                                          onTap: () => setState(
                                              () => _touched.add('phone')),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: NmdSpacing.xs),
                                  _CheckoutSection(
                                    title: 'طريقة الدفع',
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        if (cashEnabled)
                                          _PaymentOptionTile(
                                            title: 'نقداً عند الاستلام',
                                            subtitle: 'الدفع نقداً عند التسليم',
                                            selected: _paymentMethod ==
                                                _PaymentMethod.cash,
                                            onTap: () => setState(() =>
                                                _paymentMethod =
                                                    _PaymentMethod.cash),
                                          ),
                                        const SizedBox(height: NmdSpacing.xs),
                                        _PaymentOptionTile(
                                          title: 'بطاقة ائتمان — قريبًا',
                                          subtitle: 'سيتوفر قريباً',
                                          selected: false,
                                          enabled: false,
                                          onTap: () {},
                                        ),
                                        if (!hasPaymentOption)
                                          Text(
                                            'لا توجد طرق دفع مفعّلة حالياً لهذا المتجر.',
                                            style: NmdTypography.micro.copyWith(
                                              color: NmdColors.error,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: NmdSpacing.xs),
                                  _CheckoutSection(
                                    title: 'ملخص الطلب',
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        for (var ti = 0;
                                            ti < data.orderedTenantIds.length;
                                            ti++) ...[
                                          if (ti > 0)
                                            const SizedBox(height: NmdSpacing.xs),
                                          if (data.orderedTenantIds.length > 1)
                                            Align(
                                              alignment: Alignment.centerRight,
                                              child: Text(
                                                data.tenantNames[
                                                        data.orderedTenantIds[
                                                            ti]] ??
                                                    'متجر',
                                                style: NmdTypography.micro
                                                    .copyWith(
                                                  color: NmdColors.brandPrimary,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ...lines
                                              .where((l) =>
                                                  l.tenantId ==
                                                  data.orderedTenantIds[ti])
                                              .map((line) => Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                            bottom: 6),
                                                    child: _CheckoutItemTile(
                                                        line: line),
                                                  )),
                                        ],
                                        const SizedBox(height: NmdSpacing.xs),
                                        const Divider(
                                          height: 1,
                                          color: NmdColors.divider,
                                        ),
                                        const SizedBox(height: NmdSpacing.xs),
                                        _checkoutSumRow(
                                          'المجموع',
                                          NmdFormat.money(subtotalAll),
                                          NmdColors.textPrimary,
                                        ),
                                        if (_fulfillment ==
                                            _Fulfillment.delivery) ...[
                                          const SizedBox(height: 4),
                                          _checkoutSumRow(
                                            'التوصيل',
                                            NmdFormat.money(deliveryFee),
                                            NmdColors.textPrimary,
                                          ),
                                        ],
                                        if (couponDiscount > 0) ...[
                                          const SizedBox(height: 4),
                                          _checkoutSumRow(
                                            'خصم',
                                            NmdFormat.moneySigned(
                                              couponDiscount,
                                              negative: true,
                                            ),
                                            NmdColors.error,
                                          ),
                                        ],
                                        const SizedBox(height: NmdSpacing.xs),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              NmdFormat.money(grandTotal),
                                              style: NmdTypography.price.copyWith(
                                                fontSize: 17,
                                              ),
                                            ),
                                            Text(
                                              'الإجمالي',
                                              style: NmdTypography.bodyBold,
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: NmdSpacing.xs),
                                  _CheckoutSection(
                                    title: 'كود الخصم',
                                    child: PremiumCouponApplyRow(
                                      controller: _couponCtrl,
                                      loading: _couponLoading,
                                      error: _couponError,
                                      appliedCode: _appliedCoupon?.code,
                                      onApply: _couponLoading
                                          ? () {}
                                          : () => _applyCoupon(
                                                api,
                                                code: _couponCtrl.text,
                                                primaryTenantId:
                                                    data.primaryTenantId,
                                                cartStoreIds:
                                                    data.orderedTenantIds,
                                                subtotalAll: subtotalAll,
                                                customerPhone: _phoneCtrl.text
                                                        .trim()
                                                        .isNotEmpty
                                                    ? _phoneCtrl.text.trim()
                                                    : null,
                                              ),
                                    ),
                                  ),
                                  if (_suggestedCoupons.isNotEmpty) ...[
                                    const SizedBox(height: NmdSpacing.xxs),
                                    SizedBox(
                                      height: 34,
                                      child: ListView.separated(
                                        scrollDirection: Axis.horizontal,
                                        reverse: true,
                                        primary: false,
                                        itemCount: _suggestedCoupons.length,
                                        separatorBuilder: (_, __) =>
                                            const SizedBox(width: 6),
                                        itemBuilder: (context, i) {
                                          final code = _suggestedCoupons[i]
                                                  ['code']
                                              ?.toString() ??
                                              '';
                                          return NmdChip(
                                            label: code,
                                            selected: false,
                                            onTap: _couponLoading
                                                ? null
                                                : () {
                                                    _couponCtrl.text = code;
                                                    _applyCoupon(
                                                      api,
                                                      code: code,
                                                      primaryTenantId:
                                                          data.primaryTenantId,
                                                      cartStoreIds:
                                                          data.orderedTenantIds,
                                                      subtotalAll: subtotalAll,
                                                      customerPhone: _phoneCtrl
                                                              .text
                                                              .trim()
                                                              .isNotEmpty
                                                          ? _phoneCtrl.text
                                                              .trim()
                                                          : null,
                                                    );
                                                  },
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: NmdSpacing.xxs),
                                  _CheckoutSection(
                                    title: 'ملاحظات',
                                    child: NmdInput(
                                      controller: _notesCtrl,
                                      label: 'ملاحظات للمتجر',
                                      hint: 'اختياري',
                                      maxLines: 2,
                                    ),
                                  ),
                                  const SizedBox(height: kPremiumCheckoutDockScrollInset),
                                ],
                              ),
                            ),
                            PremiumCheckoutDock(
                              total: grandTotal,
                              label: 'تأكيد الطلب',
                              loading: _submitting,
                              enabled: canSubmit,
                              onPressed: (!canSubmit || _submitting)
                                  ? null
                                  : () async {
                                      setState(() {
                                        _touched.addAll({
                                          'name',
                                          'phone',
                                          'address',
                                          'zone',
                                        });
                                      });
                                      final ok = await ensureCustomerAuth(
                                        context,
                                      );
                                      if (!context.mounted || !ok) {
                                        return;
                                      }
                                      await _refreshProfileAndRewards(api);
                                      if (!context.mounted) {
                                        return;
                                      }
                                      await _submit(
                                        context,
                                        data,
                                        lines,
                                        deliveryFee,
                                        couponDiscount,
                                        grandTotal,
                                      );
                                    },
                            ),
                          ],
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _Fulfillment { delivery, pickup }

enum _PaymentMethod { cash, card }

class _CheckoutTrustBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NmdSpacing.sm,
        vertical: 7,
      ),
      decoration: BoxDecoration(
        color: NmdColors.tintAliveSoft.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: NmdColors.brandPrimary.withValues(alpha: 0.12),
        ),
      ),
      child: Row(
        textDirection: TextDirection.rtl,
        children: [
          Icon(
            Icons.verified_user_outlined,
            size: 16,
            color: NmdColors.brandPrimary.withValues(alpha: 0.85),
          ),
          const SizedBox(width: NmdSpacing.xs),
          Expanded(
            child: Text(
              'راجع بياناتك ثم أكّد الطلب بأمان',
              style: NmdTypography.micro.copyWith(
                fontSize: 11,
                color: NmdColors.textPrimary.withValues(alpha: 0.88),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Widget _checkoutSumRow(String label, String value, Color valueColor) {
  return Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(
        value,
        style: NmdTypography.label.copyWith(
          color: valueColor,
          fontWeight: FontWeight.w600,
        ),
      ),
      Text(label, style: NmdTypography.micro),
    ],
  );
}

class _PaymentOptionTile extends StatelessWidget {
  const _PaymentOptionTile({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
    this.enabled = true,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final inactive = !enabled;
    return Opacity(
      opacity: inactive ? 0.55 : 1,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NmdSpacing.xs,
            vertical: NmdSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: selected
                ? NmdColors.tintAliveSoft
                : NmdColors.surfaceMuted,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? NmdColors.brandPrimary.withValues(alpha: 0.35)
                  : NmdColors.borderSubtle,
            ),
          ),
          child: Row(
            textDirection: TextDirection.rtl,
            children: [
              Icon(
                inactive
                    ? Icons.lock_outline
                    : (selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_off),
                size: 18,
                color: inactive
                    ? NmdColors.textTertiary
                    : (selected
                        ? NmdColors.brandPrimary
                        : NmdColors.textTertiary),
              ),
              const SizedBox(width: NmdSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      title,
                      style: NmdTypography.label.copyWith(
                        color: inactive
                            ? NmdColors.textSecondary
                            : NmdColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(subtitle, style: NmdTypography.micro.copyWith(
                      fontSize: 10,
                      color: NmdColors.textSecondary.withValues(alpha: 0.92),
                    )),
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

class _AppliedCoupon {
  const _AppliedCoupon(
      {required this.id, required this.code, required this.discountAmount});
  final String id;
  final String code;
  final double discountAmount;
}

class _CheckoutBootstrap {
  const _CheckoutBootstrap({
    required this.marketId,
    required this.primaryTenantId,
    required this.orderedTenantIds,
    required this.tenantNames,
    required this.sameMarketOk,
    required this.deliverySettings,
    required this.zones,
    required this.tenantPaymentMethods,
    required this.globalPaymentMethods,
  });

  final String marketId;
  final String primaryTenantId;
  final List<String> orderedTenantIds;
  final Map<String, String> tenantNames;
  final bool sameMarketOk;
  final Map<String, dynamic> deliverySettings;
  final List<Map<String, dynamic>> zones;
  final Map<String, dynamic> tenantPaymentMethods;
  final Map<String, dynamic> globalPaymentMethods;
}

InputDecoration _inputDecoration(String label, {String? hint}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
    labelStyle: NmdTypography.label,
    hintStyle: NmdTypography.bodySmall,
    filled: true,
    fillColor: NmdColors.surfaceMuted,
    border: OutlineInputBorder(borderRadius: NmdRadius.borderMd),
    enabledBorder: OutlineInputBorder(
      borderRadius: NmdRadius.borderMd,
      borderSide: const BorderSide(color: NmdColors.borderSubtle),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: NmdRadius.borderMd,
      borderSide: const BorderSide(color: NmdColors.brandPrimary, width: 1.5),
    ),
    contentPadding: const EdgeInsets.symmetric(
      horizontal: NmdSpacing.sm + 2,
      vertical: NmdSpacing.sm,
    ),
  );
}

class _CheckoutSection extends StatelessWidget {
  const _CheckoutSection({this.title, required this.child});

  final String? title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (title != null) ...[
          Padding(
            padding: const EdgeInsets.only(top: 1, bottom: 4),
            child: Text(
              title!,
              textAlign: TextAlign.right,
              style: NmdTypography.micro.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: NmdColors.textSecondary.withValues(alpha: 0.95),
                letterSpacing: 0.25,
              ),
            ),
          ),
        ],
        DecoratedBox(
          decoration: BoxDecoration(
            color: NmdColors.surfaceBase,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: NmdSpacing.sm,
              vertical: 7,
            ),
            child: child,
          ),
        ),
      ],
    );
  }
}

class _FulfillmentToggle extends StatelessWidget {
  const _FulfillmentToggle({
    required this.delivery,
    required this.pickup,
    required this.value,
    required this.onChanged,
  });

  final bool delivery;
  final bool pickup;
  final _Fulfillment value;
  final ValueChanged<_Fulfillment> onChanged;

  @override
  Widget build(BuildContext context) {
    if (!delivery && !pickup) {
      return Text('لا توجد طرق متاحة', style: NmdTypography.bodySmall);
    }
    return SegmentedButton<_Fulfillment>(
      segments: [
        if (delivery)
          ButtonSegment(
            value: _Fulfillment.delivery,
            label: Text('توصيل', style: NmdTypography.label),
            icon: const Icon(Icons.local_shipping_outlined, size: 18),
          ),
        if (pickup)
          ButtonSegment(
            value: _Fulfillment.pickup,
            label: Text('استلام', style: NmdTypography.label),
            icon: const Icon(Icons.storefront_outlined, size: 18),
          ),
      ],
      selected: {value},
      onSelectionChanged: (s) {
        if (s.isNotEmpty) onChanged(s.first);
      },
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return NmdColors.tintAlive;
          }
          return NmdColors.surfaceMuted;
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return NmdColors.brandPrimary;
          }
          return NmdColors.textSecondary;
        }),
        side: WidgetStateProperty.all(
          const BorderSide(color: NmdColors.borderSubtle),
        ),
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({
    required this.label,
    required this.controller,
    this.keyboardType,
    this.touched = false,
    this.errorText,
    this.onChanged,
    this.onTap,
  });

  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final bool touched;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return NmdInput(
      controller: controller,
      label: label,
      keyboardType: keyboardType,
      errorText: errorText,
      onChanged: (v) {
        onChanged?.call(v);
        onTap?.call();
      },
    );
  }
}

class _CheckoutItemTile extends StatelessWidget {
  const _CheckoutItemTile({required this.line});

  final CartLine line;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        textDirection: TextDirection.rtl,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 44,
              height: 44,
              child: line.imageUrl.isEmpty
                  ? ColoredBox(
                      color: NmdColors.tintAliveSoft,
                      child: Icon(
                        Icons.fastfood_outlined,
                        size: 18,
                        color: NmdColors.brandPrimary.withValues(alpha: 0.35),
                      ),
                    )
                  : Image.network(
                      line.imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          ColoredBox(color: NmdColors.tintAliveMuted),
                    ),
            ),
          ),
          const SizedBox(width: NmdSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  line.name,
                  textAlign: TextAlign.right,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: NmdTypography.label.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  '${line.quantity} × ${NmdFormat.money(line.unitPrice)}',
                  style: NmdTypography.micro.copyWith(
                    color: NmdColors.textSecondary,
                  ),
                ),
                if (line.selectedOptions.isNotEmpty)
                  CartModifierLines(
                    selectedOptions: line.selectedOptions,
                    optionGroupsJson: line.optionGroupsJson,
                    compact: true,
                  ),
              ],
            ),
          ),
          const SizedBox(width: NmdSpacing.xxs),
          Text(
            NmdFormat.money(line.lineTotal),
            style: NmdTypography.label.copyWith(
              color: NmdColors.brandPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
