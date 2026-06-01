import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_editorial_glow.dart';
import 'feed_editorial_tokens.dart';
import 'feed_promo_chrome.dart';

/// Rewards / coins discovery — soft motion, no banner CTA.
class RewardsDiscoveryEditorialCard extends StatefulWidget {
  const RewardsDiscoveryEditorialCard({
    super.key,
    required this.campaign,
    required this.onTap,
    this.listIndex = 0,
  });

  final FeedCampaign campaign;
  final VoidCallback onTap;
  final int listIndex;

  @override
  State<RewardsDiscoveryEditorialCard> createState() =>
      _RewardsDiscoveryEditorialCardState();
}

class _RewardsDiscoveryEditorialCardState extends State<RewardsDiscoveryEditorialCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _float;

  @override
  void initState() {
    super.initState();
    _float = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _float.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FeedPromoChrome(
      blockType: 'REWARDS_DISCOVERY',
      campaign: widget.campaign,
      listIndex: widget.listIndex,
      onTap: widget.onTap,
      child: FeedEditorialGlow(
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(FeedEditorialTokens.radiusLg),
            gradient: const LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: [Color(0xFFE8F5F3), Color(0xFFD1FAE5), Color(0xFFECFDF5)],
            ),
            border: Border.all(
              color: FeedEditorialTokens.teal.withValues(alpha: 0.18),
            ),
            boxShadow: FeedEditorialTokens.softLift,
          ),
          padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.campaign.title.isNotEmpty
                            ? widget.campaign.title
                            : 'معك عملات؟ 👀',
                        style: NmdTypography.h2.copyWith(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: FeedEditorialTokens.navy,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        widget.campaign.subtitle.isNotEmpty
                            ? widget.campaign.subtitle
                            : 'استبدل عملاتك بمكافآت من محلاتك المفضلة',
                        style: NmdTypography.body.copyWith(
                          fontSize: 13,
                          color: NmdColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            widget.campaign.ctaLabel.isNotEmpty
                                ? widget.campaign.ctaLabel
                                : 'اكتشف المكافآت',
                            style: NmdTypography.label.copyWith(
                              color: FeedEditorialTokens.teal,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Icons.arrow_back_ios_new_rounded,
                            size: 13,
                            color: FeedEditorialTokens.teal,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                AnimatedBuilder(
                  animation: _float,
                  builder: (context, child) {
                    return Transform.translate(
                      offset: Offset(0, -4 * _float.value),
                      child: child,
                    );
                  },
                  child: const _CoinStack(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CoinStack extends StatelessWidget {
  const _CoinStack();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 78,
      height: 64,
      child: Stack(
        children: [
          _coin(0, const Color(0xFFFDE68A)),
          _coin(18, const Color(0xFFFBBF24)),
          _coin(36, const Color(0xFF0E7C72)),
        ],
      ),
    );
  }

  Widget _coin(double right, Color color) {
    return Positioned(
      right: right,
      top: 8,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          border: Border.all(color: Colors.white, width: 2.5),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.35),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          '₪',
          style: TextStyle(
            color: color.computeLuminance() > 0.6
                ? FeedEditorialTokens.navy
                : Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}
