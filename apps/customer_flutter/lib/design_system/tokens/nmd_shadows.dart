import 'package:flutter/material.dart';

/// Elevation shadows — prefer border on light cards; shadow for FAB / floating.
abstract final class NmdShadows {
  static const List<BoxShadow> none = [];

  static const List<BoxShadow> sm = [
    BoxShadow(
      color: Color(0x08000000),
      blurRadius: 4,
      offset: Offset(0, 1),
    ),
  ];

  static const List<BoxShadow> md = [
    BoxShadow(
      color: Color(0x10000000),
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> lg = [
    BoxShadow(
      color: Color(0x14000000),
      blurRadius: 20,
      offset: Offset(0, 8),
    ),
  ];

  static List<BoxShadow> brandGlow({double alpha = 0.25}) => [
    BoxShadow(
      color: const Color(0xFF0F766E).withValues(alpha: alpha),
      blurRadius: 14,
      offset: const Offset(0, 6),
    ),
  ];

  static const List<BoxShadow> goldGlow = [
    BoxShadow(
      color: Color(0x33D4AF37),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];
}
