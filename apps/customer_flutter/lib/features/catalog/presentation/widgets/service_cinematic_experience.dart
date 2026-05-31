import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../api/models/product.dart';
import '../../../../api/resolve_image_url.dart';
import '../../../../design_system/design_system.dart';
import '../../../../design_system/premium/premium_marketplace_design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../application/service_lead_actions.dart';
import '../../data/tenant_contact_info.dart';

/// Cinematic service-store hero — depth, atmosphere, minimal metadata.
class CinematicStoreHero extends StatefulWidget {
  const CinematicStoreHero({
    super.key,
    required this.storeName,
    required this.logoUrl,
    required this.bannerUrl,
    required this.openTime,
    required this.closeTime,
    required this.operatingStatus,
    required this.isAdminClosed,
    required this.aboutPlain,
  });

  final String storeName;
  final String logoUrl;
  final String bannerUrl;
  final String openTime;
  final String closeTime;
  final String operatingStatus;
  final bool isAdminClosed;
  final String aboutPlain;

  @override
  State<CinematicStoreHero> createState() => _CinematicStoreHeroState();
}

class _CinematicStoreHeroState extends State<CinematicStoreHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _drift;

  @override
  void initState() {
    super.initState();
    _drift = AnimationController(
      vsync: this,
      duration: PremiumMarketplaceDesignSystem.ambientDrift,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  String get _statusLine {
    if (widget.isAdminClosed) return 'مغلق مؤقتاً';
    final status = NmdSemantic.storeStatusLabelAr(
      NmdSemantic.storeStatusFromApi(widget.operatingStatus),
    );
    return '$status • ${widget.openTime} - ${widget.closeTime}';
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.sizeOf(context).height;
    final heroH = (screenH * 0.44).clamp(300.0, 440.0);

    return RepaintBoundary(
      child: SizedBox(
        height: heroH,
        width: double.infinity,
        child: AnimatedBuilder(
          animation: _drift,
          builder: (context, child) {
            final t = PremiumMarketplaceDesignSystem.cinematicCurve
                .transform(_drift.value);
            return Stack(
              fit: StackFit.expand,
              children: [
                if (widget.bannerUrl.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: resolveImageUrl(widget.bannerUrl),
                    fit: BoxFit.cover,
                    alignment: Alignment(0, -0.08 + t * 0.04),
                    placeholder: (_, __) => const _HeroFallback(),
                    errorWidget: (_, __, ___) => const _HeroFallback(),
                  )
                else
                  const _HeroFallback(),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.18 + t * 0.04),
                        Colors.black.withValues(alpha: 0.52),
                        Colors.black.withValues(alpha: 0.94),
                      ],
                      stops: const [0.0, 0.48, 1.0],
                    ),
                  ),
                ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: PremiumMarketplaceDesignSystem.storeHeroOverlay,
                  ),
                ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: PremiumMarketplaceDesignSystem.storeHeroVignette,
                  ),
                ),
                Positioned(
                  right: -28 + t * 18,
                  top: 36 + t * 8,
                  child: IgnorePointer(
                    child: Container(
                      width: 160,
                      height: 160,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            PremiumMarketplaceDesignSystem.brandGlow(0.12),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: -40 + (1 - t) * 14,
                  bottom: 48,
                  child: IgnorePointer(
                    child: Container(
                      width: 130,
                      height: 130,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            PremiumMarketplaceDesignSystem.goldGlow(0.08),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: heroH * 0.55,
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.92),
                            Colors.black.withValues(alpha: 0.45),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.55, 1.0],
                        ),
                      ),
                    ),
                  ),
                ),
                child!,
              ],
            );
          },
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Spacer(),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (widget.logoUrl.isNotEmpty) ...[
                          _GlassLogo(url: widget.logoUrl, drift: _drift),
                          const SizedBox(width: 16),
                        ],
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.storeName,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: NmdTypography.display.copyWith(
                                  color: Colors.white.withValues(alpha: 0.96),
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  height: 1.06,
                                  letterSpacing: -0.6,
                                  shadows: const [
                                    Shadow(
                                      color: Color(0xAA000000),
                                      blurRadius: 20,
                                      offset: Offset(0, 6),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                _statusLine,
                                style: NmdTypography.micro.copyWith(
                                  color: Colors.white.withValues(alpha: 0.48),
                                  fontSize: 10.5,
                                  letterSpacing: 0.4,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassLogo extends StatelessWidget {
  const _GlassLogo({required this.url, required this.drift});

  final String url;
  final Animation<double> drift;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: drift,
      builder: (context, child) {
        final t = PremiumMarketplaceDesignSystem.cinematicCurve
            .transform(drift.value);
        return Transform.translate(
          offset: Offset(0, -3 + t * 6),
          child: child,
        );
      },
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.42),
              blurRadius: 22,
              offset: const Offset(0, 10),
              spreadRadius: -4,
            ),
            BoxShadow(
              color: Colors.white.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, -1),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
            child: Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.16),
                  width: 1,
                ),
                color: Colors.white.withValues(alpha: 0.08),
              ),
              child: ClipOval(
                child: CachedNetworkImage(
                  imageUrl: resolveImageUrl(url),
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => ColoredBox(
                    color: const Color(0xFF134E4A).withValues(alpha: 0.25),
                    child: Icon(
                      Icons.storefront_rounded,
                      color: Colors.white.withValues(alpha: 0.5),
                      size: 22,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroFallback extends StatelessWidget {
  const _HeroFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: PremiumMarketplaceDesignSystem.cinematicHeroAmbient,
      ),
    );
  }
}

/// Full-width cinematic service tile — editorial, asymmetric, immersive.
class CinematicServicePanel extends StatefulWidget {
  const CinematicServicePanel({
    super.key,
    required this.product,
    required this.marketSlug,
    required this.storeId,
    required this.tenantIdForLeads,
    required this.officeContact,
    this.index = 0,
    this.scrollController,
  });

  final Product product;
  final String marketSlug;
  final String storeId;
  final String tenantIdForLeads;
  final TenantContactInfo officeContact;
  final int index;
  final ScrollController? scrollController;

  @override
  State<CinematicServicePanel> createState() => _CinematicServicePanelState();
}

class _CinematicServicePanelState extends State<CinematicServicePanel>
    with TickerProviderStateMixin {
  late final AnimationController _entrance;
  late final AnimationController _ambient;
  bool _pressed = false;

  double get _tileHeight {
    final mod = widget.index % 3;
    return PremiumMarketplaceDesignSystem.serviceTileHeightBase +
        (mod == 0 ? 32 : mod == 1 ? 8 : 20);
  }

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: PremiumMarketplaceDesignSystem.entrance,
    );
    _ambient = AnimationController(
      vsync: this,
      duration: PremiumMarketplaceDesignSystem.glowBreath,
    )..repeat(reverse: true);
    Future<void>.delayed(Duration(milliseconds: 80 * widget.index), () {
      if (mounted) _entrance.forward();
    });
  }

  @override
  void dispose() {
    _entrance.dispose();
    _ambient.dispose();
    super.dispose();
  }

  Future<void> _inquire(BuildContext context) async {
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

  BorderRadius get _tileRadius {
    if (widget.index.isEven) {
      return const BorderRadius.only(
        topLeft: Radius.circular(PremiumMarketplaceDesignSystem.radiusXl),
        bottomLeft: Radius.circular(PremiumMarketplaceDesignSystem.radiusMd),
      );
    }
    return const BorderRadius.only(
      topRight: Radius.circular(PremiumMarketplaceDesignSystem.radiusXl),
      bottomRight: Radius.circular(PremiumMarketplaceDesignSystem.radiusMd),
    );
  }

  EdgeInsetsDirectional get _tileInset {
    if (widget.index.isEven) {
      return const EdgeInsetsDirectional.only(start: 0, end: 36);
    }
    return const EdgeInsetsDirectional.only(start: 36, end: 0);
  }

  Widget _buildTile({required double scrollOffset}) {
    final desc = widget.product.description.trim();
    final subtitle =
        desc.length > 64 ? '${desc.substring(0, 62)}…' : desc;
    final url = widget.product.imageUrl.trim();
    final heroTag = 'service-${widget.storeId}-${widget.product.id}';
    final parallaxY = scrollOffset * 0.035 * (widget.index.isEven ? 1 : -1);
    final ambientT = PremiumMarketplaceDesignSystem.cinematicCurve
        .transform(_ambient.value);

    return RepaintBoundary(
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: _entrance,
          curve: PremiumMarketplaceDesignSystem.entranceCurve,
        ),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: Offset(widget.index.isEven ? 0.06 : -0.06, 0.04),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: _entrance,
            curve: PremiumMarketplaceDesignSystem.cinematicCurve,
          )),
          child: Padding(
            padding: _tileInset,
            child: AnimatedScale(
              scale: _pressed ? 0.982 : 1 + ambientT * 0.004,
              duration: PremiumMarketplaceDesignSystem.micro,
              curve: PremiumMarketplaceDesignSystem.pressCurve,
              child: GestureDetector(
                onTapDown: (_) => setState(() => _pressed = true),
                onTapUp: (_) => setState(() => _pressed = false),
                onTapCancel: () => setState(() => _pressed = false),
                onTap: () => context.push(
                  '/market/${widget.marketSlug}/store/${widget.storeId}/product/${widget.product.id}',
                ),
                child: Hero(
                  tag: heroTag,
                  child: ClipRRect(
                    borderRadius: _tileRadius,
                    child: SizedBox(
                      height: _tileHeight,
                      width: double.infinity,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Transform.translate(
                            offset: Offset(0, parallaxY),
                            child: AnimatedScale(
                              scale: _pressed ? 1.06 : 1.0,
                              duration: PremiumMarketplaceDesignSystem.micro,
                              curve: PremiumMarketplaceDesignSystem.pressCurve,
                              child: url.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: resolveImageUrl(url),
                                      fit: BoxFit.cover,
                                      alignment: Alignment(
                                        widget.index.isEven ? -0.1 : 0.1,
                                        -0.12,
                                      ),
                                      placeholder: (_, __) => const ColoredBox(
                                        color: Color(0xFF141A22),
                                      ),
                                    )
                                  : const ColoredBox(color: Color(0xFF141A22)),
                            ),
                          ),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.black.withValues(alpha: 0.12),
                                  Colors.black.withValues(alpha: 0.42),
                                  Colors.black.withValues(alpha: 0.9),
                                ],
                                stops: const [0.0, 0.5, 1.0],
                              ),
                            ),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: _tileHeight * 0.62,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.bottomCenter,
                                  end: Alignment.topCenter,
                                  colors: [
                                    Colors.black.withValues(alpha: 0.88),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(24, 24, 24, 22),
                            child: Directionality(
                              textDirection: TextDirection.rtl,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Spacer(),
                                  Text(
                                    widget.product.name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: NmdTypography.display.copyWith(
                                      color: Colors.white.withValues(alpha: 0.96),
                                      fontSize: 23,
                                      fontWeight: FontWeight.w900,
                                      height: 1.12,
                                      letterSpacing: -0.4,
                                    ),
                                  ),
                                  if (subtitle.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      subtitle,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: NmdTypography.bodySmall.copyWith(
                                        color: Colors.white.withValues(alpha: 0.42),
                                        fontSize: 12,
                                        height: 1.45,
                                        fontWeight: FontWeight.w400,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 18),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: _FloatingInquiryCta(
                                      onPressed: () => _inquire(context),
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
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = widget.scrollController;
    if (ctrl != null) {
      return AnimatedBuilder(
        animation: ctrl,
        builder: (context, _) {
          final offset = ctrl.hasClients ? ctrl.offset : 0.0;
          return _buildTile(scrollOffset: offset);
        },
      );
    }
    return _buildTile(scrollOffset: 0);
  }
}

class _FloatingInquiryCta extends StatelessWidget {
  const _FloatingInquiryCta({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              onPressed();
            },
            borderRadius: BorderRadius.circular(999),
            child: Ink(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                color: Colors.white.withValues(alpha: 0.1),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.16),
                ),
                boxShadow: [
                  BoxShadow(
                    color: PremiumMarketplaceDesignSystem.brandGlow(
                      PremiumMarketplaceDesignSystem.glowSoft,
                    ),
                    blurRadius: 12,
                    spreadRadius: -4,
                  ),
                ],
              ),
              child: Text(
                'استفسر الآن',
                style: NmdTypography.button.copyWith(
                  color: Colors.white.withValues(alpha: 0.92),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Floating dock CTA for service store pages.
class CinematicServiceDock extends StatelessWidget {
  const CinematicServiceDock({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Positioned(
      left: 22,
      right: 22,
      bottom: bottom + 10,
      child: RepaintBoundary(
        child: ClipRRect(
          borderRadius: PremiumMarketplaceDesignSystem.borderLg,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: SizedBox(
              height: PremiumMarketplaceDesignSystem.dockHeight,
              child: FilledButton(
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  onPressed();
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF134E4A).withValues(alpha: 0.9),
                  shape: RoundedRectangleBorder(
                    borderRadius: PremiumMarketplaceDesignSystem.borderLg,
                  ),
                  elevation: 0,
                ),
                child: Text(
                  'احجز الآن',
                  style: NmdTypography.button.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

typedef ProfessionalServiceListCard = CinematicServicePanel;
