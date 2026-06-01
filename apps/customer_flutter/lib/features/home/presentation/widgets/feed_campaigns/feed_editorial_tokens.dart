import 'package:flutter/material.dart';

/// Shared visual tokens for feed editorial interruptions.
abstract final class FeedEditorialTokens {
  static const double radiusLg = 26;
  static const double radiusMd = 20;
  static const double radiusSm = 16;

  static const Color teal = Color(0xFF0E7C72);
  static const Color tealDeep = Color(0xFF0B5E58);
  static const Color navy = Color(0xFF0F172A);
  static const Color mintWash = Color(0xFFE8F5F3);
  static const Color nightBase = Color(0xFF0B3D3A);

  static List<BoxShadow> softLift = [
    BoxShadow(
      color: teal.withValues(alpha: 0.12),
      blurRadius: 22,
      offset: const Offset(0, 10),
    ),
    BoxShadow(
      color: navy.withValues(alpha: 0.05),
      blurRadius: 10,
      offset: const Offset(0, 3),
    ),
  ];

  static BoxDecoration cardSurface({Color? fill}) => BoxDecoration(
        color: fill ?? Colors.white,
        borderRadius: BorderRadius.circular(radiusLg),
        border: Border.all(color: teal.withValues(alpha: 0.1)),
        boxShadow: softLift,
      );
}
