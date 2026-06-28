import 'package:customer_flutter/features/catalog/presentation/widgets/product_images/product_image_urls.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('extractProductImageUrls', () {
    test('merges imageUrl and images array without duplicates', () {
      final urls = extractProductImageUrls({
        'imageUrl': '/uploads/a.jpg',
        'images': [
          {'url': '/uploads/a.jpg'},
          {'url': '/uploads/b.jpg'},
          'https://cdn.example/c.jpg',
        ],
      });
      expect(urls.length, 3);
    });

    test('productHeroImageIndex finds card image in gallery', () {
      const urls = ['https://x/a.jpg', 'https://x/b.jpg'];
      expect(productHeroImageIndex(urls, 'https://x/b.jpg'), 1);
      expect(productHeroImageIndex(urls, ''), 0);
    });

    test('productDetailsHeroTag is stable', () {
      expect(productDetailsHeroTag('s1', 'p9'), 'product-s1-p9');
    });
  });
}
