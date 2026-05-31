import 'dart:math' as math;
import 'dart:ui' show Offset;

import '../../../../../api/models/pizza_placement.dart';
import 'pizza_topping_visual_resolver.dart';

/// One topping instance for layout (UI-only).
class PizzaToppingLayoutItem {
  const PizzaToppingLayoutItem({
    required this.modifierKey,
    required this.modifierName,
    required this.placement,
    required this.category,
  });

  final String modifierKey;
  final String modifierName;
  final String placement;
  final PizzaToppingVisualCategory category;
}

/// Resolved glyph placement for rendering.
class PizzaToppingGlyphLayout {
  const PizzaToppingGlyphLayout({
    required this.key,
    required this.visual,
    required this.position,
    required this.size,
    required this.rotationRadians,
    required this.scaleFactor,
    required this.staggerIndex,
  });

  final String key;
  final PizzaToppingVisual visual;
  final Offset position;
  final double size;
  final double rotationRadians;
  final double scaleFactor;
  final int staggerIndex;
}

class _PlacedCenter {
  const _PlacedCenter(this.center, this.radius);

  final Offset center;
  final double radius;
}

/// Organic deterministic topping scatter inside pizza circle.
abstract final class PizzaToppingPositioner {
  static const double _circleRadiusNorm = 0.42;
  static const double _splitMargin = 0.06;
  static const double _inset = 0.07;

  static final Map<String, List<PizzaToppingGlyphLayout>> _layoutCache = {};

  static bool isInsideCircle(Offset normalized, {double radius = _circleRadiusNorm}) {
    final dx = normalized.dx - 0.5;
    final dy = normalized.dy - 0.5;
    return dx * dx + dy * dy <= radius * radius;
  }

  static bool isOnLeftHalf(Offset normalized) =>
      normalized.dx <= 0.5 - _splitMargin;

  static bool isOnRightHalf(Offset normalized) =>
      normalized.dx >= 0.5 + _splitMargin;

  static int iconCountFor({
    required String modifierKey,
    required String placement,
    required PizzaToppingVisualCategory category,
    required int totalSelectedCount,
  }) {
    final seed = _seed(modifierKey, placement, category.name);
    var count = 2 + (seed % 3); // 2..4
    if (totalSelectedCount > 5) count = 2 + (seed % 2);
    if (totalSelectedCount > 9) count = 2;
    return count;
  }

  /// Adaptive icon size in px — smaller for dense pizzas.
  static double iconSizeFor({
    required int totalIconCount,
    required int localIndex,
  }) {
    double base;
    if (totalIconCount <= 10) {
      base = 20;
    } else if (totalIconCount <= 18) {
      base = 18;
    } else if (totalIconCount <= 26) {
      base = 16;
    } else {
      base = 14;
    }
    final jitter = (_seed('$localIndex', 'size', '$totalIconCount') % 5) - 2;
    return (base + jitter).clamp(14.0, 22.0);
  }

  static String sceneCacheKey({
    required double pizzaSize,
    required List<PizzaToppingLayoutItem> items,
    String? groupName,
  }) {
    final buf = StringBuffer('${pizzaSize.toInt()}|$groupName|');
    for (final item in items) {
      buf.write('${item.modifierKey}:${item.placement}:${item.category.name};');
    }
    return buf.toString();
  }

