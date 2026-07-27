import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../measurement/measurement.dart';
import '../../cart/domain/cart_selected_option.dart';
import '../application/cart_cubit.dart';

/// Cart persistence schema. Bump when wire format changes incompatibly.
const int kCartSchemaVersion = 2;
const _storageKey = 'nmd_cart_v2';

abstract class CartStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> delete();
}

class SecureCartStore implements CartStore {
  SecureCartStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: _storageKey);

  @override
  Future<void> write(String value) =>
      _storage.write(key: _storageKey, value: value);

  @override
  Future<void> delete() => _storage.delete(key: _storageKey);
}

class MemoryCartStore implements CartStore {
  String? _value;

  @override
  Future<String?> read() async => _value;

  @override
  Future<void> write(String value) async => _value = value;

  @override
  Future<void> delete() async => _value = null;
}

/// Persist cart lines with exact decimal quantity strings (not doubles).
class CartPersistence {
  CartPersistence({CartStore? store}) : _store = store ?? SecureCartStore();

  final CartStore _store;

  Future<List<CartLine>> load() async {
    try {
      final raw = await _store.read();
      if (raw == null || raw.trim().isEmpty) return const [];
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return const [];
      final map = Map<String, dynamic>.from(decoded);
      final version = map['schemaVersion'];
      if (version is! num || version.toInt() != kCartSchemaVersion) {
        return const [];
      }
      final lines = map['lines'];
      if (lines is! List) return const [];
      final out = <CartLine>[];
      for (final row in lines) {
        if (row is! Map) continue;
        final line = _decodeLine(Map<String, dynamic>.from(row));
        if (line != null) out.add(line);
      }
      return out;
    } catch (_) {
      return const [];
    }
  }

  Future<void> save(List<CartLine> lines) async {
    final payload = <String, dynamic>{
      'schemaVersion': kCartSchemaVersion,
      'lines': lines.map(_encodeLine).toList(),
    };
    await _store.write(jsonEncode(payload));
  }

  Future<void> clear() => _store.delete();

  Map<String, dynamic> _encodeLine(CartLine line) {
    return <String, dynamic>{
      'lineKey': line.lineKey,
      'tenantId': line.tenantId,
      'productId': line.productId,
      'name': line.name,
      'unitPrice': line.unitPrice.toString(),
      'merchantUnitPrice': line.merchantUnitPrice.toString(),
      'imageUrl': line.imageUrl,
      'quantity': line.quantity,
      'fixedModifierTotal': line.fixedModifierTotal.toString(),
      'optionGroupsJson': line.optionGroupsJson,
      'selectedOptions': line.selectedOptions
          .map(
            (o) => <String, dynamic>{
              'optionGroupId': o.optionGroupId,
              'optionItemIds': o.optionItemIds,
              if (o.sliceSelection != null) 'sliceSelection': o.sliceSelection,
              if (o.optionPlacements.isNotEmpty)
                'optionPlacements': o.optionPlacements,
            },
          )
          .toList(),
      'measurement': <String, dynamic>{
        'measurementType': line.measurement.measurementType,
        'baseUnitCode': line.measurement.baseUnitCode,
        'displayUnitCode': line.measurement.displayUnitCode,
        'quantityStep': line.measurement.quantityStep,
        'minimumQuantity': line.measurement.minimumQuantity,
        'maximumQuantity': line.measurement.maximumQuantity,
        'priceBasis': line.measurement.priceBasis,
        'measurementVersion': line.measurement.measurementVersion,
        'displayPrecision': line.measurement.displayPrecision,
      },
    };
  }

  CartLine? _decodeLine(Map<String, dynamic> m) {
    final qty = parseMeasurementDecimalStrict(m['quantity']);
    if (!qty.ok || qty.milli <= 0) return null;
    final measurementMap = m['measurement'];
    if (measurementMap is! Map) return null;
    final resolved = resolveProductMeasurementDetailed(
      Map<String, dynamic>.from(measurementMap),
    );
    if (!resolved.valid) return null;

    final selected = <CartSelectedOption>[];
    final rawOpts = m['selectedOptions'];
    if (rawOpts is List) {
      for (final o in rawOpts) {
        if (o is! Map) continue;
        final om = Map<String, dynamic>.from(o);
        final ids = (om['optionItemIds'] as List?)
                ?.map((e) => e.toString())
                .toList() ??
            const <String>[];
        final placements = <String, String>{};
        final pl = om['optionPlacements'];
        if (pl is Map) {
          pl.forEach((k, v) => placements[k.toString()] = v.toString());
        }
        selected.add(
          CartSelectedOption(
            optionGroupId: om['optionGroupId']?.toString() ?? '',
            optionItemIds: ids,
            sliceSelection: om['sliceSelection']?.toString(),
            optionPlacements: placements,
          ),
        );
      }
    }

    final lineKey = m['lineKey']?.toString() ?? '';
    final tenantId = m['tenantId']?.toString() ?? '';
    final productId = m['productId']?.toString() ?? '';
    if (lineKey.isEmpty || tenantId.isEmpty || productId.isEmpty) return null;

    return CartLine(
      lineKey: lineKey,
      tenantId: tenantId,
      productId: productId,
      name: m['name']?.toString() ?? '',
      unitPrice: _money(m['unitPrice']),
      merchantUnitPrice: _money(m['merchantUnitPrice']),
      imageUrl: m['imageUrl']?.toString() ?? '',
      quantity: qty.normalized,
      measurement: resolved.measurement,
      fixedModifierTotal: _money(m['fixedModifierTotal']),
      selectedOptions: selected,
      optionGroupsJson: m['optionGroupsJson']?.toString() ?? '[]',
    );
  }

  double _money(Object? v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0;
  }
}
