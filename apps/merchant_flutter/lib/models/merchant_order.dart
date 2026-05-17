import 'order/order_pricing.dart';

enum MerchantPaymentMethod { cash, card }

enum MerchantFulfillmentType { delivery, pickup, unknown }

class MerchantOrderItem {
  const MerchantOrderItem({
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
    required this.modifiers,
    required this.notes,
    required this.productId,
    required this.imageUrl,
    required this.description,
  });

  final String name;
  final double quantity;
  final double unitPrice;
  final double lineTotal;
  final List<String> modifiers;
  final String notes;
  final String productId;
  final String imageUrl;
  final String description;

  String get quantityLabel {
    if (quantity <= 0) return '1';
    return quantity
        .toStringAsFixed(quantity.truncateToDouble() == quantity ? 0 : 2);
  }

  String get summary => '$quantityLabel x $name';

  static MerchantOrderItem fromJson(Map<String, dynamic> json) {
    final quantity = MerchantOrder._num(json['quantity'] ?? json['qty']);
    final unitPrice = MerchantOrder._num(
      json['unitPrice'] ?? json['basePrice'] ?? json['price'],
    );
    final lineTotal = MerchantOrder._num(
      json['totalPrice'] ??
          json['lineTotal'] ??
          json['total'] ??
          (quantity > 0 && unitPrice > 0 ? quantity * unitPrice : 0),
    );
    return MerchantOrderItem(
      name: (json['productName'] ??
              json['name'] ??
              json['title'] ??
              json['productId'] ??
              'Item')
          .toString(),
      quantity: quantity <= 0 ? 1 : quantity,
      unitPrice: unitPrice,
      lineTotal: lineTotal,
      modifiers: _modifiers(json),
      notes: (json['notes'] ??
              json['specialInstructions'] ??
              json['itemNotes'] ??
              '')
          .toString()
          .trim(),
      productId: (json['productId'] ?? json['id'] ?? '').toString(),
      imageUrl: (json['imageUrl'] ??
              json['image'] ??
              json['photoUrl'] ??
              json['thumbnailUrl'] ??
              '')
          .toString(),
      description: (json['description'] ??
              json['details'] ??
              json['shortDescription'] ??
              json['productDescription'] ??
              json['menuDescription'] ??
              json['note'] ??
              json['itemDescription'] ??
              '')
          .toString()
          .trim(),
    );
  }

  static List<String> _modifiers(Map<String, dynamic> json) {
    final explicit = json['modifierSummaryAr'];
    if (explicit is List) {
      return explicit
          .map((value) => value.toString())
          .where((value) => value.trim().isNotEmpty)
          .toList();
    }

    final selected = json['selectedOptions'];
    if (selected is List) {
      final values = selected
          .whereType<Map>()
          .map((row) {
            return (row['name'] ??
                    row['title'] ??
                    row['label'] ??
                    row['id'] ??
                    '')
                .toString();
          })
          .where((value) => value.trim().isNotEmpty)
          .toList();
      if (values.isNotEmpty) return values;
    }

    final optionGroups = json['optionGroups'];
    if (optionGroups is List) {
      return optionGroups
          .whereType<Map>()
          .expand((group) {
            final groupName =
                (group['name'] ?? group['title'] ?? '').toString();
            final items = group['items'];
            if (items is! List) return const <String>[];
            return items.whereType<Map>().map((item) {
              final itemName =
                  (item['name'] ?? item['title'] ?? item['id'] ?? '')
                      .toString();
              if (groupName.trim().isEmpty) return itemName;
              return '$groupName: $itemName';
            });
          })
          .where((value) => value.trim().isNotEmpty)
          .toList();
    }

    return const [];
  }
}

class MerchantOrder {
  const MerchantOrder({
    required this.id,
    required this.tenantId,
    required this.status,
    required this.customerName,
    required this.customerPhone,
    required this.deliveryAddress,
    required this.fulfillmentType,
    required this.paymentMethod,
    required this.items,
    required this.itemDetails,
    required this.specialInstructions,
    required this.pricing,
    required this.subtotal,
    required this.deliveryFee,
    required this.discount,
    required this.total,
    required this.createdAt,
    required this.raw,
  });

  final String id;
  final String tenantId;
  final String status;
  final String customerName;
  final String customerPhone;
  final String deliveryAddress;
  final MerchantFulfillmentType fulfillmentType;
  final MerchantPaymentMethod paymentMethod;
  final List<String> items;
  final List<MerchantOrderItem> itemDetails;
  final String specialInstructions;
  final OrderPricing pricing;
  final double subtotal;
  final double deliveryFee;
  final double discount;
  final double total;
  final DateTime? createdAt;
  final Map<String, dynamic> raw;

