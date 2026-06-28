import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Preloads adjacent gallery images to eliminate swipe lag.
abstract final class ProductImagePreloader {
  static Future<void> precacheAdjacent(
    BuildContext context,
    List<String> urls,
    int activeIndex,
  ) async {
    if (urls.isEmpty || !context.mounted) return;
    final tasks = <Future<void>>[];
    for (final offset in const [-1, 0, 1]) {
      final idx = activeIndex + offset;
      if (idx < 0 || idx >= urls.length) continue;
      tasks.add(
        precacheImage(CachedNetworkImageProvider(urls[idx]), context),
      );
    }
    await Future.wait(tasks);
  }

  static int? _decodeWidth(BuildContext context, double layoutWidth) {
    if (layoutWidth <= 0) return null;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return (layoutWidth * dpr).round().clamp(320, 2400);
  }

  static int? memCacheWidthForLayout(BuildContext context, double layoutWidth) =>
      _decodeWidth(context, layoutWidth);
}
