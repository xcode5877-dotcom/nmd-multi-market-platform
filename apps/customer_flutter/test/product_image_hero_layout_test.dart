import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/design_system/tokens/nmd_colors.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/product_images/product_image_gallery.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/product_images/product_image_hero.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ProductImageGallery retail hero', () {
    testWidgets('fills width without lateral gutters', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(size: Size(360, 800)),
            child: Scaffold(
              body: ProductImageGallery(
                imageUrls: const ['https://example.com/square.jpg'],
                heroTag: 'hero',
                initialIndex: 0,
                height: 320,
                imageKey: GlobalKey(),
                isServices: false,
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      final galleryBox = tester.renderObject<RenderBox>(
        find.byType(ProductImageGallery),
      );
      expect(galleryBox.size.width, 360);

      final colored = tester.widgetList<ColoredBox>(find.byType(ColoredBox));
      expect(colored.any((c) => c.color == NmdColors.tintAliveSoft), isTrue);

      final image = tester.widget<CachedNetworkImage>(
        find.byType(CachedNetworkImage),
      );
      expect(image.fit, BoxFit.contain);
    });

    testWidgets('services gallery keeps inset padding', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(size: Size(360, 800)),
            child: Scaffold(
              body: ProductImageGallery(
                imageUrls: const ['https://example.com/service.jpg'],
                heroTag: 'hero',
                initialIndex: 0,
                height: 320,
                imageKey: GlobalKey(),
                isServices: true,
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      final padding = tester.widget<Padding>(
        find.descendant(
          of: find.byType(ProductImageGallery),
          matching: find.byType(Padding),
        ).first,
      );
      expect(padding.padding, const EdgeInsets.fromLTRB(12, 0, 12, 0));
    });
  });

  group('ProductImageHero aspect fixtures', () {
    Future<void> pumpHero(
      WidgetTester tester, {
      required double width,
      required double height,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(size: Size(width, height + 200)),
            child: SizedBox(
              width: width,
              height: height,
              child: ProductImageHero(
                imageUrl: 'https://example.com/asset.jpg',
                layoutWidth: width,
                backgroundColor: NmdColors.tintAliveSoft,
              ),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('square asset uses contain without clipping', (tester) async {
      await pumpHero(tester, width: 360, height: 360);
      final image = tester.widget<CachedNetworkImage>(
        find.byType(CachedNetworkImage),
      );
      expect(image.fit, BoxFit.contain);
      expect(tester.takeException(), isNull);
    });

    testWidgets('portrait asset uses contain', (tester) async {
      await pumpHero(tester, width: 360, height: 480);
      final image = tester.widget<CachedNetworkImage>(
        find.byType(CachedNetworkImage),
      );
      expect(image.fit, BoxFit.contain);
    });

    testWidgets('landscape asset uses contain', (tester) async {
      await pumpHero(tester, width: 360, height: 220);
      final image = tester.widget<CachedNetworkImage>(
        find.byType(CachedNetworkImage),
      );
      expect(image.fit, BoxFit.contain);
    });
  });
}
