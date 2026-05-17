import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';

/// Premium service-provider block for professional / services stores.
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
    return NmdSemantic.storeStatusLabelAr(
      NmdSemantic.storeStatusFromApi(widget.operatingStatus),
    );
  }

  NmdBadgeTone get _statusTone {
    if (widget.isAdminClosed) return NmdBadgeTone.error;
    return switch (NmdSemantic.storeStatusFromApi(widget.operatingStatus)) {
      NmdStoreStatus.open => NmdBadgeTone.success,
      NmdStoreStatus.busy => NmdBadgeTone.warning,
      _ => NmdBadgeTone.neutral,
    };
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
      padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 16),
      child: NmdCard(
        variant: NmdCardVariant.elevated,
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        borderRadius: NmdRadius.borderLg,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Directionality(
              textDirection: TextDirection.rtl,
              child: Wrap(
                spacing: NmdSpacing.xs,
                runSpacing: NmdSpacing.xs,
                alignment: WrapAlignment.end,
                children: [
                  NmdBadge(label: _statusLabel, tone: _statusTone),
                  NmdChip(
                    label:
                        'ساعات العمل: ${widget.openTime} – ${widget.closeTime}',
                    variant: NmdChipVariant.status,
                  ),
                ],
              ),
            ),
            if (widget.subtitleTag != null &&
                widget.subtitleTag!.trim().isNotEmpty) ...[
              const SizedBox(height: NmdSpacing.sm),
              Align(
                alignment: Alignment.centerRight,
                child: NmdChip(
                  label: widget.subtitleTag!.trim(),
                  variant: NmdChipVariant.filter,
                  selected: true,
                ),
              ),
            ],
            const SizedBox(height: NmdSpacing.md),
            Text(
              'عن المكتب',
              textAlign: TextAlign.right,
              style: NmdTypography.h2,
            ),
            if (widget.aboutPlain.trim().isNotEmpty) ...[
              const SizedBox(height: NmdSpacing.xs),
              Text(
                _aboutDisplay,
                textAlign: TextAlign.right,
                style: NmdTypography.body.copyWith(
                  height: 1.6,
                  color: NmdColors.textSecondary,
                ),
              ),
              if (_needsAboutToggle) ...[
                const SizedBox(height: NmdSpacing.xxs),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () =>
                        setState(() => _aboutExpanded = !_aboutExpanded),
                    child: Text(
                      _aboutExpanded ? 'عرض أقل' : 'عرض المزيد',
                      style: NmdTypography.label.copyWith(
                        color: NmdColors.brandPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ],
            if (widget.showPrimaryContact) ...[
              const SizedBox(height: NmdSpacing.md),
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  final t = Curves.easeInOut.transform(_pulseController.value);
                  return DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: NmdRadius.borderMd,
                      boxShadow: NmdShadows.brandGlow(alpha: 0.2 + t * 0.12),
                    ),
                    child: child,
                  );
                },
                child: NmdButton(
                  label: 'احجز الآن',
                  icon: const Icon(
                    Icons.event_available_rounded,
                    size: 22,
                    color: NmdColors.textOnBrand,
                  ),
                  onPressed: widget.onPrimaryContact,
                  size: NmdButtonSize.large,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
