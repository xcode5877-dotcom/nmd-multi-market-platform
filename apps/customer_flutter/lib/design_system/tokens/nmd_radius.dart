import 'package:flutter/material.dart';

/// Border radius tokens. Pill identity uses [pill] for CTAs and chips.
abstract final class NmdRadius {
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 28;

  /// Full pill — buttons, chips, badges.
  static const double pill = 999;

  static BorderRadius get borderXs => BorderRadius.circular(xs);
  static BorderRadius get borderSm => BorderRadius.circular(sm);
  static BorderRadius get borderMd => BorderRadius.circular(md);
  static BorderRadius get borderLg => BorderRadius.circular(lg);
  static BorderRadius get borderXl => BorderRadius.circular(xl);
  static BorderRadius get borderPill => BorderRadius.circular(pill);

  static BorderRadius get borderTopSheet =>
      const BorderRadius.vertical(top: Radius.circular(lg));
}
