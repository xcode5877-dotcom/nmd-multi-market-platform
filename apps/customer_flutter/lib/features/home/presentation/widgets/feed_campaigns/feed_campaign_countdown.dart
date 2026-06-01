import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';

class FeedCampaignCountdownChip extends StatefulWidget {
  const FeedCampaignCountdownChip({
    super.key,
    required this.endsAt,
    this.onDarkBackground = true,
  });

  final DateTime endsAt;
  final bool onDarkBackground;

  @override
  State<FeedCampaignCountdownChip> createState() =>
      _FeedCampaignCountdownChipState();
}

class _FeedCampaignCountdownChipState extends State<FeedCampaignCountdownChip> {
  Timer? _timer;
  Duration _remaining = Duration.zero;

  @override
  void initState() {
    super.initState();
    _tick();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _tick());
  }

  void _tick() {
    final diff = widget.endsAt.difference(DateTime.now());
    if (!mounted) return;
    setState(() => _remaining = diff.isNegative ? Duration.zero : diff);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_remaining <= Duration.zero) return const SizedBox.shrink();

    final h = _remaining.inHours;
    final m = _remaining.inMinutes.remainder(60);
    final label = h > 0 ? '$hس $mد' : '$mد';

    final fg = widget.onDarkBackground
        ? Colors.white
        : NmdColors.brandPrimary;
    final bg = widget.onDarkBackground
        ? Colors.white.withValues(alpha: 0.22)
        : NmdColors.tintAliveSoft;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        'ينتهي خلال $label',
        style: NmdTypography.micro.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    );
  }
}
