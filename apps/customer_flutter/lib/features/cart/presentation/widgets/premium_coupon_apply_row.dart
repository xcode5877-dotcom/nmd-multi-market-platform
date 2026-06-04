import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../design_system/design_system.dart';

enum _CouponApplyState { idle, loading, success, error }

/// Premium coupon input + apply with success/error micro-interactions.
class PremiumCouponApplyRow extends StatefulWidget {
  const PremiumCouponApplyRow({
    super.key,
    required this.controller,
    required this.loading,
    required this.error,
    required this.appliedCode,
    required this.onApply,
  });

  final TextEditingController controller;
  final bool loading;
  final String? error;
  final String? appliedCode;
  final VoidCallback onApply;

  @override
  State<PremiumCouponApplyRow> createState() => _PremiumCouponApplyRowState();
}

class _PremiumCouponApplyRowState extends State<PremiumCouponApplyRow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shakeCtrl;
  String? _lastAppliedCode;
  bool _showSuccessPill = false;

  @override
  void initState() {
    super.initState();
    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _lastAppliedCode = widget.appliedCode;
    if (widget.appliedCode != null) _showSuccessPill = true;
  }

  @override
  void didUpdateWidget(PremiumCouponApplyRow oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.error != null && widget.error != oldWidget.error) {
      _shakeCtrl.forward(from: 0);
      HapticFeedback.mediumImpact();
    }

    if (widget.appliedCode != null &&
        widget.appliedCode != _lastAppliedCode &&
        widget.error == null) {
      _lastAppliedCode = widget.appliedCode;
      setState(() => _showSuccessPill = true);
      HapticFeedback.lightImpact();
    }

    if (widget.appliedCode == null && oldWidget.appliedCode != null) {
      setState(() => _showSuccessPill = false);
    }
  }

  @override
  void dispose() {
    _shakeCtrl.dispose();
    super.dispose();
  }

  _CouponApplyState get _state {
    if (widget.loading) return _CouponApplyState.loading;
    if (widget.appliedCode != null && widget.error == null) {
      return _CouponApplyState.success;
    }
    if (widget.error != null) return _CouponApplyState.error;
    return _CouponApplyState.idle;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedBuilder(
          animation: _shakeCtrl,
          builder: (context, child) {
            final t = _shakeCtrl.value;
            final dx = math.sin(t * math.pi * 5) * 4 * (1 - t);
            return Transform.translate(offset: Offset(dx, 0), child: child);
          },
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            textDirection: TextDirection.rtl,
            children: [
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  textCapitalization: TextCapitalization.characters,
                  style: NmdTypography.label.copyWith(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'أدخل كود الخصم',
                    hintStyle: NmdTypography.micro.copyWith(
                      color: NmdColors.textTertiary,
                    ),
                    filled: true,
                    fillColor: NmdColors.surfaceMuted.withValues(alpha: 0.7),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: NmdSpacing.sm,
                      vertical: 11,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(11),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(11),
                      borderSide: BorderSide(
                        color: _state == _CouponApplyState.error
                            ? NmdColors.error.withValues(alpha: 0.35)
                            : Colors.transparent,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(11),
                      borderSide: BorderSide(
                        color: NmdColors.brandPrimary.withValues(alpha: 0.35),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: NmdSpacing.xs),
              _ApplyButton(
                state: _state,
                onPressed: widget.loading ? null : widget.onApply,
              ),
            ],
          ),
        ),
        if (widget.error != null) ...[
          const SizedBox(height: 4),
          Text(
            widget.error!,
            style: NmdTypography.micro.copyWith(
              color: NmdColors.error,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        AnimatedSize(
          duration: NmdMotion.fast,
          curve: NmdMotion.standard,
          child: _showSuccessPill && widget.appliedCode != null
              ? Padding(
                  padding: const EdgeInsets.only(top: NmdSpacing.xs),
                  child: _SuccessPill(code: widget.appliedCode!),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }
}

class _ApplyButton extends StatelessWidget {
  const _ApplyButton({required this.state, required this.onPressed});

  final _CouponApplyState state;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: NmdMotion.fast,
      switchInCurve: NmdMotion.standard,
      child: switch (state) {
        _CouponApplyState.loading => _buttonShell(
            key: const ValueKey('loading'),
            child: const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        _CouponApplyState.success => _buttonShell(
            key: const ValueKey('success'),
            color: NmdColors.success,
            child: const Icon(
              Icons.check_rounded,
              color: NmdColors.textOnBrand,
              size: 20,
            ),
          ),
        _ => _buttonShell(
            key: const ValueKey('idle'),
            onTap: onPressed,
            child: Text(
              'تطبيق',
              style: NmdTypography.button.copyWith(fontSize: 12),
            ),
          ),
      },
    );
  }

  Widget _buttonShell({
    required Key key,
    required Widget child,
    VoidCallback? onTap,
    Color? color,
  }) {
    return Material(
      key: key,
      color: color ?? NmdColors.brandPrimary,
      borderRadius: BorderRadius.circular(11),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(11),
        child: SizedBox(
          width: 64,
          height: 44,
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _SuccessPill extends StatelessWidget {
  const _SuccessPill({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: 1,
      duration: NmdMotion.fast,
      curve: NmdMotion.bounce,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: NmdColors.successSoft,
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          textDirection: TextDirection.rtl,
          children: [
            const Icon(
              Icons.check_circle_rounded,
              size: 16,
              color: NmdColors.success,
            ),
            const SizedBox(width: 6),
            Text(
              'تم تطبيق الخصم بنجاح · $code',
              style: NmdTypography.micro.copyWith(
                color: NmdColors.success,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