  bool get isCardPayment => paymentMethod == MerchantPaymentMethod.card;
  bool get isDelivery => fulfillmentType == MerchantFulfillmentType.delivery;
  bool get isPickup => fulfillmentType == MerchantFulfillmentType.pickup;
  String get paymentLabel =>
      isCardPayment ? 'Card / Visa / بطاقة' : 'Cash / نقدي';
  String get fulfillmentLabel {
    return switch (fulfillmentType) {
      MerchantFulfillmentType.delivery => 'DELIVERY / إرسالية / משלוח',
      MerchantFulfillmentType.pickup => 'PICKUP / استلام / איסוף',
      MerchantFulfillmentType.unknown => 'غير محدد / Unknown',
    };
  }

  String get shortId => id.length > 8 ? id.substring(0, 8) : id;

  bool get isCompleted {
    final normalized = status.trim().toUpperCase();
    return normalized == 'COMPLETED' ||
        normalized == 'COMPLETE' ||
        normalized == 'DELIVERED' ||
        normalized == 'FULFILLED' ||
        normalized == 'CLOSED';
  }

  bool get isFinal {
    final normalized = status.trim().toUpperCase();
    return isCompleted ||
        normalized == 'CANCELLED' ||
        normalized == 'CANCELED' ||
        normalized == 'REJECTED';
  }

  bool get isActionable => shouldAutoPrint && !isFinal;

  bool get shouldAutoPrint {
    final normalized = status.trim().toUpperCase();
    return normalized == 'PENDING' ||
        normalized == 'NEW' ||
        normalized == 'PLACED' ||
        normalized == 'WAITING_APPROVAL' ||
        normalized == 'PAID' ||
        normalized == 'CONFIRMED' ||
        normalized == 'PREPARING' ||
        normalized == 'READY';
  }

