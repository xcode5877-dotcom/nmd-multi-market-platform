import 'dart:convert';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import '../../application/cart_cubit.dart';
import '../widgets/cart_modifier_lines.dart';

const double _kPad = 16;

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
    final cart = context.read<CartCubit>().state;
    if (cart.isEmpty) {
      context.pop();
      return;
    }
    setState(() {
      _bootstrap = _loadBootstrap(context.read<Dio>(), cart);
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
      Dio dio, List<CartLine> lines) async {
    final api = StorefrontApi(dio);
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
    final total = line.lineTotal;
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
      'basePrice': line.unitPrice,
      'selectedOptions': selected,
      'optionGroups': jsonDecode(line.optionGroupsJson) as List<dynamic>,
      if (modifierSummaryAr.isNotEmpty) 'modifierSummaryAr': modifierSummaryAr,
      'totalPrice': total,
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
        color: AppColors.surface,
        child: Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            elevation: 0,
            scrolledUnderElevation: 0,
            backgroundColor: AppColors.surface,
            foregroundColor: AppColors.textPrimary,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded),
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/market/$slug/cart');
                }
              },
            ),
            title: Text(
              'إتمام الطلب',
              style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: AppColors.textPrimary),
            ),
          ),
          body: BlocBuilder<CartCubit, List<CartLine>>(
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
                return const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.primaryTeal));
              }

              return FutureBuilder<_CheckoutBootstrap>(
                future: _bootstrap,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Center(
                        child: CircularProgressIndicator(
                            color: AppColors.primaryTeal));
                  }
                  if (snap.hasError || !snap.hasData) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(_kPad),
                        child: Text(
                          'تعذّر تحميل بيانات الطلب',
                          style: GoogleFonts.cairo(),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    );
                  }
                  final data = snap.data!;
                  final dio = context.read<Dio>();
                  final api = StorefrontApi(dio);

                  final deliveryMode = data.deliverySettings['modes'] is Map
                      ? (data.deliverySettings['modes'] as Map)['delivery'] !=
                          false
                      : true;
                  final pickupMode = data.deliverySettings['modes'] is Map
                      ? (data.deliverySettings['modes'] as Map)['pickup'] !=
                          false
                      : true;

                  if (!deliveryMode && _fulfillment == _Fulfillment.delivery) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted)
                        setState(() => _fulfillment = _Fulfillment.pickup);
                    });
                  }
                  if (!pickupMode && _fulfillment == _Fulfillment.pickup) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted)
                        setState(() => _fulfillment = _Fulfillment.delivery);
                    });
                  }

                  final baseDeliveryFee = (data.deliverySettings['deliveryFee']
                          is num)
                      ? (data.deliverySettings['deliveryFee'] as num).toDouble()
                      : 0.0;
                  Map<String, dynamic>? selectedZoneForFee;
                  for (final z in data.zones) {
                    if (z['id']?.toString() == _selectedZoneId) {
                      selectedZoneForFee = z;
                      break;
                    }
                  }
                  final baseZoneFee = _fulfillment == _Fulfillment.delivery
                      ? ((selectedZoneForFee != null &&
                              selectedZoneForFee['fee'] is num)
                          ? (selectedZoneForFee['fee'] as num).toDouble()
                          : baseDeliveryFee)
                      : 0.0;
                  final storeCount = data.orderedTenantIds.length;
                  final additionalStoreFee =
                      _fulfillment == _Fulfillment.delivery && storeCount > 1
                          ? (storeCount - 1) * _kAdditionalStoreDeliveryFeeNis
                          : 0.0;
                  final deliveryFee = _fulfillment == _Fulfillment.delivery
                      ? baseZoneFee + additionalStoreFee
                      : 0.0;
                  final couponDiscount = _appliedCoupon?.discountAmount ?? 0.0;
                  final grandTotal =
                      math.max(0.0, subtotalAll + deliveryFee - couponDiscount);

                  final nameOk = _nameCtrl.text.trim().isNotEmpty;
                  final phoneOk = _phoneCtrl.text.trim().isNotEmpty;
                  final addressOk = _fulfillment != _Fulfillment.delivery ||
                      _addressCtrl.text.trim().isNotEmpty;
                  final zoneOk = _fulfillment != _Fulfillment.delivery ||
                      data.zones.isEmpty ||
                      (_selectedZoneId != null && _selectedZoneId!.isNotEmpty);
                  final globalCardEnabled =
                      data.globalPaymentMethods['card'] != false;
                  final storeCardEnabled =
                      data.tenantPaymentMethods['card'] == true;
                  final cardEnabled = globalCardEnabled && storeCardEnabled;
                  final cashEnabled =
                      data.tenantPaymentMethods['cash'] != false;
                  if (_paymentMethod == _PaymentMethod.card && !cardEnabled) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted)
                        setState(() => _paymentMethod = _PaymentMethod.cash);
                    });
                  }
                  if (_paymentMethod == _PaymentMethod.cash &&
                      !cashEnabled &&
                      cardEnabled) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted)
                        setState(() => _paymentMethod = _PaymentMethod.card);
                    });
                  }
                  final hasPaymentOption = cashEnabled || cardEnabled;
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
                          padding:
                              const EdgeInsets.fromLTRB(_kPad, 8, _kPad, 24),
                          children: [
                            if (!data.sameMarketOk)
                              _CardShell(
                                child: Text(
                                  'لا يمكن الجمع بين متاجر من أسواق مختلفة في طلب واحد.',
                                  style: GoogleFonts.cairo(
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFFB91C1C),
                                  ),
                                ),
                              ),
                            BlocBuilder<AuthBloc, AuthState>(
                              builder: (context, auth) {
                                final hint = auth.step == AuthStep.done &&
                                        auth.phone.isNotEmpty
                                    ? 'مرحباً بك'
                                    : 'سجّل دخولك لإتمام الطلب';
                                return Align(
                                  alignment: Alignment.centerRight,
                                  child: Text(
                                    hint,
                                    style: GoogleFonts.cairo(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 12),
                            _CardShell(
                              title: 'طريقة الاستلام',
                              child: _FulfillmentToggle(
                                delivery: deliveryMode,
                                pickup: pickupMode,
                                value: _fulfillment,
                                onChanged: (v) =>
                                    setState(() => _fulfillment = v),
                              ),
                            ),
                            const SizedBox(height: 12),
                            _CardShell(
                              title: 'طريقة الدفع',
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  if (cashEnabled) ...[
                                    _PaymentOptionTile(
                                      title: 'نقداً عند الاستلام',
                                      subtitle: 'الدفع نقداً عند التسليم',
                                      selected:
                                          _paymentMethod == _PaymentMethod.cash,
                                      onTap: () => setState(() =>
                                          _paymentMethod = _PaymentMethod.cash),
                                    ),
                                    if (cardEnabled) const SizedBox(height: 12),
                                  ],
                                  if (cardEnabled)
                                    _PaymentOptionTile(
                                      title: 'بطاقة ائتمان (Hyp)',
                                      subtitle:
                                          'صفحة دفع آمنة — Isracard / CreditGuard',
                                      selected:
                                          _paymentMethod == _PaymentMethod.card,
                                      onTap: () => setState(() =>
                                          _paymentMethod = _PaymentMethod.card),
                                    ),
                                  if (!hasPaymentOption)
                                    Text(
                                      'لا توجد طرق دفع مفعّلة حالياً لهذا المتجر.',
                                      style: GoogleFonts.cairo(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFFB91C1C),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            _CardShell(
                              title: 'بيانات التواصل',
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _LabeledField(
                                    label: 'الاسم',
                                    controller: _nameCtrl,
                                    touched: _touched.contains('name'),
                                    errorText: _touched.contains('name') &&
                                            _nameCtrl.text.trim().isEmpty
                                        ? 'مطلوب'
                                        : null,
                                    onChanged: (_) => setState(() {}),
                                    onTap: () =>
                                        setState(() => _touched.add('name')),
                                  ),
                                  const SizedBox(height: 12),
                                  _LabeledField(
                                    label: 'رقم الجوال',
                                    controller: _phoneCtrl,
                                    keyboardType: TextInputType.phone,
                                    touched: _touched.contains('phone'),
                                    errorText: _touched.contains('phone') &&
                                            _phoneCtrl.text.trim().isEmpty
                                        ? 'مطلوب'
                                        : null,
                                    onChanged: (_) => setState(() {}),
                                    onTap: () =>
                                        setState(() => _touched.add('phone')),
                                  ),
                                ],
                              ),
                            ),
                            if (_fulfillment == _Fulfillment.delivery) ...[
                              const SizedBox(height: 12),
                              _CardShell(
                                title: 'العنوان والمنطقة',
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (data.zones.isNotEmpty)
                                      DropdownButtonFormField<String>(
                                        // Controlled selection; `value` tracks updates when zone list changes.
                                        // ignore: deprecated_member_use
                                        value: _selectedZoneId != null &&
                                                data.zones.any((z) =>
                                                    z['id']?.toString() ==
                                                    _selectedZoneId)
                                            ? _selectedZoneId
                                            : null,
                                        decoration:
                                            _inputDecoration('منطقة التوصيل'),
                                        items: data.zones
                                            .map(
                                              (z) => DropdownMenuItem(
                                                value: z['id']?.toString(),
                                                child: Text(
                                                  '${z['name'] ?? ''} — ₪${((z['fee'] is num) ? (z['fee'] as num).toStringAsFixed(0) : '0')}',
                                                  style: GoogleFonts.cairo(),
                                                ),
                                              ),
                                            )
                                            .toList(),
                                        onChanged: (v) =>
                                            setState(() => _selectedZoneId = v),
                                      ),
                                    if (data.zones.isNotEmpty)
                                      const SizedBox(height: 12),
                                    TextField(
                                      controller: _addressCtrl,
                                      minLines: 2,
                                      maxLines: 4,
                                      onChanged: (_) => setState(() {}),
                                      decoration: _inputDecoration(
                                              'عنوان التوصيل',
                                              hint: _kDefaultDeliveryAddress)
                                          .copyWith(
                                        errorText: _touched
                                                    .contains('address') &&
                                                _addressCtrl.text.trim().isEmpty
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
                            const SizedBox(height: 12),
                            _CardShell(
                              title: 'كود الخصم',
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: TextField(
                                          controller: _couponCtrl,
                                          textCapitalization:
                                              TextCapitalization.characters,
                                          decoration:
                                              _inputDecoration('أدخل الكود'),
                                          onChanged: (_) => setState(() {}),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      SizedBox(
                                        height: 48,
                                        child: FilledButton(
                                          onPressed: _couponLoading
                                              ? null
                                              : () => _applyCoupon(
                                                    api,
                                                    code: _couponCtrl.text,
                                                    primaryTenantId:
                                                        data.primaryTenantId,
                                                    cartStoreIds:
                                                        data.orderedTenantIds,
                                                    subtotalAll: subtotalAll,
                                                    customerPhone: _phoneCtrl
                                                            .text
                                                            .trim()
                                                            .isNotEmpty
                                                        ? _phoneCtrl.text.trim()
                                                        : null,
                                                  ),
                                          style: FilledButton.styleFrom(
                                            backgroundColor:
                                                AppColors.primaryTeal,
                                            foregroundColor:
                                                AppColors.textOnTeal,
                                            shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(12)),
                                          ),
                                          child: _couponLoading
                                              ? const SizedBox(
                                                  width: 22,
                                                  height: 22,
                                                  child:
                                                      CircularProgressIndicator(
                                                          strokeWidth: 2,
                                                          color: Colors.white),
                                                )
                                              : Text('تطبيق',
                                                  style: GoogleFonts.cairo(
                                                      fontWeight:
                                                          FontWeight.w700)),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (_couponError != null) ...[
                                    const SizedBox(height: 6),
                                    Text(_couponError!,
                                        style: GoogleFonts.cairo(
                                            fontSize: 12,
                                            color: const Color(0xFFB91C1C))),
                                  ],
                                  if (_appliedCoupon != null) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      'تم تطبيق ${_appliedCoupon!.code} — خصم ₪${_appliedCoupon!.discountAmount.toStringAsFixed(2)}',
                                      style: GoogleFonts.cairo(
                                          fontSize: 13,
                                          color: AppColors.primaryTeal,
                                          fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                  if (_suggestedCoupons.isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    Text('عروض مقترحة',
                                        style: GoogleFonts.cairo(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13)),
                                    const SizedBox(height: 8),
                                    SizedBox(
                                      height: 40,
                                      child: ListView.separated(
                                        scrollDirection: Axis.horizontal,
                                        primary: false,
                                        shrinkWrap: true,
                                        itemCount: _suggestedCoupons.length,
                                        separatorBuilder: (_, __) =>
                                            const SizedBox(width: 8),
                                        itemBuilder: (context, i) {
                                          final c = _suggestedCoupons[i];
                                          final code =
                                              c['code']?.toString() ?? '';
                                          return ActionChip(
                                            label: Text(code,
                                                style: GoogleFonts.cairo(
                                                    fontWeight:
                                                        FontWeight.w600)),
                                            onPressed: _couponLoading
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
                                            backgroundColor: AppColors
                                                .primaryTeal
                                                .withValues(alpha: 0.08),
                                            side: BorderSide(
                                                color: AppColors.primaryTeal
                                                    .withValues(alpha: 0.35)),
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            _CardShell(
                              title: 'السلة',
                              child: Column(
                                children: [
                                  for (var ti = 0;
                                      ti < data.orderedTenantIds.length;
                                      ti++) ...[
                                    if (ti > 0) const SizedBox(height: 12),
                                    if (data.orderedTenantIds.length > 1)
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: Text(
                                          data.tenantNames[
                                                  data.orderedTenantIds[ti]] ??
                                              'متجر',
                                          style: GoogleFonts.cairo(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 13,
                                              color: AppColors.primaryTeal),
                                        ),
                                      ),
                                    if (data.orderedTenantIds.length > 1)
                                      const SizedBox(height: 8),
                                    ...lines
                                        .where((l) =>
                                            l.tenantId ==
                                            data.orderedTenantIds[ti])
                                        .map((line) => Padding(
                                              padding: const EdgeInsets.only(
                                                  bottom: 10),
                                              child:
                                                  _CheckoutItemTile(line: line),
                                            )),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            _CardShell(
                              title: 'ملاحظات للمتجر',
                              child: TextField(
                                controller: _notesCtrl,
                                minLines: 2,
                                maxLines: 4,
                                decoration: _inputDecoration('اختياري'),
                              ),
                            ),
                            const SizedBox(height: 12),
                            _SummaryBlock(
                              subtotal: subtotalAll,
                              delivery: deliveryFee,
                              couponDiscount: couponDiscount,
                              grandTotal: grandTotal,
                              showDelivery:
                                  _fulfillment == _Fulfillment.delivery,
                            ),
                            const SizedBox(height: 120),
                          ],
                        ),
                      ),
                      SafeArea(
                        top: false,
                        child: Container(
                          width: double.infinity,
                          padding:
                              const EdgeInsets.fromLTRB(_kPad, 12, _kPad, 16),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 16,
                                offset: const Offset(0, -4),
                              ),
                            ],
                            border: const Border(
                                top: BorderSide(color: Color(0xFFE2E8F0))),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'الإجمالي',
                                    style: GoogleFonts.cairo(
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF64748B),
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    '₪${grandTotal.toStringAsFixed(2)}',
                                    style: GoogleFonts.cairo(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 24,
                                      color: AppColors.primaryTeal,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                height: 54,
                                child: FilledButton(
                                  onPressed: (!canSubmit || _submitting)
                                      ? null
                                      : () async {
                                          setState(() {
                                            _touched.addAll({
                                              'name',
                                              'phone',
                                              'address',
                                              'zone'
                                            });
                                          });
                                          final ok =
                                              await ensureCustomerAuth(context);
                                          if (!context.mounted || !ok) return;
                                          await _refreshProfileAndRewards(api);
                                          if (!context.mounted) return;
                                          await _submit(
                                              context,
                                              data,
                                              lines,
                                              deliveryFee,
                                              couponDiscount,
                                              grandTotal);
                                        },
                                  style: FilledButton.styleFrom(
                                    backgroundColor: AppColors.primaryTeal,
                                    foregroundColor: AppColors.textOnTeal,
                                    disabledBackgroundColor:
                                        const Color(0xFFCBD5E1),
                                    shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(14)),
                                  ),
                                  child: _submitting
                                      ? const SizedBox(
                                          width: 26,
                                          height: 26,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              color: Colors.white),
                                        )
                                      : Text(
                                          'تأكيد الطلب',
                                          style: GoogleFonts.cairo(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 16),
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}

enum _Fulfillment { delivery, pickup }

enum _PaymentMethod { cash, card }

class _PaymentOptionTile extends StatelessWidget {
  const _PaymentOptionTile({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFE0F2F1) : const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                color:
                    selected ? AppColors.primaryTeal : const Color(0xFF94A3B8),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.cairo(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.cairo(
                          fontSize: 12.5, color: const Color(0xFF64748B)),
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
    labelStyle: GoogleFonts.cairo(fontSize: 13),
    hintStyle: GoogleFonts.cairo(color: const Color(0xFF94A3B8), fontSize: 13),
    filled: true,
    fillColor: const Color(0xFFF8FAFC),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: AppColors.primaryTeal, width: 1.5),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
  );
}

class _CardShell extends StatelessWidget {
  const _CardShell({this.title, required this.child});

  final String? title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EDF2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(_kPad),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null) ...[
              Text(title!,
                  style: GoogleFonts.cairo(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 12),
            ],
            child,
          ],
        ),
      ),
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
      return Text('لا توجد طرق متاحة',
          style: GoogleFonts.cairo(color: const Color(0xFF64748B)));
    }
    return SegmentedButton<_Fulfillment>(
      segments: [
        if (delivery)
          ButtonSegment(
            value: _Fulfillment.delivery,
            label: Text('توصيل',
                style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
            icon: const Icon(Icons.local_shipping_outlined, size: 20),
          ),
        if (pickup)
          ButtonSegment(
            value: _Fulfillment.pickup,
            label: Text('استلام',
                style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
            icon: const Icon(Icons.storefront_outlined, size: 20),
          ),
      ],
      selected: {value},
      onSelectionChanged: (s) {
        if (s.isNotEmpty) onChanged(s.first);
      },
      style: ButtonStyle(
        visualDensity: VisualDensity.standard,
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primaryTeal.withValues(alpha: 0.12);
          }
          return const Color(0xFFF1F5F9);
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected))
            return AppColors.primaryTeal;
          return const Color(0xFF64748B);
        }),
        side:
            WidgetStateProperty.all(const BorderSide(color: Color(0xFFE2E8F0))),
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
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      onChanged: onChanged,
      onTap: onTap,
      decoration: _inputDecoration(label).copyWith(errorText: errorText),
    );
  }
}

class _CheckoutItemTile extends StatelessWidget {
  const _CheckoutItemTile({required this.line});

  final CartLine line;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(_kPad),
        child: Row(
          textDirection: TextDirection.rtl,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 56,
                height: 56,
                child: line.imageUrl.isEmpty
                    ? const ColoredBox(color: Color(0xFFF1F5F9))
                    : Image.network(
                        line.imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const ColoredBox(color: Color(0xFFF1F5F9)),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.cairo(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'الكمية: ${line.quantity} × ₪${line.unitPrice.toStringAsFixed(2)}',
                    style: GoogleFonts.cairo(
                      fontSize: 12,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '₪${line.lineTotal.toStringAsFixed(2)}',
              style: GoogleFonts.cairo(
                fontWeight: FontWeight.w800,
                fontSize: 15,
                color: AppColors.primaryTeal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryBlock extends StatelessWidget {
  const _SummaryBlock({
    required this.subtotal,
    required this.delivery,
    required this.couponDiscount,
    required this.grandTotal,
    required this.showDelivery,
  });

  final double subtotal;
  final double delivery;
  final double couponDiscount;
  final double grandTotal;
  final bool showDelivery;

  @override
  Widget build(BuildContext context) {
    return _CardShell(
      title: 'ملخص الفاتورة',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _sumRow('المجموع', '₪${subtotal.toStringAsFixed(2)}',
              const Color(0xFF334155)),
          if (showDelivery) ...[
            const SizedBox(height: 8),
            _sumRow('رسوم التوصيل', '₪${delivery.toStringAsFixed(2)}',
                const Color(0xFF334155)),
          ],
          if (couponDiscount > 0) ...[
            const SizedBox(height: 8),
            _sumRow('خصم الكوبون', '-₪${couponDiscount.toStringAsFixed(2)}',
                const Color(0xFFB91C1C)),
          ],
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'الإجمالي النهائي',
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                '₪${grandTotal.toStringAsFixed(2)}',
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                  color: AppColors.primaryTeal,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sumRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          value,
          style: GoogleFonts.cairo(
            fontWeight: FontWeight.w700,
            fontSize: 15,
            color: valueColor,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.cairo(
            fontWeight: FontWeight.w600,
            fontSize: 14,
            color: const Color(0xFF475569),
          ),
        ),
      ],
    );
  }
}
