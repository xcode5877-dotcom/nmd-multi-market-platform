import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../app/theme/app_colors.dart';

/// Shared text field styling (checkout / profile parity).
class NmdTextField extends StatelessWidget {
  const NmdTextField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.enabled = true,
    this.readOnly = false,
    this.keyboardType,
    this.obscureText = false,
    this.validator,
    this.onChanged,
    this.onTap,
    this.requiredField = false,
    this.maxLines = 1,
    this.suffixIcon,
    this.prefixIcon,
    this.autovalidateMode,
    this.inputFormatters,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final bool enabled;
  final bool readOnly;
  final TextInputType? keyboardType;
  final bool obscureText;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final bool requiredField;
  final int maxLines;
  final Widget? suffixIcon;
  final Widget? prefixIcon;
  final AutovalidateMode? autovalidateMode;
  final List<TextInputFormatter>? inputFormatters;

  String get _labelText => requiredField ? '$label *' : label;

  InputDecoration _decoration(String? errorText) {
    return InputDecoration(
      labelText: _labelText,
      hintText: hint,
      errorText: errorText,
      labelStyle: GoogleFonts.cairo(fontSize: 13),
      hintStyle:
          GoogleFonts.cairo(color: const Color(0xFF94A3B8), fontSize: 13),
      filled: true,
      fillColor: enabled ? const Color(0xFFF8FAFC) : const Color(0xFFF1F5F9),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryTeal, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.red.shade400, width: 1),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.red.shade400, width: 1.2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      suffixIcon: suffixIcon,
      prefixIcon: prefixIcon,
    );
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      enabled: enabled,
      readOnly: readOnly,
      keyboardType: keyboardType,
      obscureText: obscureText,
      maxLines: maxLines,
      onChanged: onChanged,
      onTap: onTap,
      validator: validator,
      autovalidateMode: autovalidateMode ?? AutovalidateMode.onUserInteraction,
      inputFormatters: inputFormatters,
      style: GoogleFonts.cairo(fontSize: 15, color: AppColors.textPrimary),
      decoration: _decoration(null),
    );
  }
}
