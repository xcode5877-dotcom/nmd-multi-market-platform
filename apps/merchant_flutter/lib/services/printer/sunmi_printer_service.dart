import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:sunmi_printer_plus/sunmi_printer_plus.dart';

import '../../models/merchant_order.dart';
import '../../models/order/order_pricing.dart';

/// Sunmi V2 Pro printer integration for one clear merchant receipt.
class SunmiPrinterService {
  static const int _paperWidth = 24;
  static const int _normalFontSize = 30;
  static const int _boldFontSize = 34;
  static const int _titleFontSize = 38;

  Future<void> printOrderReceipts(
    MerchantOrder order, {
    String storeName = 'NMD Marketing',
    Map<String, String> itemDescriptions = const {},
  }) async {
    _log('printOrderReceipts requested id=${order.id}');
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      _log('print skipped on non-Android platform id=${order.id}');
      return;
    }
    await _printFullReceipt(
      storeName: storeName,
      copyTitle: 'Order Receipt / وصل الطلب',
      order: order,
      itemDescriptions: itemDescriptions,
    );
    _log('printOrderReceipts completed id=${order.id}');
  }

  Future<void> printKitchenReceipt({
    String storeName = 'NMD Marketing',
    MerchantOrder? order,
    String? orderId,
    DateTime? orderTime,
    String paymentMethod = 'Cash',
    List<String> items = const [],
    String specialInstructions = '',
    OrderPricing pricing = const OrderPricing(
      netPrice: 0,
      commissionPercent: 0,
    ),
  }) async {
    await _printFullReceipt(
      storeName: storeName,
      copyTitle: 'Kitchen Copy / نسخة المطبخ',
      order: order ??
          _legacyOrder(
            orderId: orderId ?? '',
            orderTime: orderTime,
            paymentMethod: paymentMethod,
            deliveryAddress: '',
            isVisa: paymentMethod.toUpperCase().contains('CARD'),
            items: items,
            specialInstructions: specialInstructions,
            pricing: pricing,
          ),
    );
  }

  Future<void> printCustomerReceipt({
    String storeName = 'NMD Marketing',
    MerchantOrder? order,
    String? orderId,
    DateTime? orderTime,
    String deliveryAddress = '',
    String paymentMethod = 'Cash',
    bool isVisa = false,
    OrderPricing pricing = const OrderPricing(
      netPrice: 0,
      commissionPercent: 0,
    ),
    double? finalPrice,
  }) async {
    await _printFullReceipt(
      storeName: storeName,
      copyTitle: 'Customer Copy / نسخة الزبون',
      order: order ??
          _legacyOrder(
            orderId: orderId ?? '',
            orderTime: orderTime,
            paymentMethod: paymentMethod,
            deliveryAddress: deliveryAddress,
            isVisa: isVisa,
            items: const [],
            specialInstructions: '',
            pricing: pricing,
            finalPrice: finalPrice,
          ),
    );
  }

  // Backward-compatible aliases for earlier scaffold naming.
  Future<void> printKitchenCopy({
    String storeName = 'NMD Marketing',
    required String orderId,
    DateTime? orderTime,
    String paymentMethod = 'Cash',
    required List<String> items,
    required String specialInstructions,
    required OrderPricing pricing,
  }) {
    return printKitchenReceipt(
      storeName: storeName,
      orderId: orderId,
      orderTime: orderTime,
      paymentMethod: paymentMethod,
      items: items,
      specialInstructions: specialInstructions,
      pricing: pricing,
    );
  }

  Future<void> printCustomerCopy({
    String storeName = 'NMD Marketing',
    required String orderId,
    DateTime? orderTime,
    required String deliveryAddress,
    String paymentMethod = 'Cash',
    required bool isVisa,
    required OrderPricing pricing,
    double? finalPrice,
  }) {
    return printCustomerReceipt(
      storeName: storeName,
      orderId: orderId,
      orderTime: orderTime,
      deliveryAddress: deliveryAddress,
      paymentMethod: paymentMethod,
      isVisa: isVisa,
      pricing: pricing,
      finalPrice: finalPrice,
    );
  }

  MerchantOrder _legacyOrder({
    required String orderId,
    required DateTime? orderTime,
    required String paymentMethod,
    required String deliveryAddress,
    required bool isVisa,
    required List<String> items,
    required String specialInstructions,
    required OrderPricing pricing,
    double? finalPrice,
  }) {
    return MerchantOrder(
      id: orderId,
      tenantId: '',
      status: '',
      customerName: '',
      customerPhone: '',
      deliveryAddress: deliveryAddress,
      fulfillmentType: deliveryAddress.trim().isEmpty
          ? MerchantFulfillmentType.unknown
          : MerchantFulfillmentType.delivery,
      paymentMethod: isVisa || paymentMethod.toUpperCase().contains('CARD')
          ? MerchantPaymentMethod.card
          : MerchantPaymentMethod.cash,
      items: items,
      itemDetails: const [],
      specialInstructions: specialInstructions,
      pricing: pricing,
      subtotal: pricing.netPrice,
      deliveryFee: 0,
      discount: 0,
      total: finalPrice ?? pricing.finalPrice,
      createdAt: orderTime,
      raw: const {},
    );
  }

  Future<void> _printFullReceipt({
    required String storeName,
    required String copyTitle,
    required MerchantOrder order,
    Map<String, String> itemDescriptions = const {},
  }) async {
    _log('receipt start id=${order.id} copy=$copyTitle');
    await SunmiPrinter.printText(
      _truncate(_receiptText(
          storeName.trim().isEmpty ? 'Now Market' : storeName.trim())),
      style: _style(
        align: SunmiPrintAlign.CENTER,
        bold: true,
        fontSize: _titleFontSize,
      ),
    );
    await SunmiPrinter.printText(
      copyTitle,
      style: _style(
        align: SunmiPrintAlign.CENTER,
        bold: true,
        fontSize: _boldFontSize,
      ),
    );
    await _separator();
    await _printWrapped('Order', order.id, bold: true);
    if (order.createdAt != null) {
      await _printWrapped('Time', _formatReceiptTime(order.createdAt!));
    }
    await _separator();
    await SunmiPrinter.printText(
      'Customer / الزبون',
      style: _style(bold: true),
    );
    await _printWrapped('Name', order.customerName, bold: true);
    await _printWrapped('Phone', order.customerPhone);
    await _printWrapped('Type', order.fulfillmentLabel, bold: true);
    if (order.isDelivery) {
      await _printWrapped('Address', order.deliveryAddress);
    } else if (order.isPickup) {
      await _printWrapped('Pickup', 'Pickup / استلام / איסוף');
    } else if (order.deliveryAddress.trim().isNotEmpty &&
        order.deliveryAddress != 'Pickup / no address') {
      await _printWrapped('Address', order.deliveryAddress);
    }
    await _printWrapped('Payment', order.paymentLabel);
    await _printWrapped(
        'Status', order.status.isEmpty ? 'Unknown' : order.status);
    await _separator();
    await SunmiPrinter.printText('ITEMS', style: _style(bold: true));
    if (order.itemDetails.isNotEmpty) {
      for (final item in order.itemDetails) {
        await _printWrapped(
          '',
          '${item.quantityLabel}x ${item.name}',
          bold: true,
        );
        final description = _descriptionFor(item, itemDescriptions);
        if (description.isNotEmpty) {
          await _printWrapped('وصف', description);
        }
        if (item.modifiers.isNotEmpty) {
          await SunmiPrinter.printText('إضافات:', style: _style(bold: true));
        }
        for (final modifier in item.modifiers) {
          await _printWrapped('  -', modifier);
        }
        if (item.notes.isNotEmpty) {
          await _printWrapped('  ملاحظة', item.notes);
        }
        if (item.lineTotal > 0) {
          await _printWrapped('  Total', _money(item.lineTotal));
        }
      }
    } else {
      for (final item in order.items) {
        await _printWrapped('', item);
      }
    }
    if (order.specialInstructions.trim().isNotEmpty) {
      await _separator();
      await _printWrapped('Order notes', order.specialInstructions);
    }
    await _separator();
    await _printWrapped('Subtotal', _money(order.subtotal));
    if (order.deliveryFee > 0) {
      await _printWrapped('Delivery fee', _money(order.deliveryFee));
    }
    if (order.discount > 0) {
      await _printWrapped('Discount', '-${_money(order.discount)}');
    }
    await _printWrapped('TOTAL', _money(order.total), bold: true);
    if (order.isCardPayment) {
      await SunmiPrinter.printText(
        'PAID ONLINE',
        style: _style(align: SunmiPrintAlign.CENTER, bold: true),
      );
    }
    await _separator();
    await SunmiPrinter.printText(
      'Thank you / شكراً',
      style: _style(align: SunmiPrintAlign.CENTER, bold: true),
    );
    await SunmiPrinter.lineWrap(6);
    _log('receipt end id=${order.id} copy=$copyTitle');
  }

  Future<void> _separator() async {
    await SunmiPrinter.printText('-' * _paperWidth);
  }

  Future<void> _printWrapped(
    String label,
    String value, {
    bool bold = false,
  }) async {
    final sanitizedValue = _receiptText(value);
    if (sanitizedValue.trim().isEmpty) return;
    final prefix = label.trim().isEmpty ? '' : '$label: ';
    final available = (_paperWidth - prefix.length).clamp(12, _paperWidth);
    final chunks = _wrap(sanitizedValue.trim(), available);
    if (chunks.isEmpty) {
      await SunmiPrinter.printText(
        prefix.trim(),
        style: _style(bold: bold),
      );
      return;
    }
    for (var i = 0; i < chunks.length; i += 1) {
      final linePrefix = i == 0 ? prefix : ' ' * prefix.length;
      await SunmiPrinter.printText(
        _truncate('$linePrefix${chunks[i]}'),
        style: _style(bold: bold),
      );
    }
  }

  List<String> _wrap(String value, int width) {
    final normalized = value.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (normalized.isEmpty) return const [];
    final chunks = <String>[];
    var remaining = normalized;
    while (remaining.length > width) {
      var splitAt = remaining.lastIndexOf(' ', width);
      if (splitAt <= 0) splitAt = width;
      chunks.add(remaining.substring(0, splitAt).trim());
      remaining = remaining.substring(splitAt).trim();
    }
    if (remaining.isNotEmpty) chunks.add(remaining);
    return chunks;
  }

  String _truncate(String value) {
    if (value.length <= _paperWidth) return value;
    return value.substring(0, _paperWidth);
  }

  String _money(double value) => '${value.toStringAsFixed(2)} ILS';

  String _descriptionFor(
    MerchantOrderItem item,
    Map<String, String> itemDescriptions,
  ) {
    final direct = _receiptText(item.description);
    if (direct.isNotEmpty) return direct;
    final byProductId = itemDescriptions[item.productId]?.trim() ?? '';
    if (byProductId.isNotEmpty) return _receiptText(byProductId);
    final byName =
        itemDescriptions[item.name.trim().toLowerCase()]?.trim() ?? '';
    return _receiptText(byName);
  }

  String _receiptText(String value) {
    final lines = value
        .split(RegExp(r'[\r\n]+'))
        .map((line) => line.trim())
        .map(_removeReceiptSpamPhrases)
        .map((line) => line.replaceAll(RegExp(r'\s+'), ' ').trim())
        .where((line) => line.isNotEmpty)
        .toList();
    return lines.join(' ').trim();
  }

  String _removeReceiptSpamPhrases(String value) {
    if (value.toLowerCase().contains('whatsapp')) return '';
    return value
        .replaceAll('تواصل معي بالواتساب', '')
        .replaceAll('تواصل معي بالواتس اب', '')
        .replaceAll('تواصل معي بالواتس', '')
        .replaceAll('لتحديد الموقع', '')
        .replaceAll(RegExp('whatsapp', caseSensitive: false), '')
        .trim();
  }

  SunmiTextStyle _style({
    bool bold = false,
    SunmiPrintAlign align = SunmiPrintAlign.LEFT,
    int? fontSize,
  }) {
    return SunmiTextStyle(
      align: align,
      bold: bold,
      fontSize: fontSize ?? (bold ? _boldFontSize : _normalFontSize),
    );
  }

  String _formatReceiptTime(DateTime value) {
    return '${value.year.toString().padLeft(4, '0')}-'
        '${value.month.toString().padLeft(2, '0')}-'
        '${value.day.toString().padLeft(2, '0')} '
        '${value.hour.toString().padLeft(2, '0')}:'
        '${value.minute.toString().padLeft(2, '0')}';
  }

  void _log(String message) {
    developer.log('[Printer] $message', name: 'MerchantPOS');
  }
}
