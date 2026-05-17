import 'api_base.dart';

/// Same logic as `apps/storefront/src/lib/image-url.ts` `resolveImageUrl`.
String resolveImageUrl(String? url) {
  if (url == null || url.trim().isEmpty) return '';
  final trimmed = url.trim();
  if (RegExp(r'^https?://', caseSensitive: false).hasMatch(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    final base = kStorefrontApiBase.replaceAll(RegExp(r'/$'), '');
    return '$base$trimmed';
  }
  return trimmed;
}
