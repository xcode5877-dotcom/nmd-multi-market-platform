import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/design_system.dart';
import '../../domain/feed/feed_campaign.dart';

Future<void> showFeedCampaignPopup(
  BuildContext context, {
  required FeedCampaign campaign,
  required String marketSlug,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final animation = ModalRoute.of(ctx)!.animation!;
      return FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.08),
            end: Offset.zero,
          ).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: DraggableScrollableSheet(
            initialChildSize: 0.5,
            minChildSize: 0.35,
            maxChildSize: 0.88,
            builder: (context, scrollController) {
              final body = campaign.popupBody?.trim().isNotEmpty == true
                  ? campaign.popupBody!.trim()
                  : campaign.subtitle;

              return DecoratedBox(
                decoration: const BoxDecoration(
                  color: NmdColors.surfaceBase,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                child: Column(
                  children: [
                    const SizedBox(height: 10),
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: NmdColors.borderSubtle,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                    Expanded(
                      child: ListView(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
                        children: [
                          Directionality(
                            textDirection: TextDirection.rtl,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  campaign.title,
                                  style: NmdTypography.h2.copyWith(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    color: NmdColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  body,
                                  style: NmdTypography.body.copyWith(
                                    color: NmdColors.textSecondary,
                                    fontSize: 14,
                                    height: 1.6,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                        child: NmdButton(
                          label: campaign.ctaLabel,
                          onPressed: () {
                            HapticFeedback.lightImpact();
                            Navigator.of(ctx).pop();
                            if (campaign.actionType ==
                                FeedCampaignActionType.openCompetition) {
                              context.push('/market/$marketSlug/rewards');
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      );
    },
  );
}
