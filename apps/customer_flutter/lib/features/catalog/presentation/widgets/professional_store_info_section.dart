import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';

const Color _kProfessionalAccent = Color(0xFF00695C);

/// Premium service-provider block: typography, hours pill, gradient booking CTA with pulse.
class ProfessionalStoreInfoSection extends StatefulWidget {
  const ProfessionalStoreInfoSection({
    super.key,
    required this.aboutPlain,
    required this.openTime,
    required this.closeTime,
    required this.operatingStatus,
    required this.isAdminClosed,
    required this.showPrimaryContact,
    required this.onPrimaryContact,
    this.subtitleTag,
  });

  final String aboutPlain;
  final String openTime;
  final String closeTime;
  final String operatingStatus;
  final bool isAdminClosed;
  final bool showPrimaryContact;
  final VoidCallback onPrimaryContact;

  /// Optional pillar / category label (e.g. «خدمات مهنية»).
  final String? subtitleTag;

  @override
  State<ProfessionalStoreInfoSection> createState() =>
      _ProfessionalStoreInfoSectionState();
}

class _ProfessionalStoreInfoSectionState
    extends State<ProfessionalStoreInfoSection>
    with SingleTickerProviderStateMixin {
  static const int _aboutPreviewChars = 200;
  bool _aboutExpanded = false;

  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  String get _statusLabel {
    if (widget.isAdminClosed) return 'مغلق مؤقتاً من الإدارة';
    switch (widget.operatingStatus) {
      case 'open':
        return 'مفتوح';
      case 'busy':
        return 'مشغول';
      default:
        return 'مغلق';
    }
  }

  Color get _statusDotColor {
    if (widget.isAdminClosed || widget.operatingStatus == 'closed') {
      return const Color(0xFFDC2626);
    }
    if (widget.operatingStatus == 'busy') return const Color(0xFFF59E0B);
    return const Color(0xFF22C55E);
  }

  bool get _needsAboutToggle =>
      widget.aboutPlain.trim().length > _aboutPreviewChars;

  String get _aboutDisplay {
    final t = widget.aboutPlain.trim();
    if (!_needsAboutToggle || _aboutExpanded) return t;
    return '${t.substring(0, _aboutPreviewChars).trim()}…';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFE8EDF2)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 24,
              offset: Offset(0, 10),
            ),
            BoxShadow(
              color: Color(0x08000000),
              blurRadius: 6,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _HoursStatusPill(
                statusLabel: _statusLabel,
                dotColor: _statusDotColor,
                openTime: widget.openTime,
                closeTime: widget.closeTime,
              ),
              if (widget.subtitleTag != null &&
                  widget.subtitleTag!.trim().isNotEmpty) ...[
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _kProfessionalAccent.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: _kProfessionalAccent.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Text(
                      widget.subtitleTag!.trim(),
                      textAlign: TextAlign.right,
                      style: GoogleFonts.cairo(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _kProfessionalAccent,
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Text(
                'عن المكتب',
                textAlign: TextAlign.right,
                style: GoogleFonts.cairo(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.2,
                  color: const Color(0xFF0F172A),
                ),
              ),
              if (widget.aboutPlain.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  _aboutDisplay,
                  textAlign: TextAlign.right,
                  style: GoogleFonts.cairo(
                    fontSize: 15,
                    height: 1.65,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF475569),
                  ),
                ),
                if (_needsAboutToggle) ...[
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () =>
                          setState(() => _aboutExpanded = !_aboutExpanded),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        foregroundColor: _kProfessionalAccent,
                      ),
                      child: Text(
                        _aboutExpanded ? 'عرض أقل' : 'عرض المزيد',
                        style: GoogleFonts.cairo(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
              if (widget.showPrimaryContact) ...[
                const SizedBox(height: 22),
                AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, child) {
                    final t =
                        Curves.easeInOut.transform(_pulseController.value);
                    final glow = 14 + t * 10;
                    return DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primaryTeal
                                .withValues(alpha: 0.35 + t * 0.12),
                            blurRadius: glow,
                            spreadRadius: t * 1.5,
                            offset: const Offset(0, 8),
                          ),
                          BoxShadow(
                            color: AppColors.secondaryTeal
                                .withValues(alpha: 0.12 + t * 0.08),
                            blurRadius: 22 + t * 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: child,
                    );
                  },
                  child: SizedBox(
                    width: double.infinity,
                    height: 58,
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: widget.onPrimaryContact,
                        borderRadius: BorderRadius.circular(20),
                        child: Ink(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            gradient: const LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: [
                                AppColors.shellTeal,
                                AppColors.primaryTeal,
                                AppColors.secondaryTeal,
                              ],
                              stops: [0.0, 0.55, 1.0],
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            textDirection: TextDirection.rtl,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.event_available_rounded,
                                  size: 24, color: Colors.white),
                              const SizedBox(width: 10),
                              Text(
                                'احجز الآن',
                                style: GoogleFonts.cairo(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 18,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HoursStatusPill extends StatelessWidget {
  const _HoursStatusPill({
    required this.statusLabel,
    required this.dotColor,
    required this.openTime,
    required this.closeTime,
  });

  final String statusLabel;
  final Color dotColor;
  final String openTime;
  final String closeTime;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: LinearGradient(
            colors: [
              const Color(0xFFF0FDFA),
              Colors.white.withValues(alpha: 0.96),
            ],
          ),
          border: Border.all(
            color: AppColors.primaryTeal.withValues(alpha: 0.18),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0C000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerRight,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            textDirection: TextDirection.rtl,
            children: [
              Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: dotColor.withValues(alpha: 0.45),
                      blurRadius: 6,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                statusLabel,
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: const Color(0xFF0F172A),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Container(
                  width: 1,
                  height: 16,
                  color: const Color(0xFFE2E8F0),
                ),
              ),
              Icon(
                Icons.schedule_rounded,
                size: 17,
                color: AppColors.primaryTeal.withValues(alpha: 0.9),
              ),
              const SizedBox(width: 6),
              Text(
                'ساعات العمل',
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '$openTime – $closeTime',
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: const Color(0xFF111827),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
