import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../api/models/product.dart';
import '../../../../api/resolve_image_url.dart';
import '../../../../design_system/design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../application/service_lead_actions.dart';
import '../../data/tenant_contact_info.dart';
import '../../domain/service_inquiry_message.dart';

// ---------------------------------------------------------------------------
// Premium wellness storefront — Now Market visual DNA
// ---------------------------------------------------------------------------

class ImmersiveLuxuryStoreExperience {
  ImmersiveLuxuryStoreExperience._();

  static List<Widget> buildSlivers({
    required ScrollController scrollController,
    required String storeName,
    required String bannerUrl,
    required String logoUrl,
    required String aboutPlain,
    String? pillarTag,
    required List<Product> products,
    required String marketSlug,
    required String storeId,
    required String tenantIdForLeads,
    required TenantContactInfo officeContact,
    VoidCallback? onBeginExperience,
  }) {
    String? productVisualUrl;
    for (final p in products) {
      final img = p.imageUrl.trim();
      if (img.isNotEmpty) {
        productVisualUrl = img;
        break;
      }
    }

    return [
      SliverToBoxAdapter(
        child: _PremiumWellnessHero(
          storeName: storeName,
          bannerUrl: bannerUrl,
          logoUrl: logoUrl,
          productImageUrl: productVisualUrl,
          aboutPlain: aboutPlain,
          pillarTag: pillarTag,
          tenantIdForLeads: tenantIdForLeads,
          officeContact: officeContact,
          onExploreServices: onBeginExperience,
        ),
      ),
      if (products.isEmpty)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(48),
            child: NmdEmptyState(
              title: 'قريباً',
              message: 'خدمات جديدة قريباً',
              icon: Icons.spa_outlined,
            ),
          ),
        )
      else ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Text(
                'خدماتنا',
                style: NmdTypography.h2.copyWith(
                  color: NmdColors.textPrimary,
                  fontSize: PremiumMarketplaceDesignSystem.sectionTitleSize,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 40),
          sliver: SliverList.separated(
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(height: 16),
            itemBuilder: (context, index) {
              return _PremiumServiceCard(
                product: products[index],
                index: index,
                marketSlug: marketSlug,
                storeId: storeId,
                tenantIdForLeads: tenantIdForLeads,
                officeContact: officeContact,
              );
            },
          ),
        ),
      ],
    ];
  }
}

class _PremiumWellnessHero extends StatelessWidget {
  const _PremiumWellnessHero({
    required this.storeName,
    required this.bannerUrl,
    required this.logoUrl,
    required this.productImageUrl,
    required this.aboutPlain,
    required this.pillarTag,
    required this.tenantIdForLeads,
    required this.officeContact,
    this.onExploreServices,
  });

  final String storeName;
  final String bannerUrl;
  final String logoUrl;
  final String? productImageUrl;
  final String aboutPlain;
  final String? pillarTag;
  final String tenantIdForLeads;
  final TenantContactInfo officeContact;
  final VoidCallback? onExploreServices;

