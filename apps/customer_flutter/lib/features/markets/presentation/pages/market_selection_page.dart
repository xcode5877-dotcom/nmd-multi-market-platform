import 'dart:ui' show ImageFilter;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../design_system/design_system.dart';
import '../../../../api/market_images.dart';
import '../../../../api/markets_picker_load_result.dart';
import '../../../../api/models/market.dart';
import '../../../../api/storefront_api.dart';
import '../../../../widgets/global_nmd_header.dart';
import '../../../../widgets/nmd_bottom_nav.dart';

/// Pixel parity with web market picker (`MarketsPickerPage.tsx` + mobile header).
class MarketSelectionPage extends StatefulWidget {
  const MarketSelectionPage({super.key});

  @override
  State<MarketSelectionPage> createState() => _MarketSelectionPageState();
}

class _MarketSelectionPageState extends State<MarketSelectionPage> {
  late Future<MarketsPickerLoadResult> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<MarketsPickerLoadResult> _load() async {
    final api = StorefrontApi(context.read<Dio>());
    return api.loadMarketsForPickerScreen();
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('تم النسخ',
            style: GoogleFonts.cairo(fontWeight: FontWeight.w600)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _onBottomNav(BuildContext context, MainTab tab) {
    if (tab == MainTab.home) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'اختر سوقاً للمتابعة',
          style: GoogleFonts.cairo(fontWeight: FontWeight.w600),
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      bottomNavigationBar: NmdBottomNav(
        currentTab: MainTab.home,
        onTabSelected: (tab) => _onBottomNav(context, tab),
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0.06, -0.35),
            radius: 1.35,
            colors: [
              Color(0xFFE6FFFA),
              Color(0xFFF0FDFA),
              Color(0xFFF8FAFC),
              Color(0xFFFFFFFF),
            ],
            stops: [0.0, 0.35, 0.65, 1.0],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GlobalNmdHeader(
              marketSlug: '',
              showLeading: false,
              showCart: false,
              showProfile: false,
              centerTitle: SvgPicture.asset(
                'assets/branding/logo-nowmarket.svg',
                height: 28,
              ),
            ),
            Expanded(
              child: FutureBuilder<MarketsPickerLoadResult>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Padding(
                      padding: EdgeInsets.all(NmdSpacing.screenHorizontal),
                      child: _MarketPickerShimmer(),
                    );
                  }
                  if (snap.hasError) {
                    return _MarketsDiagnosticBody(
                      statusCode: null,
                      rawResponse: snap.error.toString(),
                      errorMessage: snap.error.toString(),
                      title: 'تعذر التحميل',
                      onCopy: () =>
                          _copyToClipboard(context, snap.error.toString()),
                    );
                  }
                  final result = snap.data!;
                  if (result.markets.isEmpty) {
                    return _MarketsDiagnosticBody(
                      statusCode: result.statusCode,
                      rawResponse: result.rawResponse,
                      errorMessage: result.errorMessage,
                      title: 'تعذر التحميل',
                      onCopy: () => _copyToClipboard(
                          context, result.diagnosticClipboardText),
                    );
                  }
                  if (result.markets.length == 1) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (!context.mounted) return;
                      context.go('/market/${result.markets.first.slug}');
                    });
                    return const Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.6,
                          color: AppColors.primaryTeal,
                        ),
                      ),
                    );
                  }
                  return SingleChildScrollView(
                    primary: true,
                    padding: const EdgeInsets.only(bottom: 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (result.showDiagnostics)
                          _DiagnosticHintCard(
                            result: result,
                            onCopy: () => _copyToClipboard(
                                context, result.diagnosticClipboardText),
                            onShowFull: () => _showRawDialog(context, result),
                          ),
                        _MarketGrid(markets: result.markets),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRawDialog(BuildContext context, MarketsPickerLoadResult result) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('استجابة الخادم',
            style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
        content: SizedBox(
          width: double.maxFinite,
          height: MediaQuery.sizeOf(ctx).height * 0.5,
          child: SingleChildScrollView(
            primary: false,
            child: SelectableText(
              result.diagnosticClipboardText,
              style: GoogleFonts.cairo(
                  fontSize: 11, height: 1.35, color: const Color(0xFF1E293B)),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('إغلاق',
                style: GoogleFonts.cairo(fontWeight: FontWeight.w600)),
          ),
          FilledButton(
            onPressed: () {
              _copyToClipboard(context, result.diagnosticClipboardText);
              Navigator.pop(ctx);
            },
            child: Text('نسخ الكل',
                style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

class _DiagnosticHintCard extends StatelessWidget {
  const _DiagnosticHintCard({
    required this.result,
    required this.onCopy,
    required this.onShowFull,
  });

  final MarketsPickerLoadResult result;
  final VoidCallback onCopy;
  final VoidCallback onShowFull;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Card(
        color: const Color(0xFFFFF7ED),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0xFFFDBA74)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'استجابة الخادم بدون أسواق صالحة — عرض التفاصيل للتشخيص',
                style: GoogleFonts.cairo(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF9A3412)),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.end,
                children: [
                  OutlinedButton.icon(
                    onPressed: onShowFull,
                    icon: const Icon(Icons.open_in_full, size: 18),
                    label: Text('عرض كامل',
                        style: GoogleFonts.cairo(
                            fontWeight: FontWeight.w600, fontSize: 12)),
                  ),
                  FilledButton.icon(
                    onPressed: onCopy,
                    icon: const Icon(Icons.copy, size: 18),
                    label: Text('نسخ للحافظة',
                        style: GoogleFonts.cairo(
                            fontWeight: FontWeight.w700, fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MarketsDiagnosticBody extends StatelessWidget {
  const _MarketsDiagnosticBody({
    required this.title,
    required this.onCopy,
    this.statusCode,
    this.rawResponse,
    this.errorMessage,
  });

  final String title;
  final VoidCallback onCopy;
  final int? statusCode;
  final String? rawResponse;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    final fullText = StringBuffer()
      ..writeln('HTTP status: ${statusCode ?? '—'}')
      ..writeln();
    if (errorMessage != null && errorMessage!.isNotEmpty) {
      fullText.writeln('Error: $errorMessage');
      fullText.writeln();
    }
    fullText.writeln('RAW_RESPONSE:');
    fullText.write(rawResponse ?? '(null)');
    final text = fullText.toString();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: GoogleFonts.cairo(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: const Color(0xFFDC2626),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Status: ${statusCode ?? '—'}',
            textAlign: TextAlign.center,
            style: GoogleFonts.cairo(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Scrollbar(
                thumbVisibility: true,
                child: SingleChildScrollView(
                  primary: true,
                  child: SelectableText(
                    text,
                    style: GoogleFonts.cairo(
                      fontSize: 11,
                      height: 1.35,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onCopy,
            icon: const Icon(Icons.copy, size: 20),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primaryTeal,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            label: Text('نسخ إلى الحافظة',
                style: GoogleFonts.cairo(
                    fontWeight: FontWeight.w700, fontSize: 14)),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

/// Premium title + staggered glass market cells (Rewards shell parity via [NmdBottomNav] + [GlobalNmdHeader]).
class _MarketGrid extends StatelessWidget {
  const _MarketGrid({required this.markets});

  final List<Market> markets;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const _DestinationTitle(),
          const SizedBox(height: 20),
          AnimationLimiter(
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: markets.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 14,
                mainAxisSpacing: 16,
                childAspectRatio: 0.78,
              ),
              itemBuilder: (context, index) {
                final market = markets[index];
                return AnimationConfiguration.staggeredGrid(
                  position: index,
                  columnCount: 2,
                  duration: const Duration(milliseconds: 420),
                  delay: const Duration(milliseconds: 60),
                  child: SlideAnimation(
                    verticalOffset: 56,
                    curve: Curves.easeOutCubic,
                    child: FadeInAnimation(
                      child: _MarketGlassCell(market: market),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _DestinationTitle extends StatelessWidget {
  const _DestinationTitle();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment.centerRight,
            end: Alignment.centerLeft,
            colors: [
              AppColors.primaryTeal,
              AppColors.secondaryTeal,
              const Color(0xFF0D9488),
            ],
          ).createShader(bounds),
          child: Text(
            'اختر وجهتك',
            textAlign: TextAlign.center,
            style: GoogleFonts.cairo(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w900,
              height: 1.15,
              letterSpacing: -0.3,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Container(
          height: 3,
          width: 112,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: LinearGradient(
              colors: [
                AppColors.secondaryTeal.withValues(alpha: 0.25),
                AppColors.primaryTeal,
                AppColors.secondaryTeal.withValues(alpha: 0.35),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primaryTeal.withValues(alpha: 0.25),
                blurRadius: 12,
                offset: const Offset(0, 2),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MarketGlassCell extends StatefulWidget {
  const _MarketGlassCell({required this.market});

  final Market market;

  @override
  State<_MarketGlassCell> createState() => _MarketGlassCellState();
}

class _MarketGlassCellState extends State<_MarketGlassCell>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  late final Animation<double> _pulseScale;
  double _pressT = 0;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
    _pulseScale = Tween<double>(begin: 0.985, end: 1.025).animate(
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final url = getMarketDisplayImageUrl(widget.market);
    return AnimatedScale(
      scale: _pressT > 0 ? 1.05 : 1.0,
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOutCubic,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTapDown: (_) => setState(() => _pressT = 1),
          onTapCancel: () => setState(() => _pressT = 0),
          onTapUp: (_) => setState(() => _pressT = 0),
          onTap: () => context.push('/market/${widget.market.slug}'),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.72),
                    width: 1.2,
                  ),
                  gradient: LinearGradient(
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                    colors: [
                      Colors.white.withValues(alpha: 0.55),
                      Colors.white.withValues(alpha: 0.22),
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryTeal.withValues(alpha: 0.12),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedBuilder(
                      animation: _pulseScale,
                      builder: (context, _) {
                        return Transform.scale(
                          scale: _pulseScale.value,
                          child: Container(
                            width: 104,
                            height: 104,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.primaryTeal
                                    .withValues(alpha: 0.35),
                                width: 2,
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x18000000),
                                  blurRadius: 12,
                                  offset: Offset(0, 6),
                                ),
                              ],
                            ),
                            padding: const EdgeInsets.all(3),
                            child: ClipOval(
                              child: Image.network(
                                url,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    _NetworkErrorPlaceholder(),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    Text(
                      widget.market.name,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.cairo(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                        height: 1.25,
                      ),
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

class _NetworkErrorPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFEDF4F3),
      child: Center(
        child: SvgPicture.asset(
          'assets/branding/logo-nowmarket.svg',
          width: 56,
          height: 56,
        ),
      ),
    );
  }
}

class _MarketPickerShimmer extends StatelessWidget {
  const _MarketPickerShimmer();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 0.92,
      ),
      itemCount: 4,
      itemBuilder: (_, __) => Shimmer.fromColors(
        baseColor: NmdColors.borderSubtle,
        highlightColor: NmdColors.surfaceBase,
        child: Container(
          decoration: BoxDecoration(
            color: NmdColors.borderSubtle,
            borderRadius: NmdRadius.borderMd,
          ),
        ),
      ),
    );
  }
}