  /// Builds full scene layout with global collision avoidance (memoized).
  static List<PizzaToppingGlyphLayout> layoutScene({
    required double pizzaSize,
    required List<PizzaToppingLayoutItem> items,
    required String? groupName,
    required PizzaToppingVisual Function(PizzaToppingLayoutItem item) visualFor,
  }) {
    if (items.isEmpty) return const [];
    final cacheKey = sceneCacheKey(
      pizzaSize: pizzaSize,
      items: items,
      groupName: groupName,
    );
    final cached = _layoutCache[cacheKey];
    if (cached != null) return cached;

    var totalIcons = 0;
    for (final item in items) {
      totalIcons += iconCountFor(
        modifierKey: item.modifierKey,
        placement: item.placement,
        category: item.category,
        totalSelectedCount: items.length,
      );
    }

    final placed = <_PlacedCenter>[];
    final glyphs = <PizzaToppingGlyphLayout>[];
    var stagger = 0;

    for (var i = 0; i < items.length; i++) {
      final item = items[i];
      final visual = visualFor(item);
      final count = iconCountFor(
        modifierKey: item.modifierKey,
        placement: item.placement,
        category: item.category,
        totalSelectedCount: items.length,
      );

      for (var j = 0; j < count; j++) {
        final size = iconSizeFor(
          totalIconCount: totalIcons,
          localIndex: stagger,
        );
        final norm = _organicNormalized(
          item: item,
          itemIndex: i,
          iconIndex: j,
          placedNorm: placed.map((p) => _pixelToNorm(p.center, pizzaSize)).toList(),
          iconSize: size,
          pizzaSize: pizzaSize,
        );
        if (norm == null) continue;

        final pixel = _toPixelTopLeft(norm, pizzaSize, size);
        final center = Offset(pixel.dx + size / 2, pixel.dy + size / 2);
        placed.add(_PlacedCenter(center, size * 0.48));

        final rotSeed = _seed(item.modifierKey, '$j', 'rot');
        final rotation = ((rotSeed % 360) - 180) * math.pi / 180 * 0.22;
        final scaleFactor = 0.88 + (rotSeed % 13) / 100.0;

        glyphs.add(
          PizzaToppingGlyphLayout(
            key: '${item.modifierKey}|${item.placement}|$j',
            visual: visual,
            position: pixel,
            size: size,
            rotationRadians: rotation,
            scaleFactor: scaleFactor,
            staggerIndex: stagger,
          ),
        );
        stagger++;
      }
    }

    _layoutCache[cacheKey] = glyphs;
    return glyphs;
  }

  /// Legacy pixel positions (tests / backward compat).
  static List<Offset> positionsFor({
    required double pizzaSize,
    required PizzaToppingLayoutItem item,
    required int itemIndex,
    required int totalSelectedCount,
    required int totalIconCount,
  }) {
    final glyphs = layoutScene(
      pizzaSize: pizzaSize,
      items: [item],
      groupName: null,
      visualFor: (i) => PizzaToppingVisualResolver.resolve(
        modifierName: i.modifierName,
        placement: i.placement,
      ),
    );
    return glyphs
        .where((g) => g.key.startsWith('${item.modifierKey}|${item.placement}|'))
        .map((g) => g.position)
        .toList();
  }

  static Offset? _organicNormalized({
    required PizzaToppingLayoutItem item,
    required int itemIndex,
    required int iconIndex,
    required List<Offset> placedNorm,
    required double iconSize,
    required double pizzaSize,
  }) {
    final seed = _seed(
      item.modifierKey,
      item.placement,
      '${item.category.name}|$itemIndex|$iconIndex',
    );
    final rings = _ringsForPlacement(item.placement);
    final minDist = (iconSize / pizzaSize) * 0.95;

    for (var attempt = 0; attempt < 48; attempt++) {
      final ring = rings[(seed + attempt * 3) % rings.length];
      final baseAngle = _baseAngle(item.placement, seed, iconIndex, attempt);
      final jitterR = _unit(seed + attempt * 11) * 0.035;
      final jitterA = (_unit(seed + attempt * 17) - 0.5) * 0.28;

      final r = (ring + jitterR).clamp(0.08, _circleRadiusNorm);
      final angle = baseAngle + jitterA;
      final nx = 0.5 + r * math.cos(angle);
      final ny = 0.5 + r * math.sin(angle);
      final norm = Offset(nx, ny);

      if (!_accept(norm, item.placement, iconIndex: iconIndex)) continue;

      var ok = true;
      for (final other in placedNorm) {
        if ((norm - other).distance < minDist) {
          ok = false;
          break;
        }
      }
      if (ok) return norm;
    }

    if (item.placement.toUpperCase() == PizzaPlacement.whole) {
      final fallback = _wholeFallbackNorm(
        iconIndex: iconIndex,
        seed: seed,
        placedNorm: placedNorm,
        minDist: minDist,
      );
      if (fallback != null) return fallback;
    }
    return null;
  }