  String? get _heroImageUrl {
    final banner = bannerUrl.trim();
    if (banner.isNotEmpty) return banner;
    final product = productImageUrl?.trim() ?? '';
    if (product.isNotEmpty) return product;
    final logo = logoUrl.trim();
    if (logo.isNotEmpty) return logo;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final heroH = PremiumMarketplaceDesignSystem.serviceHeroHeight(context);
    final subtitle = pillarTag?.trim() ?? '';
    final description = aboutPlain.trim();
    final imageUrl = _heroImageUrl;

    return SizedBox(
      height: heroH,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        clipBehavior: Clip.none,
        children: [
          if (imageUrl != null)
            CachedNetworkImage(
              imageUrl: resolveImageUrl(imageUrl),
              fit: BoxFit.cover,
              width: double.infinity,
              height: heroH,
              placeholder: (_, __) => const _ServiceHeroImageFallback(),
              errorWidget: (_, __, ___) => const _ServiceHeroImageFallback(),
            )
          else
            const _ServiceHeroImageFallback(),
          // Bright premium wash — image stays visible.
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x33FFFFFF),
                    Color(0x14FFFFFF),
                    Color(0x00FFFFFF),
                  ],
                  stops: [0.0, 0.42, 1.0],
                ),
              ),
            ),
          ),
          // RTL text side: strong soft white → transparent toward image.
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                  colors: [
                    Color(0xD9FFFFFF),
                    Color(0x8CFFFFFF),
                    Color(0x00FFFFFF),
                  ],
                  stops: [0.0, 0.38, 0.78],
                ),
              ),
            ),
          ),
          // Bottom readability scrim (light, not black).
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Color(0xBFFFFFFF),
                    Color(0x47FFFFFF),
                    Color(0x00FFFFFF),
                  ],
                  stops: [0.0, 0.32, 0.68],
                ),
              ),
            ),
          ),
          // Subtle depth on image side only (optional, very light).
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    Color(0x1A0F172A),
                    Color(0x000F172A),
                  ],
                  stops: [0.0, 0.62],
                ),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 36),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Spacer(),
                    Text(
                      storeName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: NmdTypography.h2.copyWith(
                        color: NmdColors.textPrimary,
                        fontSize: PremiumMarketplaceDesignSystem.heroTitleSize,
                        fontWeight: FontWeight.w800,
                        height: 1.12,
                        letterSpacing: -0.3,
                      ),
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: NmdTypography.label.copyWith(
                          color: NmdColors.brandPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),
                    ],
                    if (description.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        description,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: NmdTypography.body.copyWith(
                          color: const Color(0xFF475569),
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                          height: 1.55,
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: onExploreServices ?? () => _onHeroBook(context),
                      style: FilledButton.styleFrom(
                        backgroundColor: NmdColors.brandPrimary,
                        foregroundColor: NmdColors.textOnBrand,
                        minimumSize: const Size(0, 44),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        'احجز الآن',
                        style: NmdTypography.button.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: -1,
            child: _HeroWaveTransition(),
          ),
        ],
      ),
    );
  }

  Future<void> _onHeroBook(BuildContext context) async {
    HapticFeedback.lightImpact();
    final dio = context.read<Dio>();
    final auth = context.read<AuthBloc>().state;
    await launchWhatsAppInquiry(
      dio: dio,
      tenantId: tenantIdForLeads,
      contact: const TenantContactInfo(),
      tenantContact: officeContact,
      messageOverride: storeServicesInquiryWhatsAppMessage(),
      customerPhone: auth.step == AuthStep.done ? auth.phone : null,
      context: context,
    );
  }
}

/// Fallback when the store has no banner/product/logo art.
class _ServiceHeroImageFallback extends StatelessWidget {
  const _ServiceHeroImageFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [
            Color(0xFFE8F5F3),
            Color(0xFFD1FAE5),
            Color(0xFFB8E8E0),
          ],
        ),
      ),
    );
  }
}

/// Soft curved transition from hero into services list.
class _HeroWaveTransition extends StatelessWidget {
  const _HeroWaveTransition();

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: _HeroWaveClipper(),
      child: Container(
        height: 26,
        width: double.infinity,
        color: NmdColors.surfaceBase,
      ),
    );
  }
}

