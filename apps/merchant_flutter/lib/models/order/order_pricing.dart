/// Pricing model with Net (merchant) vs Final (merchant + commission).
class OrderPricing {
  const OrderPricing({
    required this.netPrice,
    required this.commissionPercent,
  });

  final double netPrice;
  final double commissionPercent;

  double get commissionAmount => (netPrice * commissionPercent) / 100.0;
  double get finalPrice => netPrice + commissionAmount;

  static OrderPricing fromFinalPrice({
    required double finalPrice,
    required double commissionPercent,
  }) {
    final divisor = 1 + (commissionPercent / 100.0);
    final net = divisor == 0 ? 0.0 : finalPrice / divisor;
    return OrderPricing(netPrice: net, commissionPercent: commissionPercent);
  }
}
