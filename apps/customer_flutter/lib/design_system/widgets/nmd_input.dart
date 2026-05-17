import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';

/// Text field aligned with Now Market form styling (RTL-friendly).
class NmdInput extends StatelessWidget {
  const NmdInput({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.errorText,
    this.prefix,
    this.suffix,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.validator,
    this.maxLines = 1,
    this.enabled = true,
    this.autofocus = false,
    this.inputFormatters,
    this.textDirection,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? errorText;
  final Widget? prefix;
  final Widget? suffix;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final String? Function(String?)? validator;
  final int maxLines;
  final bool enabled;
  final bool autofocus;
  final List<TextInputFormatter>? inputFormatters;
  final TextDirection? textDirection;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      textDirection: TextDirection.rtl,
      children: [
        if (label != null) ...[
          Text(
            label!,
            textAlign: TextAlign.right,
            style: NmdTypography.label.copyWith(color: NmdColors.textSecondary),
          ),
          const SizedBox(height: NmdSpacing.xxs),
        ],
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onFieldSubmitted: onSubmitted,
          validator: validator,
          maxLines: maxLines,
          enabled: enabled,
          autofocus: autofocus,
          inputFormatters: inputFormatters,
          textDirection: textDirection ?? TextDirection.rtl,
          textAlign: TextAlign.right,
          style: NmdTypography.body,
          decoration: InputDecoration(
            hintText: hint,
            errorText: errorText,
            prefixIcon: prefix,
            suffixIcon: suffix,
          ),
        ),
      ],
    );
  }
}