class _HeroWaveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    return Path()
      ..moveTo(0, size.height * 0.5)
      ..quadraticBezierTo(
        size.width * 0.5,
        size.height * 0.08,
        size.width,
        size.height * 0.48,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// Price label for services — never show 0.00.
String _servicePriceLabel(Product product) {
  final value = product.customerListPrice;
  if (value <= 0) return 'السعر عند الطلب';
  return NmdFormat.money(value);
}

/// Parses plain-text service description for card + detail sheet.
final class _ServiceDescriptionParts {
  const _ServiceDescriptionParts({
    required this.cardSummary,
    required this.fullText,
    required this.sheetBody,
    this.duration,
    this.note,
    this.benefitLines = const [],
  });

  final String cardSummary;
  final String fullText;
  final String sheetBody;
  final String? duration;
  final String? note;
  final List<String> benefitLines;

  factory _ServiceDescriptionParts.fromDescription(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return const _ServiceDescriptionParts(
        cardSummary: 'جلسة عناية فاخرة في بيئة هادئة ومريحة.',
        fullText: '',
        sheetBody: '',
      );
    }

    final lines =
        trimmed.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

    String? duration;
    String? note;
    final benefits = <String>[];
    final bodyLines = <String>[];

    for (final line in lines) {
      final lower = line.toLowerCase();
      if (_matchesDuration(lower)) {
        duration ??= _stripPrefix(line);
      } else if (_matchesNote(lower)) {
        note ??= _stripPrefix(line);
      } else if (_isBulletLine(line)) {
        benefits.add(_stripBullet(line));
      } else {
        bodyLines.add(line);
      }
    }

    final summaryLines = bodyLines.isNotEmpty
        ? bodyLines.take(3).toList()
        : (benefits.isNotEmpty ? [benefits.first] : <String>[lines.first]);

    final body = bodyLines.join('\n');

    return _ServiceDescriptionParts(
      cardSummary: summaryLines.join('\n'),
      fullText: trimmed,
      sheetBody: body.isNotEmpty ? body : trimmed,
      duration: duration,
      note: note,
      benefitLines: benefits,
    );
  }

  static bool _matchesDuration(String lower) {
    return lower.startsWith('مدة') ||
        lower.startsWith('المدة') ||
        lower.contains('duration') ||
        lower.contains('min');
  }

  static bool _matchesNote(String lower) {
    return lower.startsWith('ملاحظة') ||
        lower.startsWith('تنبيه') ||
        lower.startsWith('note') ||
        lower.startsWith('ملاحظات');
  }

  static bool _isBulletLine(String line) {
    final t = line.trim();
    return t.startsWith('•') ||
        t.startsWith('-') ||
        t.startsWith('*') ||
        RegExp(r'^\d+[\.\)]').hasMatch(t);
  }

  static String _stripPrefix(String line) {
    final idx = line.indexOf(':');
    if (idx > 0 && idx < 12) return line.substring(idx + 1).trim();
    final idxAr = line.indexOf('：');
    if (idxAr > 0 && idxAr < 12) return line.substring(idxAr + 1).trim();
    return line;
  }

  static String _stripBullet(String line) {
    return line.replaceFirst(RegExp(r'^[\-\*•\d\.\)\s]+'), '').trim();
  }
}

