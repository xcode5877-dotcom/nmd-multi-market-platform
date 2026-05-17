import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import 'nmd_app_header.dart';

enum NmdScaffoldBackground { shell, white, community }

/// Shell scaffold: optional [NmdAppHeader] + content + optional bottom slot.
///
/// Does not include navigation or auth — pass [header] actions via callbacks.
class NmdScaffold extends StatelessWidget {
  const NmdScaffold({
    super.key,
    required this.body,
    this.header,
    this.background = NmdScaffoldBackground.white,
    this.bottomNavigationBar,
    this.extendBodyBehindHeader = false,
    this.resizeToAvoidBottomInset = true,
  });

  final Widget body;
  final NmdAppHeader? header;
  final NmdScaffoldBackground background;
  final Widget? bottomNavigationBar;
  final bool extendBodyBehindHeader;
  final bool resizeToAvoidBottomInset;

  Color get _backgroundColor => switch (background) {
        NmdScaffoldBackground.shell => NmdColors.brandDeep,
        NmdScaffoldBackground.white => NmdColors.surfaceBase,
        NmdScaffoldBackground.community => NmdColors.surfaceCommunity,
      };

  @override
  Widget build(BuildContext context) {
    final contentColor = switch (background) {
      NmdScaffoldBackground.community => NmdColors.surfaceCommunity,
      _ => NmdColors.surfaceBase,
    };

    return Scaffold(
      backgroundColor: _backgroundColor,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      body: Column(
        children: [
          if (header != null && !extendBodyBehindHeader) header!,
          Expanded(
            child: ColoredBox(
              color: header != null ? contentColor : _backgroundColor,
              child: body,
            ),
          ),
        ],
      ),
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}
