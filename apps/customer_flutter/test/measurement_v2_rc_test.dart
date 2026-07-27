import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/core/network/dio_client.dart';
import 'package:customer_flutter/core/network/token_storage.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/cart/data/cart_persistence.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/quantity_selector.dart';
import 'package:customer_flutter/measurement/measurement.dart';

void main() {
  group('A. Decimal parser', () {
    for (final entry in <String, int>{
      '0.05': 50,
      '0.1': 100,
      '0.25': 250,
      '0.333': 333,
      '0.5': 500,
      '1': 1000,
      '2.75': 2750,
    }.entries) {
      test('${entry.key} → ${entry.value} milli', () {
        final p = parseMeasurementDecimalStrict(entry.key);
        expect(p.ok, isTrue);
        expect(p.milli, entry.value);
      });
    }

    test('rejects >3 decimals', () {
      expect(parseMeasurementDecimalStrict('0.1234').ok, isFalse);
    });
    test('rejects scientific notation', () {
      expect(parseMeasurementDecimalStrict('1e-2').ok, isFalse);
    });
  });

  group('B. Formatter', () {
    test('0.25 kg + g → 250 غرام', () {
      expect(
        formatQuantity(
          quantityBase: '0.25',
          baseUnitCode: 'kg',
          displayUnitCode: 'g',
        ),
        '250 غرام',
      );
    });
    test('1 kg + g display → 1 كغم not 1000 غرام', () {
      expect(
        formatQuantity(
          quantityBase: '1',
          baseUnitCode: 'kg',
          displayUnitCode: 'g',
        ),
        '1 كغم',
      );
    });
    test('0.5 l + ml → 500 مل', () {
      expect(
        formatQuantity(
          quantityBase: '0.5',
          baseUnitCode: 'l',
          displayUnitCode: 'ml',
        ),
        '500 مل',
      );
    });
  });

  group('C. Selector bounds', () {
    test('chip cap prevents huge lists; ± still reaches max', () {
      const m = ProductMeasurement(
        measurementType: measurementTypeWeight,
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.05',
        minimumQuantity: '0.05',
        maximumQuantity: '100',
      );
      final chips = buildQuantityOptions(m, maxOptions: kMeasurementChipCap);
      expect(chips.length, lessThanOrEqualTo(kMeasurementChipCap));
      expect(chips.contains('100'), isFalse);
      expect(nextQuantity(m, '99.95'), '100');
      expect(nextQuantity(m, '100'), isNull);
    });
  });

  group('D. Cart merge / badge / max / persistence', () {
    test('merges 0.25+0.25 → 0.5 when valid', () {
      final cubit = CartCubit(
        persistence: CartPersistence(store: MemoryCartStore()),
      );
      const m = ProductMeasurement(
        measurementType: measurementTypeWeight,
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.25',
        minimumQuantity: '0.25',
        maximumQuantity: '2',
      );
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'w',
        name: 'لحم',
        unitPrice: 40,
        imageUrl: '',
        addQty: '0.25',
        measurement: m,
      );
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'w',
        name: 'لحم',
        unitPrice: 40,
        imageUrl: '',
        addQty: '0.25',
        measurement: m,
      );
      expect(cubit.state.length, 1);
      expect(cubit.state.single.quantity, '0.5');
      expect(cubit.itemCount, 1);
    });

    test('does not exceed maximum on merge', () {
      final cubit = CartCubit(
        persistence: CartPersistence(store: MemoryCartStore()),
      );
      const m = ProductMeasurement(
        measurementType: measurementTypeWeight,
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.25',
        minimumQuantity: '0.25',
        maximumQuantity: '0.5',
      );
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'w',
        name: 'لحم',
        unitPrice: 40,
        imageUrl: '',
        addQty: '0.5',
        measurement: m,
      );
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'w',
        name: 'لحم',
        unitPrice: 40,
        imageUrl: '',
        addQty: '0.25',
        measurement: m,
      );
      expect(cubit.state.single.quantity, '0.5');
    });

    test('round-trip persistence keeps 0.333', () async {
      final store = MemoryCartStore();
      final persistence = CartPersistence(store: store);
      final cubit = CartCubit(persistence: persistence);
      const m = ProductMeasurement(
        measurementType: measurementTypeWeight,
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.333',
        minimumQuantity: '0.333',
      );
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'w',
        name: 'لحم',
        unitPrice: 40,
        imageUrl: '',
        addQty: '0.333',
        measurement: m,
      );
      await Future<void>.delayed(const Duration(milliseconds: 20));
      final cubit2 = CartCubit(persistence: persistence);
      await cubit2.restorePersisted();
      expect(cubit2.state.single.quantity, '0.333');
    });
  });

  group('E. Opt-in header', () {
    test('DioClient interceptor sets Measurement V2 header', () async {
      const header = 'X-Nmd-Supports-Measurement-V2';
      final dio = DioClient.create(TokenStorage());
      RequestOptions? seen;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            seen = options;
            handler.resolve(
              Response(requestOptions: options, data: <String, dynamic>{}, statusCode: 200),
            );
          },
        ),
      );
      await dio.get<Map<String, dynamic>>('/catalog/t1');
      expect(seen, isNotNull);
      expect(seen!.headers[header], 'true');
      dio.close();
    });
  });

  group('F. Pricing preview', () {
    test('WEIGHT 40×0.5 + fixed 3 = 23', () {
      final base = calculateLineSubtotal(40, '0.5');
      final total = agoraToShekels(
        (shekelsToAgora(base) ?? 0) + (shekelsToAgora(3) ?? 0),
      );
      expect(total, 23);
    });
    test('PIECE (8+3)×3 = 33', () {
      expect(calculateLineSubtotal(11, '3'), 33);
    });
  });

  group('G. Orders / snapshots', () {
    test('historical line uses snapshot not catalog', () {
      final m = resolveMeasurementFromOrderLine({
        'measurementTypeSnapshot': 'WEIGHT',
        'baseUnitCodeSnapshot': 'kg',
        'displayUnitCodeSnapshot': 'g',
        'quantityStepSnapshot': '0.25',
        'minimumQuantitySnapshot': '0.25',
        'measurementVersionSnapshot': 1,
        'quantityDecimal': '0.5',
      });
      expect(m.measurementType, 'WEIGHT');
      expect(formatQuantityFromMeasurement('0.5', m), '500 غرام');
    });
  });

  group('H. Reorder', () {
    test('Arabic message exact', () {
      expect(
        kReorderConfigChangedAr,
        'تغيّرت طريقة بيع هذا المنتج، اختر كمية جديدة',
      );
    });
    test('blocks when step changed', () {
      final check = evaluateReorderLine(
        orderItem: {
          'quantityDecimal': '0.5',
          'measurementTypeSnapshot': 'WEIGHT',
          'baseUnitCodeSnapshot': 'kg',
          'displayUnitCodeSnapshot': 'g',
          'quantityStepSnapshot': '0.25',
          'minimumQuantitySnapshot': '0.25',
          'measurementVersionSnapshot': 1,
        },
        currentCatalogMeasurement: const ProductMeasurement(
          measurementType: measurementTypeWeight,
          baseUnitCode: 'kg',
          displayUnitCode: 'g',
          quantityStep: '0.1',
          minimumQuantity: '0.1',
          measurementVersion: 1,
        ),
      );
      expect(check.blocked, isTrue);
    });
  });

  group('I. Admin → Flutter contract fixture', () {
    test('WEIGHT admin payload decoded exactly', () {
      final p = Product.fromJson({
        'id': 'w-fixture',
        'name': 'لحم عجل',
        'categoryId': 'c1',
        'basePrice': 40,
        'measurementType': 'WEIGHT',
        'baseUnitCode': 'kg',
        'displayUnitCode': 'g',
        'quantityStep': '0.25',
        'minimumQuantity': '0.25',
        'maximumQuantity': '2',
        'priceBasis': 'PER_BASE_UNIT',
        'measurementVersion': 1,
        'displayPrecision': null,
        'isWeightBased': true,
        'unitName': 'غرام',
        'optionGroups': [],
      });
      expect(p.measurementConfigValid, isTrue);
      expect(p.measurementType, 'WEIGHT');
      expect(p.quantityStep, '0.25');
      expect(p.minimumQuantity, '0.25');
      expect(p.maximumQuantity, '2');
      expect(priceUnitSuffixAr(p.measurementType), 'كغم');
      expect(calculateLineSubtotal(40, '0.5'), 20);
      final withMod = agoraToShekels(
        (shekelsToAgora(20) ?? 0) + (shekelsToAgora(3) ?? 0),
      );
      expect(withMod, 23);
    });

    test('invalid V2 type is not sellable PIECE', () {
      final p = Product.fromJson({
        'id': 'bad',
        'name': 'x',
        'categoryId': 'c',
        'basePrice': 10,
        'measurementType': 'NOT_A_TYPE',
        'baseUnitCode': 'kg',
        'displayUnitCode': 'g',
        'quantityStep': '0.25',
        'minimumQuantity': '0.25',
        'optionGroups': [],
      });
      expect(p.measurementConfigValid, isFalse);
      expect(p.canAddToCart, isFalse);
    });

    test('VOLUME 12 × 0.5 = 6', () {
      final p = Product.fromJson({
        'id': 'v1',
        'name': 'زيت',
        'categoryId': 'c',
        'basePrice': 12,
        'measurementType': 'VOLUME',
        'baseUnitCode': 'l',
        'displayUnitCode': 'ml',
        'quantityStep': '0.5',
        'minimumQuantity': '0.5',
        'optionGroups': [],
      });
      expect(p.measurementConfigValid, isTrue);
      expect(calculateLineSubtotal(p.basePrice, '0.5'), 6);
    });

    test('PIECE regression', () {
      final p = Product.fromJson({
        'id': 'p1',
        'name': 'حليب',
        'categoryId': 'c',
        'basePrice': 8,
        'optionGroups': [],
      });
      expect(p.measurementType, 'PIECE');
      expect(p.measurementConfigValid, isTrue);
      expect(p.minimumQuantity, '1');
    });
  });
}