Future<void> _showServiceDetailSheet(
  BuildContext context, {
  required Product product,
  required TenantContactInfo officeContact,
  required String tenantIdForLeads,
  required Future<void> Function() onBook,
}) {
  final parts = _ServiceDescriptionParts.fromDescription(product.description);
  final imageUrl = product.imageUrl.trim();

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final routeAnimation = ModalRoute.of(ctx)!.animation!;

      return FadeTransition(
        opacity: CurvedAnimation(
          parent: routeAnimation,
          curve: Curves.easeOut,
        ),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.06),
            end: Offset.zero,
          ).animate(
            CurvedAnimation(
              parent: routeAnimation,
              curve: Curves.easeOutCubic,
            ),
          ),
          child: DraggableScrollableSheet(
            initialChildSize: 0.72,
            minChildSize: 0.45,
            maxChildSize: 0.92,
            builder: (context, scrollController) {
              return DecoratedBox(
                decoration: const BoxDecoration(
                  color: NmdColors.surfaceBase,
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(
                      PremiumMarketplaceDesignSystem.serviceBottomSheetRadius,
                    ),
                  ),
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
                        padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
                        children: [
                          if (imageUrl.isNotEmpty)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(20),
                              child: AspectRatio(
                                aspectRatio: 16 / 9,
                                child: CachedNetworkImage(
                                  imageUrl: resolveImageUrl(imageUrl),
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) =>
                                      const _ImagePlaceholder(),
                                  errorWidget: (_, __, ___) =>
                                      const _ImagePlaceholder(),
                                ),
                              ),
                            ),
                          if (imageUrl.isNotEmpty) const SizedBox(height: 20),
                          Directionality(
                            textDirection: TextDirection.rtl,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  product.name,
                                  style: NmdTypography.h2.copyWith(
                                    color: NmdColors.textPrimary,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    height: 1.2,
                                  ),
                                ),
                                if (parts.sheetBody.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                    parts.sheetBody,
                                    style: NmdTypography.body.copyWith(
                                      color: const Color(0xFF475569),
                                      fontSize: 14,
                                      height: 1.6,
                                    ),
                                  ),
                                ],
                                if (parts.benefitLines.isNotEmpty)
                                  _DetailSection(
                                    title: 'الفوائد',
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: parts.benefitLines
                                          .map(
                                            (b) => Padding(
                                              padding: const EdgeInsets.only(
                                                bottom: 6,
                                              ),
                                              child: Row(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    '• ',
                                                    style: NmdTypography.body
                                                        .copyWith(
                                                      color:
                                                          NmdColors.brandPrimary,
                                                    ),
                                                  ),
                                                  Expanded(
                                                    child: Text(
                                                      b,
                                                      style: NmdTypography.body
                                                          .copyWith(
                                                        color: NmdColors
                                                            .textSecondary,
                                                        fontSize: 14,
                                                        height: 1.5,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          )
                                          .toList(),
                                    ),
                                  ),
                                if (parts.duration != null)
                                  _DetailSection(
                                    title: 'مدة الجلسة',
                                    child: Text(
                                      parts.duration!,
                                      style: NmdTypography.body.copyWith(
                                        color: NmdColors.textSecondary,
                                        fontSize: 14,
                                        height: 1.5,
                                      ),
                                    ),
                                  ),
                                if (parts.note != null)
                                  _DetailSection(
                                    title: 'ملاحظات',
                                    child: Text(
                                      parts.note!,
                                      style: NmdTypography.body.copyWith(
                                        color: NmdColors.textSecondary,
                                        fontSize: 14,
                                        height: 1.5,
                                      ),
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
                          label: 'احجز الآن',
                          onPressed: () async {
                            Navigator.of(ctx).pop();
                            await onBook();
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

class _DetailSection extends StatelessWidget {
  const _DetailSection({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: NmdTypography.label.copyWith(
              color: NmdColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _PremiumServiceCard extends StatefulWidget {
  const _PremiumServiceCard({
    required this.product,
    required this.index,
    required this.marketSlug,
    required this.storeId,
    required this.tenantIdForLeads,
    required this.officeContact,
  });

  final Product product;
  final int index;
  final String marketSlug;
  final String storeId;
  final String tenantIdForLeads;
  final TenantContactInfo officeContact;

  @override
  State<_PremiumServiceCard> createState() => _PremiumServiceCardState();
}

class _PremiumServiceCardState extends State<_PremiumServiceCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fade;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _fade = AnimationController(
      vsync: this,
      duration: PremiumMarketplaceDesignSystem.serviceMotionEntrance,
    );
    _opacity = CurvedAnimation(parent: _fade, curve: Curves.easeOut);
    Future<void>.delayed(Duration(milliseconds: 35 * widget.index), () {
      if (mounted) _fade.forward();
    });
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  Future<void> _book() async {
    HapticFeedback.lightImpact();
    final dio = context.read<Dio>();
    final auth = context.read<AuthBloc>().state;
    await launchWhatsAppInquiry(
      dio: dio,
      tenantId: widget.tenantIdForLeads,
      contact: const TenantContactInfo(),
      tenantContact: widget.officeContact,
      serviceName: widget.product.name,
      customerPhone: auth.step == AuthStep.done ? auth.phone : null,
      context: context,
    );
  }

  void _openDetailSheet() {
    HapticFeedback.lightImpact();
    _showServiceDetailSheet(
      context,
      product: widget.product,
      officeContact: widget.officeContact,
      tenantIdForLeads: widget.tenantIdForLeads,
      onBook: _book,
    );
  }

  @override
  Widget build(BuildContext context) {
    final url = widget.product.imageUrl.trim();
    final parts = _ServiceDescriptionParts.fromDescription(widget.product.description);
    final priceLabel = _servicePriceLabel(widget.product);

    return FadeTransition(
      opacity: _opacity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: NmdColors.surfaceBase,
          borderRadius: BorderRadius.circular(
            PremiumMarketplaceDesignSystem.serviceCardRadius,
          ),
          border: Border.all(
            color: NmdColors.borderSubtle.withValues(alpha: 0.8),
          ),
          boxShadow: PremiumMarketplaceDesignSystem.serviceCardShadow(),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: PremiumMarketplaceDesignSystem.serviceCardMinHeight,
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _ServiceCardImage(url: url),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.bodyBold.copyWith(
                            color: NmdColors.textPrimary,
                            fontSize:
                                PremiumMarketplaceDesignSystem.cardTitleSize,
                            fontWeight: FontWeight.w700,
                            height: 1.18,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          parts.cardSummary,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.body.copyWith(
                            color: const Color(0xFF64748B),
                            fontSize: 13,
                            height: 1.42,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          priceLabel,
                          style: NmdTypography.micro.copyWith(
                            color: const Color(0xFF64748B),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            _ServiceCompactCta(onPressed: _book),
                            const SizedBox(width: 10),
                            GestureDetector(
                              onTap: _openDetailSheet,
                              behavior: HitTestBehavior.opaque,
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  bottom: 8,
                                  left: 4,
                                  right: 4,
                                ),
                                child: Text(
                                  'تفاصيل',
                                  style: NmdTypography.micro.copyWith(
                                    color: NmdColors.brandPrimary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    decoration: TextDecoration.underline,
                                    decorationColor: NmdColors.brandPrimary
                                        .withValues(alpha: 0.45),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ServiceCardImage extends StatelessWidget {
  const _ServiceCardImage({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    final size = PremiumMarketplaceDesignSystem.serviceCardImageSize;
    final inner = size - 18;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: PremiumMarketplaceDesignSystem.serviceImageGlow,
            ),
            child: SizedBox(width: size, height: size),
          ),
          Padding(
            padding: const EdgeInsets.all(9),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(26),
              child: url.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: resolveImageUrl(url),
                      width: inner,
                      height: inner,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => const _ImagePlaceholder(),
                      errorWidget: (_, __, ___) => const _ImagePlaceholder(),
                    )
                  : const _ImagePlaceholder(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceCompactCta extends StatefulWidget {
  const _ServiceCompactCta({required this.onPressed});

  final VoidCallback onPressed;

  @override
  State<_ServiceCompactCta> createState() => _ServiceCompactCtaState();
}

class _ServiceCompactCtaState extends State<_ServiceCompactCta> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onPressed();
      },
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: PremiumMarketplaceDesignSystem.serviceCardCtaHeight,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: NmdColors.brandPrimary,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: NmdColors.brandPrimary.withValues(alpha: 0.14),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            'احجز الآن',
            style: NmdTypography.button.copyWith(
              color: NmdColors.textOnBrand,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: NmdColors.tintAliveSoft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Icon(
          Icons.spa_outlined,
          size: 28,
          color: NmdColors.brandPrimary.withValues(alpha: 0.35),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Legacy exports — product detail pages
// ---------------------------------------------------------------------------

class CinematicHeroBookPill extends StatelessWidget {
  const CinematicHeroBookPill({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return NmdButton(
      label: 'احجز',
      size: NmdButtonSize.compact,
      expand: false,
      onPressed: onPressed,
    );
  }
}

class CinematicServiceDock extends StatelessWidget {
  const CinematicServiceDock({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Positioned(
      right: 16,
      bottom: bottom + 12,
      child: CinematicHeroBookPill(onPressed: onPressed),
    );
  }
}
