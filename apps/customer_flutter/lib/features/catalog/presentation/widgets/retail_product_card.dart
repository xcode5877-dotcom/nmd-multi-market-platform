import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';
import 'marketplace_card_layout.dart';

/// Store strip + category grid — unified Now Market product tile (retail).
class RetailProductCard extends StatefulWidget {
  const RetailProductCard({
    super.key,
    required this.width,
    required this.name,
    required this.price,
    required this.imageUrl,
    required this.available,
    required this.heroTag,
    required this.onTap,
    this.onAddTap,
    this.description,
  });

  final double width;
  final String name;
  final double price;
  final String imageUrl;
  final bool available;
  final String heroTag;
  final VoidCallback onTap;
  final VoidCallback? onAddTap;
  final String? description;

  static const double cardHeight = MarketplaceCardLayout.productCardHeight;
  static const double imageHeight = MarketplaceCardLayout.productImageHeight;
  static const double priceRowHeight = MarketplaceCardLayout.productPriceRowHeight;

  @override
  State<RetailProductCard> createState() => _RetailProductCardState();
}

class _RetailProductCardState extends State<RetailProductCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _addPulse;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _addPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
    );
    _scaleAnim = Tween<double>(begin: 1, end: 1.14).animate(
      CurvedAnimation(parent: _addPulse, curve: Curves.easeOutBack),
    );
  }

  @override
  void dispose() {
    _addPulse.dispose();
    super.dispose();
  }

  Future<void> _handleAddTap() async {
    if (!widget.available || widget.onAddTap == null) return;
    widget.onAddTap!();
    await _addPulse.forward(from: 0);
    if (mounted) await _addPulse.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final priceStr = NmdFormat.price(widget.price);
    final desc = (widget.description ?? '').trim();
    final showDesc = desc.isNotEmpty;
    final showAdd = widget.onAddTap != null;

    return SizedBox(
      width: widget.width,
      height: RetailProductCard.cardHeight,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: NmdRadius.borderMd,
          child: Ink(
            decoration: BoxDecoration(
              color: NmdColors.surfaceBase,
              borderRadius: NmdRadius.borderMd,
              border: const Border.fromBorderSide(
                BorderSide(color: NmdColors.borderSubtle),
              ),
              boxShadow: NmdShadows.sm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: RetailProductCard.imageHeight,
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(NmdRadius.md),
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        ColorFiltered(
                          colorFilter: widget.available
                              ? const ColorFilter.mode(
                                  Colors.transparent, BlendMode.dst)
                              : const ColorFilter.matrix(<double>[
                                  0.2126,
                                  0.7152,
                                  0.0722,
                                  0,
                                  0,
                                  0.2126,
                                  0.7152,
                                  0.0722,
                                  0,
                                  0,
                                  0.2126,
                                  0.7152,
                                  0.0722,
                                  0,
                                  0,
                                  0,
                                  0,
                                  0,
                                  1,
                                  0,
                                ]),
                          child: Hero(
                            tag: widget.heroTag,
                            child: widget.imageUrl.isEmpty
                                ? ColoredBox(color: NmdColors.tintAliveMuted)
                                : CachedNetworkImage(
                                    imageUrl: widget.imageUrl,
                                    fit: BoxFit.cover,
                                    alignment: Alignment.center,
                                    fadeInDuration: NmdMotion.fast,
                                    errorWidget: (_, __, ___) => ColoredBox(
                                      color: NmdColors.tintAliveMuted,
                                    ),
                                    placeholder: (_, __) => ColoredBox(
                                      color: NmdColors.tintAliveSoft,
                                    ),
                                  ),
                          ),
                        ),
                        if (showAdd)
                          PositionedDirectional(
                            start: NmdSpacing.xs,
                            top: NmdSpacing.xs,
                            child: ScaleTransition(
                              scale: _scaleAnim,
                              child: _AddFab(
                                enabled: widget.available,
                                onTap: _handleAddTap,
                              ),
                            ),
                          ),
                        if (!widget.available)
                          PositionedDirectional(
                            end: NmdSpacing.xs,
                            top: NmdSpacing.xs,
                            child: const NmdBadge(
                              label: 'غير متوفر',
                              tone: NmdBadgeTone.neutral,
                              compact: true,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: Align(
                            alignment: Alignment.topRight,
                            child: Text(
                              widget.name,
                              textAlign: TextAlign.right,
                              maxLines: showDesc ? 1 : 2,
                              overflow: TextOverflow.ellipsis,
                              style: NmdTypography.bodyBold.copyWith(
                                fontSize: 14,
                                height: 1.25,
                                color: widget.available
                                    ? NmdColors.textPrimary
                                    : NmdColors.textTertiary,
                              ),
                            ),
                          ),
                        ),
                        if (showDesc) ...[
                          const SizedBox(height: 2),
                          Text(
                            desc,
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: NmdTypography.micro.copyWith(
                              color: NmdColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                        const SizedBox(height: 4),
                        SizedBox(
                          height: RetailProductCard.priceRowHeight,
                          child: Row(
                            textDirection: TextDirection.rtl,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Flexible(
                                child: Text(
                                  priceStr,
                                  maxLines: 1,
                                  overflow: TextOverflow.fade,
                                  style: NmdTypography.price.copyWith(
                                    fontSize: 16,
                                    color: widget.available
                                        ? NmdColors.brandPrimary
                                        : NmdColors.textTertiary,
                                  ),
                                ),
                              ),
                              Text(
                                '₪',
                                style: NmdTypography.label.copyWith(
                                  color: NmdColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AddFab extends StatelessWidget {
  const _AddFab({required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? NmdColors.brandPrimary : NmdColors.textTertiary,
      shape: const CircleBorder(),
      elevation: enabled ? 2 : 0,
      shadowColor: NmdColors.brandPrimary.withValues(alpha: 0.35),
      child: InkWell(
        onTap: enabled ? onTap : null,
        customBorder: const CircleBorder(),
        child: const SizedBox(
          width: 34,
          height: 34,
          child: Icon(
            Icons.add_rounded,
            size: 20,
            color: NmdColors.textOnBrand,
          ),
        ),
      ),
    );
  }
}