  static MerchantOrder fromJson(Map<String, dynamic> json) {
    final paymentRaw = (json['paymentMethod'] ??
            (json['payment'] is Map
                ? (json['payment'] as Map)['method']
                : null) ??
            '')
        .toString()
        .toUpperCase();
    final isCard = paymentRaw.contains('CARD') ||
        paymentRaw.contains('CREDIT') ||
        paymentRaw.contains('VISA') ||
        paymentRaw.contains('ONLINE');
    final itemDetails = _itemDetails(json['items']);
    final subtotal = _num(
      json['subtotal'] ??
          json['itemsTotal'] ??
          _nested(json, const ['payment', 'breakdown', 'itemsTotal']) ??
          itemDetails.fold<double>(0, (sum, item) => sum + item.lineTotal),
    );
    final deliveryFee = _num(
      json['platformDeliveryFee'] ??
          _nested(json, const ['payment', 'breakdown', 'deliveryFee']) ??
          _nested(json, const ['delivery', 'fee']),
    );
    final discount = _num(
      json['discount'] ??
          json['discountAmount'] ??
          json['couponDiscountAmount'] ??
          _nested(json, const ['payment', 'breakdown', 'discount']),
    );
    final total = _num(json['total'] ??
        json['orderTotal'] ??
        json['finalPrice'] ??
        (subtotal + deliveryFee - discount));
    final merchantAmount = _num(json['merchantAmount'] ?? subtotal);
    final commissionPercent =
        _num(json['platformCommissionPercent'] ?? json['commissionPercent']);

    return MerchantOrder(
      id: (json['id'] ?? '').toString(),
      tenantId: (json['tenantId'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      customerName: _customerName(json),
      customerPhone: _customerPhone(json),
      deliveryAddress: _deliveryAddress(json),
      fulfillmentType: _fulfillmentType(json),
      paymentMethod:
          isCard ? MerchantPaymentMethod.card : MerchantPaymentMethod.cash,
      items: itemDetails.map((item) => item.summary).toList(growable: false),
      itemDetails: itemDetails,
      specialInstructions:
          (json['notes'] ?? json['specialInstructions'] ?? '').toString(),
      pricing: OrderPricing(
        netPrice: merchantAmount,
        commissionPercent: commissionPercent,
      ),
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      discount: discount,
      total: total,
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
      raw: Map<String, dynamic>.from(json),
    );
  }

  static double _num(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  static Object? _nested(Map<String, dynamic> json, List<String> path) {
    Object? cursor = json;
    for (final key in path) {
      if (cursor is! Map) return null;
      cursor = cursor[key];
    }
    return cursor;
  }

  static String _customerName(Map<String, dynamic> json) {
    return _firstText([
      json['customerName'],
      json['recipientName'],
      _nested(json, const ['deliveryAddress', 'name']),
      _nested(json, const ['delivery', 'name']),
      _nested(json, const ['customer', 'name']),
      _nested(json, const ['user', 'name']),
    ], fallback: 'غير متوفر');
  }

  static String _customerPhone(Map<String, dynamic> json) {
    return _firstText([
      json['customerPhone'],
      json['phone'],
      json['contactPhone'],
      json['recipientPhone'],
      _nested(json, const ['deliveryAddress', 'phone']),
      _nested(json, const ['delivery', 'phone']),
      _nested(json, const ['customer', 'phone']),
      _nested(json, const ['user', 'phone']),
    ], fallback: 'غير متوفر');
  }

  static String _firstText(
    List<Object?> values, {
    required String fallback,
  }) {
    for (final value in values) {
      final text = value?.toString().trim() ?? '';
      if (text.isNotEmpty && text != 'null') return text;
    }
    return fallback;
  }

  static MerchantFulfillmentType _fulfillmentType(Map<String, dynamic> json) {
    final delivery = json['delivery'];
    final candidates = [
      json['fulfillmentType'],
      json['orderType'],
      json['deliveryType'],
      json['deliveryMethod'],
      json['shippingMethod'],
      json['method'],
      delivery is Map ? delivery['type'] : null,
      delivery is Map ? delivery['method'] : null,
    ].map((value) => value?.toString().trim().toUpperCase() ?? '').toList();

    if (candidates.any((value) =>
        value == 'PICKUP' || value == 'TAKEAWAY' || value == 'COLLECT')) {
      return MerchantFulfillmentType.pickup;
    }
    if (candidates.any((value) => value == 'DELIVERY' || value == 'SHIPPING')) {
      return MerchantFulfillmentType.delivery;
    }
    if (json['isDelivery'] == true) return MerchantFulfillmentType.delivery;
    if (json['isPickup'] == true) return MerchantFulfillmentType.pickup;
    if (_deliveryAddress(json).trim().isNotEmpty &&
        _deliveryAddress(json) != 'Pickup / no address') {
      return MerchantFulfillmentType.delivery;
    }
    return MerchantFulfillmentType.unknown;
  }

  static String _deliveryAddress(Map<String, dynamic> json) {
    final direct = json['deliveryAddress'];
    if (direct is Map) {
      final text = (direct['addressText'] ??
              direct['address'] ??
              direct['line1'] ??
              direct['street'] ??
              direct['label'] ??
              '')
          .toString()
          .trim();
      if (text.isNotEmpty) return text;
    } else {
      final directText = (direct ?? '').toString().trim();
      if (directText.isNotEmpty) return directText;
    }
    final delivery = json['delivery'];
    if (delivery is Map) {
      final text = (delivery['addressText'] ?? delivery['zoneName'] ?? '')
          .toString()
          .trim();
      if (text.isNotEmpty) return text;
    }
    return 'Pickup / no address';
  }

  static List<MerchantOrderItem> _itemDetails(Object? rawItems) {
    if (rawItems is! List) return const [];
    return rawItems.map((item) {
      if (item is! Map) {
        return MerchantOrderItem(
          name: item.toString(),
          quantity: 1,
          unitPrice: 0,
          lineTotal: 0,
          modifiers: const [],
          notes: '',
          productId: '',
          imageUrl: '',
          description: '',
        );
      }
      return MerchantOrderItem.fromJson(Map<String, dynamic>.from(item));
    }).toList(growable: false);
  }
}

class TenantSettings {
  const TenantSettings({
    required this.id,
    required this.name,
    required this.operationalStatus,
    required this.cashEnabled,
    required this.cardEnabled,
  });

  final String id;
  final String name;
  final String operationalStatus;
  final bool cashEnabled;
  final bool cardEnabled;

  static TenantSettings fromJson(Map<String, dynamic> json) {
    final paymentMethods = json['paymentMethods'];
    final methods = paymentMethods is Map ? paymentMethods : const {};
    return TenantSettings(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Store').toString(),
      operationalStatus: (json['operationalStatus'] ?? 'open').toString(),
      cashEnabled: methods['cash'] != false,
      cardEnabled: methods['card'] == true,
    );
  }
}
