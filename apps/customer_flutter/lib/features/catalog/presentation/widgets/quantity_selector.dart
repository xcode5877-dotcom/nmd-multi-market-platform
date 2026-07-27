import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../design_system/design_system.dart';
import '../../../../measurement/measurement.dart';

/// Max chips before relying on ± stepper for remaining range.
/// Documented threshold: step×options would explode (e.g. 0.05→100 kg).
const int kMeasurementChipCap = 12;

/// Measurement-aware quantity control.
/// PIECE/PACKAGE: ± stepper (min 44px taps when not compact).
/// WEIGHT/VOLUME: bounded chips + ± stepper so max is always reachable.
class QuantitySelector extends StatelessWidget {
  const QuantitySelector({
    super.key,
    required this.measurement,
    required this.value,
    required this.onChanged,
    this.compact = false,
  });

  final ProductMeasurement measurement;
  final String value;
  final ValueChanged<String> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (measurement.isWeighted) {
      return _WeightVolumeSelector(
        measurement: measurement,
        value: value,
        onChanged: onChanged,
        compact: compact,
      );
    }
    return _PieceStepper(
      measurement: measurement,
      value: value,
      onChanged: onChanged,
      compact: compact,
    );
  }
}

class _PieceStepper extends StatelessWidget {
  const _PieceStepper({
    required this.measurement,
    required this.value,
    required this.onChanged,
    required this.compact,
  });

  final ProductMeasurement measurement;
  final String value;
  final ValueChanged<String> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final label = formatQuantityFromMeasurement(value, measurement);
    final prev = previousQuantity(measurement, value);
    final next = nextQuantity(measurement, value);
    final size = compact ? 40.0 : 44.0;

    return Semantics(
      label: 'الكمية $label',
      child: Container(
        decoration: BoxDecoration(
          color: NmdColors.surfaceMuted.withValues(alpha: 0.85),
          borderRadius: NmdRadius.borderPill,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          textDirection: TextDirection.rtl,
          children: [
            _iconBtn(
              icon: Icons.remove_rounded,
              enabled: prev != null,
              size: size,
              compact: compact,
              onTap: prev == null
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      onChanged(prev);
                    },
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 12),
              child: Text(
                label,
                style: NmdTypography.label.copyWith(
                  fontSize: compact ? 13 : 15,
                  color: NmdColors.brandPrimary,
                ),
              ),
            ),
            _iconBtn(
              icon: Icons.add_rounded,
              enabled: next != null,
              size: size,
              compact: compact,
              onTap: next == null
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      onChanged(next);
                    },
            ),
          ],
        ),
      ),
    );
  }
}

class _WeightVolumeSelector extends StatelessWidget {
  const _WeightVolumeSelector({
    required this.measurement,
    required this.value,
    required this.onChanged,
    required this.compact,
  });

  final ProductMeasurement measurement;
  final String value;
  final ValueChanged<String> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final options = buildQuantityOptions(
      measurement,
      maxOptions: kMeasurementChipCap,
    );
    final labels = quantityChipLabels(measurement, options);
    final normalized =
        coerceMeasurementDecimalString(value, measurement.minimumQuantity);
    final label = formatQuantityFromMeasurement(normalized, measurement);
    final prev = previousQuantity(measurement, normalized);
    final next = nextQuantity(measurement, normalized);
    final size = compact ? 40.0 : 44.0;
    final inChipList = options.contains(normalized);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          label: 'اختر الكمية $label',
          child: SizedBox(
            height: compact ? 40 : 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              reverse: true,
              itemCount: options.length,
              separatorBuilder: (_, __) => SizedBox(width: compact ? 6 : 8),
              itemBuilder: (context, i) {
                final selected = options[i] == normalized;
                return Semantics(
                  button: true,
                  selected: selected,
                  label: labels[i],
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        onChanged(options[i]);
                      },
                      borderRadius: NmdRadius.borderPill,
                      child: Ink(
                        padding: EdgeInsets.symmetric(
                          horizontal: compact ? 12 : 14,
                          vertical: compact ? 8 : 10,
                        ),
                        decoration: BoxDecoration(
                          color: selected
                              ? NmdColors.brandPrimary.withValues(alpha: 0.12)
                              : NmdColors.surfaceMuted,
                          borderRadius: NmdRadius.borderPill,
                          border: Border.all(
                            color: selected
                                ? NmdColors.brandPrimary
                                : NmdColors.borderSubtle,
                          ),
                        ),
                        child: Text(
                          labels[i],
                          style: NmdTypography.label.copyWith(
                            fontSize: compact ? 12 : 13,
                            fontWeight:
                                selected ? FontWeight.w800 : FontWeight.w600,
                            color: selected
                                ? NmdColors.brandPrimary
                                : NmdColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          textDirection: TextDirection.rtl,
          children: [
            _iconBtn(
              icon: Icons.remove_rounded,
              enabled: prev != null,
              size: size,
              compact: compact,
              onTap: prev == null
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      onChanged(prev);
                    },
            ),
            Expanded(
              child: Text(
                inChipList ? label : '$label (مخصص)',
                textAlign: TextAlign.center,
                style: NmdTypography.label.copyWith(
                  fontSize: 14,
                  color: NmdColors.brandPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            _iconBtn(
              icon: Icons.add_rounded,
              enabled: next != null,
              size: size,
              compact: compact,
              onTap: next == null
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      onChanged(next);
                    },
            ),
          ],
        ),
      ],
    );
  }
}

Widget _iconBtn({
  required IconData icon,
  required bool enabled,
  required double size,
  required bool compact,
  required VoidCallback? onTap,
}) {
  return Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: NmdRadius.borderPill,
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(
          icon,
          size: compact ? 18 : 22,
          color: enabled
              ? NmdColors.brandPrimary
              : NmdColors.textSecondary.withValues(alpha: 0.4),
        ),
      ),
    ),
  );
}