  static Offset? _wholeFallbackNorm({
    required int iconIndex,
    required int seed,
    required List<Offset> placedNorm,
    required double minDist,
  }) {
    final lateral = 0.16 + _unit(seed + iconIndex * 7) * 0.08;
    final vertical = (_unit(seed + iconIndex * 11) - 0.5) * 0.12;
    final norm = Offset(
      iconIndex.isEven ? 0.5 - lateral : 0.5 + lateral,
      0.5 + vertical,
    );
    if (!isInsideCircle(norm)) return null;
    if (iconIndex.isEven ? !isOnLeftHalf(norm) : !isOnRightHalf(norm)) {
      return null;
    }
    for (final other in placedNorm) {
      if ((norm - other).distance < minDist * 0.85) return null;
    }
    return norm;
  }

  static List<double> _ringsForPlacement(String placement) {
    switch (placement.toUpperCase()) {
      case PizzaPlacement.left:
        return [0.14, 0.24, 0.32];
      case PizzaPlacement.right:
        return [0.14, 0.24, 0.32];
      default:
        return [0.12, 0.22, 0.32, 0.38];
    }
  }

  static double _baseAngle(
    String placement,
    int seed,
    int iconIndex,
    int attempt,
  ) {
    final slot = (seed + iconIndex * 5 + attempt * 2) % 12;
    final slice = slot * (math.pi / 6);

    switch (placement.toUpperCase()) {
      case PizzaPlacement.left:
        return math.pi * 0.55 + slice * 0.55 + (_unit(seed) - 0.5) * 0.2;
      case PizzaPlacement.right:
        return -math.pi * 0.45 + slice * 0.55 + (_unit(seed) - 0.5) * 0.2;
      default:
        // Anchor even/odd icons to opposite halves so whole toppings
        // always read balanced on the pie (stable under hash variance).
        final halfAnchor = iconIndex.isEven ? math.pi : 0.0;
        return halfAnchor +
            slice * 0.38 +
            (_unit(seed + iconIndex) - 0.5) * 0.25;
    }
  }

  static bool _accept(Offset norm, String placement, {required int iconIndex}) {
    if (!isInsideCircle(norm)) return false;
    switch (placement.toUpperCase()) {
      case PizzaPlacement.left:
        return isOnLeftHalf(norm);
      case PizzaPlacement.right:
        return isOnRightHalf(norm);
      default:
        // Whole pizza: alternate halves so scatter never collapses to one side.
        return iconIndex.isEven ? isOnLeftHalf(norm) : isOnRightHalf(norm);
    }
  }

  static Offset _toPixelTopLeft(Offset norm, double pizzaSize, double iconSize) {
    final inset = pizzaSize * _inset;
    final usable = pizzaSize - inset * 2;
    return Offset(
      inset + norm.dx * usable - iconSize / 2,
      inset + norm.dy * usable - iconSize / 2,
    );
  }

  static Offset _pixelToNorm(Offset center, double pizzaSize) {
    final inset = pizzaSize * _inset;
    final usable = pizzaSize - inset * 2;
    return Offset(
      ((center.dx - inset) / usable).clamp(0.0, 1.0),
      ((center.dy - inset) / usable).clamp(0.0, 1.0),
    );
  }

  static int _seed(String a, String b, [String? c]) =>
      Object.hash(a, b, c).abs();

  static double _unit(int seed) => (seed % 1000) / 1000.0;

  /// Test helpers — polar ring samples inside circle.
  static List<Offset> sampleRing({
    required String placement,
    required int seed,
    int count = 8,
  }) {
    final out = <Offset>[];
    for (var i = 0; i < count; i++) {
      final norm = _organicNormalized(
        item: PizzaToppingLayoutItem(
          modifierKey: 't$seed',
          modifierName: 't$seed',
          placement: placement,
          category: PizzaToppingVisualCategory.olive,
        ),
        itemIndex: 0,
        iconIndex: i,
        placedNorm: out,
        iconSize: 18,
        pizzaSize: 148,
      );
      if (norm != null) out.add(norm);
    }
    return out;
  }
}
