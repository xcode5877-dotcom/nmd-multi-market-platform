import 'package:flutter/material.dart';

import '../../design_system/design_system.dart';
import 'open_customer_support.dart';

/// Compact labeled Help action for customer headers (no floating overlay).
class HeaderSupportAction extends StatelessWidget {
  const HeaderSupportAction({
    super.key,
    this.source = 'header',
    this.iconColor = NmdColors.textOnBrand,
  });

  final String source;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      key: const Key('header_support_action'),
      style: NmdAppHeader.plainIconStyle(foreground: iconColor),
      tooltip: 'المساعدة',
      onPressed: () => openCustomerSupport(context, source: source),
      icon: Icon(
        Icons.headset_mic_outlined,
        size: NmdSizes.iconMd,
        color: iconColor,
      ),
    );
  }
}
