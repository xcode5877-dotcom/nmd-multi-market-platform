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
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../application/service_lead_actions.dart';
import '../../data/tenant_contact_info.dart';

// ---------------------------------------------------------------------------
// Phase 7.1 — Premium minimal services (calm, readable, trustworthy)
// ---------------------------------------------------------------------------

/// Clean store hero + stacked service panels.
class ImmersiveLuxuryStoreExperience {
  ImmersiveLuxuryStoreExperience._();

  static const double heroHeightRatio = 0.35;

  static List<Widget> buildSlivers({
    required ScrollController scrollController,
    required String storeName,
    required String bannerUrl,
    required String aboutPlain,
    required List<Product> products,
    required String marketSlug,
    required String storeId,
    required String tenantIdForLeads,
    required TenantContactInfo officeContact,
    VoidCallback? onBeginExperience,
  }) {
    return [
      SliverToBoxAdapter(
        child: _MinimalStoreHero(
          storeName: storeName,
          bannerUrl: bannerUrl,
          aboutPlain: aboutPlain,
          onBook: () {
            HapticFeedback.lightImpact();
            if (onBeginExperience != null) {
              onBeginExperience();
              return;
            }
            if (!scrollController.hasClients) return;
            scrollController.animateTo(
              280,
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeOutCubic,
            );
          },
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
      else
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
          sliver: SliverList.separated(
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(height: 20),
            itemBuilder: (context, index) {
              final product = products[index];
              return _PremiumServicePanel(
                product: product,
                marketSlug: marketSlug,
                storeId: storeId,
                tenantIdForLeads: tenantIdForLeads,
                officeContact: officeContact,
              );
            },
          ),
        ),
    ];
  }
}

class _MinimalStoreHero extends StatelessWidget {
  const _MinimalStoreHero({
    required this.storeName,
    required this.bannerUrl,
    required this.aboutPlain,
    required this.onBook,
  });

  final String storeName;
  final String bannerUrl;
  final String aboutPlain;
  final VoidCallback onBook;

  String get _subtitle {
    final t = aboutPlain.trim();
    if (t.isEmpty) return 'Luxury Wellness';
    final line = t.split('\n').first.trim();
    return line.length > 48 ? '${line.substring(0, 46)}…' : line;
  }

  @override
  Widget build(BuildContext context) {
    final heroH = MediaQuery.sizeOf(context).height * ImmersiveLuxuryStoreExperience.heroHeightRatio;

    return SizedBox(
      height: heroH,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (bannerUrl.isNotEmpty)
            CachedNetworkImage(
              imageUrl: resolveImageUrl(bannerUrl),
              fit: BoxFit.cover,
              alignment: Alignment.center,
              placeholder: (_, __) => const _CalmFallback(),
              errorWidget: (_, __, ___) => const _CalmFallback(),
            )
          else
            const _CalmFallback(),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.18),
                  Colors.black.withValues(alpha: 0.52),
                  Colors.black.withValues(alpha: 0.72),
                ],
                stops: const [0.0, 0.55, 1.0],
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
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
                      style: NmdTypography.display.copyWith(
                        color: Colors.white.withValues(alpha: 0.96),
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        height: 1.12,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: NmdTypography.body.copyWith(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _MinimalGlassButton(
                      label: 'احجز الآن',
                      onPressed: onBook,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PremiumServicePanel extends StatefulWidget {
  const _PremiumServicePanel({
    required this.product,
    required this.marketSlug,
    required this.storeId,
    required this.tenantIdForLeads,
    required this.officeContact,
  });

  final Product product;
  final String marketSlug;
  final String storeId;
  final String tenantIdForLeads;
  final TenantContactInfo officeContact;

  @override
  State<_PremiumServicePanel> createState() => _PremiumServicePanelState();
}

class _PremiumServicePanelState extends State<_PremiumServicePanel> {
  bool _pressed = false;

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

  void _openDetail() {
    context.push(
      '/market/${widget.marketSlug}/store/${widget.storeId}/product/${widget.product.id}',
    );
  }

  String get _subtitle {
    final d = widget.product.description.trim();
    if (d.isEmpty) return 'خدمة مميزة';
    final line = d.split('\n').first.trim();
    return line.length > 72 ? '${line.substring(0, 70)}…' : line;
  }

  @override
  Widget build(BuildContext context) {
    final url = widget.product.imageUrl.trim();

    return AnimatedScale(
      scale: _pressed ? 0.985 : 1.0,
      duration: const Duration(milliseconds: 120),
      curve: Curves.easeOutCubic,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _openDetail,
          onHighlightChanged: (v) => setState(() => _pressed = v),
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.18),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(16),
                  ),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: url.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: resolveImageUrl(url),
                            fit: BoxFit.cover,
                            placeholder: (_, __) => const _CalmFallback(),
                            errorWidget: (_, __, ___) => const _CalmFallback(),
                          )
                        : const _CalmFallback(),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                  child: Directionality(
                    textDirection: TextDirection.rtl,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.h2.copyWith(
                            color: Colors.white.withValues(alpha: 0.94),
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.body.copyWith(
                            color: Colors.white.withValues(alpha: 0.72),
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Align(
                          alignment: Alignment.centerRight,
                          child: _MinimalGlassButton(
                            label: 'احجز',
                            compact: true,
                            onPressed: _book,
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

class _MinimalGlassButton extends StatelessWidget {
  const _MinimalGlassButton({
    required this.label,
    required this.onPressed,
    this.compact = false,
  });

  final String label;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(999),
            child: Ink(
              height: compact ? 36 : 42,
              padding: EdgeInsets.symmetric(horizontal: compact ? 18 : 24),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                color: Colors.white.withValues(alpha: 0.1),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.16),
                ),
              ),
              child: Center(
                child: Text(
                  label,
                  style: NmdTypography.button.copyWith(
                    color: Colors.white.withValues(alpha: 0.92),
                    fontSize: compact ? 13 : 14,
                    fontWeight: FontWeight.w600,
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

class _CalmFallback extends StatelessWidget {
  const _CalmFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Color(0xFF1F2937), Color(0xFF111827)],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Legacy exports — product detail pages
// ---------------------------------------------------------------------------

/// Compact glass booking pill for product detail pages.
class CinematicHeroBookPill extends StatelessWidget {
  const CinematicHeroBookPill({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return _MinimalGlassButton(label: 'احجز', onPressed: onPressed);
  }
}

class CinematicServiceDock extends StatelessWidget {
  const CinematicServiceDock({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Positioned(
      right: 20,
      bottom: bottom + 16,
      child: CinematicHeroBookPill(onPressed: onPressed),
    );
  }
}
