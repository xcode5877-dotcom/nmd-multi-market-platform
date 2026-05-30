import 'package:flutter/material.dart';

/// Shared dimensions for marketplace horizontal strips and product tiles.
abstract final class MarketplaceCardLayout {
  static const double stripCardWidth = 140;
  static const double stripSeparator = 12;
  static const double stripHorizontalPadding = 16;

  static const double productCardHeight = 218;
  static const double productImageHeight = 128;
  static const double productPriceRowHeight = 26;

  static const double storeCardWidth = 152;
  static const double storeLogoAreaHeight = 112;
  static const double storeCardHeight = storeLogoAreaHeight + 72;

  static EdgeInsetsDirectional get stripPadding =>
      const EdgeInsetsDirectional.only(
        start: stripHorizontalPadding,
        end: stripHorizontalPadding,
      );
}

/// Snaps horizontal product/store strips to card boundaries.
class MarketplaceStripScrollPhysics extends ScrollPhysics {
  const MarketplaceStripScrollPhysics({
    required this.itemExtent,
    required this.separatorWidth,
    super.parent,
  });

  final double itemExtent;
  final double separatorWidth;

  @override
  MarketplaceStripScrollPhysics applyTo(ScrollPhysics? ancestor) {
    return MarketplaceStripScrollPhysics(
      itemExtent: itemExtent,
      separatorWidth: separatorWidth,
      parent: buildParent(ancestor),
    );
  }

  double get _step => itemExtent + separatorWidth;

  @override
  Simulation? createBallisticSimulation(
    ScrollMetrics position,
    double velocity,
  ) {
    if (_step <= 0) {
      return super.createBallisticSimulation(position, velocity);
    }
    final page = position.pixels / _step;
    final targetPage = velocity.abs() < 50 ? page.round() : page.roundToDouble();
    final target = (targetPage * _step)
        .clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((target - position.pixels).abs() < 0.5) return null;
    return ScrollSpringSimulation(
      spring,
      position.pixels,
      target,
      velocity,
      tolerance: toleranceFor(position),
    );
  }
}
