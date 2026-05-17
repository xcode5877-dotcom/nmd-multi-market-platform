import 'package:flutter/material.dart';

import '../../design_system/theme/nmd_theme.dart';
import 'app_colors.dart';

final class AppTheme {
  AppTheme._();

  /// Delegates to [NmdTheme.light] while preserving legacy shell background.
  static ThemeData get light => NmdTheme.light.copyWith(
        scaffoldBackgroundColor: AppColors.shellTeal,
      );
}
