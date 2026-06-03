import 'dart:async';
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../api/api_base.dart';
import '../../../../api/resolve_image_url.dart';
import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../core/network/token_storage.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import 'contest_celebration_overlay.dart';

final class ContestSessionMemory {
  static final Set<String> _closedOrSubmittedContestIds = <String>{};

  static bool isDismissed(String contestId) =>
      _closedOrSubmittedContestIds.contains(contestId);

  static void dismiss(String contestId) {
    _closedOrSubmittedContestIds.add(contestId);
  }
}

/// In-memory cache of `GET /contest/me` for the current app session so revisiting
/// Home does not repeat the request. Invalidated when the customer token changes.
final class ContestParticipationSessionCache {
  ContestParticipationSessionCache._();

  static String? _tokenKey;
  static Set<String>? _joinedContestIds;

  static void syncTokenKey(String? token) {
    final key = (token == null || token.isEmpty)
        ? null
        : '${token.length}_${token.hashCode}';
    if (key != _tokenKey) {
      _tokenKey = key;
      _joinedContestIds = null;
    }
  }

  static bool get isLoaded => _joinedContestIds != null;

  static void seedFromParticipations(List<Map<String, dynamic>> rows) {
    _joinedContestIds = rows
        .map((p) => (p['contestId']?.toString() ?? '').trim())
        .where((id) => id.isNotEmpty)
        .toSet();
  }

  static bool hasJoined(String contestId) {
    final id = contestId.trim();
    if (id.isEmpty || _joinedContestIds == null) return false;
    return _joinedContestIds!.contains(id);
  }

  static void markJoined(String contestId) {
    final id = contestId.trim();
    if (id.isEmpty) return;
    _joinedContestIds ??= <String>{};
    _joinedContestIds!.add(id);
  }
}

class ActiveContestVm {
  const ActiveContestVm({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.isPrediction,
    required this.options,
    required this.teamAName,
    required this.teamBName,
    this.bannerImageUrl,
    this.expiresAtRaw,
    this.coinsCost = 0,
    this.participated = false,
    this.participationStatus,
  });

  final String id;
  final String title;
  final String description;
  final String type;
  final bool isPrediction;
  final List<Map<String, String>> options;
  final String teamAName;
  final String teamBName;
  final int coinsCost;
  final bool participated;
  final String? participationStatus;

  /// Resolved for display; visibility follows server (no client-side expiry filter).
  final String? bannerImageUrl;
  final String? expiresAtRaw;

  bool get isQuickJoin =>
      !isPrediction &&
      options.isEmpty &&
      (type.toUpperCase() == 'QUICK_JOIN' || type.toUpperCase() == 'JOIN');

  factory ActiveContestVm.fromJson(Map<String, dynamic> json) {
    final options = ((json['options'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => <String, String>{
              'id': e['id']?.toString() ?? '',
              'label': e['label']?.toString() ?? '',
            })
        .where((e) => e['id']!.isNotEmpty || e['label']!.isNotEmpty)
        .toList();
    final banner = _parseContestBannerUrl(json);
    final exp = json['expiresAt']?.toString().trim();
    return ActiveContestVm(
      id: json['id']?.toString() ?? '',
      title: (json['title']?.toString() ?? '').trim(),
      description: (json['description']?.toString() ?? '').trim(),
      type: (json['type']?.toString() ?? '').trim(),
      isPrediction: json['isPrediction'] == true,
      options: options,
      teamAName: (json['teamAName']?.toString() ?? 'الفريق أ').trim(),
      teamBName: (json['teamBName']?.toString() ?? 'الفريق ب').trim(),
      bannerImageUrl:
          banner != null && banner.isNotEmpty ? resolveImageUrl(banner) : null,
      expiresAtRaw: (exp != null && exp.isNotEmpty) ? exp : null,
      coinsCost: (json['coinsCost'] as num?)?.toInt() ??
          (json['coins_cost'] as num?)?.toInt() ??
          0,
      participated: json['participated'] == true,
      participationStatus: json['participationStatus']?.toString() ??
          json['participation_status']?.toString(),
    );
  }
}

/// Web uses `bannerImageUrl`; some APIs nest image under `image.url` / `banner`.
String? _parseContestBannerUrl(Map<String, dynamic> json) {
  String? s(dynamic v) {
    if (v == null) return null;
    final t = v.toString().trim();
    return t.isEmpty ? null : t;
  }

  final direct =
      s(json['bannerImageUrl']) ?? s(json['bannerUrl']) ?? s(json['imageUrl']);
  if (direct != null) return direct;

  final img = json['image'];
  if (img is Map) {
    final m = Map<String, dynamic>.from(img);
    return s(m['url']) ?? s(m['src']) ?? s(m['imageUrl']);
  }
  final banner = json['banner'];
  if (banner is Map) {
    final m = Map<String, dynamic>.from(banner);
    return s(m['imageUrl']) ?? s(m['url']) ?? s(m['src']);
  }
  return null;
}

Future<void> showContestPopupIfNeeded(BuildContext context) async {
  final dio = context.read<Dio>();
  final tokenStorage = context.read<TokenStorage>();
  final api = StorefrontApi(dio);
  final raw = await api.getActiveContest();
  if (raw == null) return;
  final vm = ActiveContestVm.fromJson(raw);
  if (vm.id.isEmpty || vm.title.isEmpty) return;

  if (ContestSessionMemory.isDismissed(vm.id)) return;

  final token = await tokenStorage.getCustomerToken();
  ContestParticipationSessionCache.syncTokenKey(token);

  // Guest: show sheet; we cannot know participation without a customer token.
  if (token != null && token.isNotEmpty) {
    if (ContestParticipationSessionCache.isLoaded) {
      if (ContestParticipationSessionCache.hasJoined(vm.id)) {
        debugPrint(
          '[ContestPopup] gate: cached joined contestId=${vm.id} — skip sheet',
        );
        return;
      }
    } else {
      try {
        final participations = await api.getMyContestParticipations();
        ContestParticipationSessionCache.seedFromParticipations(participations);
        debugPrint(
          '[ContestPopup] contest/me count=${participations.length} contestId=${vm.id} joined=${ContestParticipationSessionCache.hasJoined(vm.id)}',
        );
        if (ContestParticipationSessionCache.hasJoined(vm.id)) return;
      } catch (e) {
        debugPrint('[ContestPopup] contest/me failed (show sheet anyway): $e');
      }
    }
  }

  if (!context.mounted) return;
  // Next frame: same pattern as web overlay after data is ready (avoids build-phase sheet).
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!context.mounted) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ContestSheet(contest: vm),
    );
  });
}

class _ContestSheet extends StatefulWidget {
  const _ContestSheet({required this.contest});

  final ActiveContestVm contest;

  @override
  State<_ContestSheet> createState() => _ContestSheetState();
}

class _ContestSheetState extends State<_ContestSheet> {
  String? _selectedOptionId;
  final _scoreAController = TextEditingController(text: '0');
  final _scoreBController = TextEditingController(text: '0');
  bool _submitting = false;
  late bool _participated;

  @override
  void initState() {
    super.initState();
    _participated = widget.contest.participated ||
        ContestParticipationSessionCache.hasJoined(widget.contest.id);
    if (widget.contest.options.isNotEmpty) {
      _selectedOptionId = widget.contest.options.first['id'];
    }
  }

  @override
  void dispose() {
    _scoreAController.dispose();
    _scoreBController.dispose();
    super.dispose();
  }

  Future<bool> _ensureLoggedInForInteraction() async {
    final token = await context.read<TokenStorage>().getCustomerToken();
    if (token != null && token.isNotEmpty) return true;
    if (!mounted) return false;
    final shouldLogin = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            title: Text('تسجيل الدخول مطلوب',
                style: GoogleFonts.cairo(fontWeight: FontWeight.w800)),
            content: Text(
              'يمكنك مشاهدة المسابقة كزائر، لكن المشاركة تتطلب تسجيل الدخول.',
              style: GoogleFonts.cairo(),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text('لاحقاً', style: GoogleFonts.cairo()),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primaryTeal,
                ),
                child: Text('الذهاب لتسجيل الدخول',
                    style: GoogleFonts.cairo(color: Colors.white)),
              ),
            ],
          ),
        ) ??
        false;
    if (!shouldLogin) return false;
    if (!mounted) return false;
    return ensureCustomerAuth(context);
  }

  Future<void> _submit() async {
    if (_participated) return;
    final isAuthed = await _ensureLoggedInForInteraction();
    if (!isAuthed || !mounted) return;

    final messenger = ScaffoldMessenger.maybeOf(context);
    final api = StorefrontApi(context.read<Dio>());

    if (widget.contest.isPrediction) {
      final rawA = _scoreAController.text.trim();
      final rawB = _scoreBController.text.trim();
      if (rawA.isEmpty || rawB.isEmpty) {
        _showMessage('يرجى إدخال نتيجة الفريقين قبل الإرسال');
        return;
      }
      final a = int.tryParse(rawA);
      final b = int.tryParse(rawB);
      if (a == null || b == null || a < 0 || b < 0) {
        _showMessage('الرجاء إدخال نتيجة صحيحة');
        return;
      }
    } else if (!widget.contest.isQuickJoin) {
      final answer = (_selectedOptionId ?? '').trim();
      if (answer.isEmpty) {
        _showMessage('اختر إجابة أولاً');
        return;
      }
    }

    setState(() => _submitting = true);
    final timeoutTimer = Timer(const Duration(seconds: 45), () {
      if (!mounted) return;
      if (_submitting) {
        setState(() => _submitting = false);
        messenger?.showSnackBar(
          SnackBar(
            content: Text(
              'انتهت مهلة الإرسال — أعد المحاولة',
              style: GoogleFonts.cairo(),
            ),
          ),
        );
      }
    });

    Future<(int, Map<String, dynamic>)> callParticipate() async {
      if (widget.contest.isPrediction) {
        final rawA = _scoreAController.text.trim();
        final rawB = _scoreBController.text.trim();
        final a = int.parse(rawA);
        final b = int.parse(rawB);
        return api.participateInContest(
          contestId: widget.contest.id,
          scoreA: a,
          scoreB: b,
        );
      }
      if (widget.contest.isQuickJoin) {
        return api.participateInContest(
          contestId: widget.contest.id,
          userAnswer: 'JOIN',
        );
      }
      final answer = (_selectedOptionId ?? '').trim();
      return api.participateInContest(
        contestId: widget.contest.id,
        userAnswer: answer,
      );
    }

    try {
      const participateTimeout = Duration(seconds: 40);
      var lastHttpStatus = 201;
      var lastBody = const <String, dynamic>{};
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          final r = await callParticipate().timeout(participateTimeout);
          lastHttpStatus = r.$1;
          lastBody = r.$2;
          break;
        } on DioException catch (e) {
          final code = e.response?.statusCode;
          if (code == 401 && attempt == 0) {
            if (!mounted) return;
            final reloginOk = await ensureCustomerAuth(context);
            if (!mounted) return;
            if (!reloginOk) {
              _showMessage('تسجيل الدخول مطلوب لإتمام المشاركة');
              return;
            }
            continue;
          }
          if (!mounted) return;
          if (_isAlreadyParticipatedError(e)) {
            _logContestErrorToConsole(e);
            if (mounted) setState(() => _participated = true);
            ContestParticipationSessionCache.markJoined(widget.contest.id);
            _showAlreadyParticipatedInfoCard(messenger);
            return;
          }
          _logContestErrorToConsole(e);
          _showFriendlyErrorSnackBar(messenger, e);
          return;
        } on TimeoutException {
          if (!mounted) return;
          _logContestErrorToConsole(
            'TimeoutException: participate exceeded 40 seconds',
          );
          _showFriendlyErrorSnackBar(
            messenger,
            'انتهت مهلة الإرسال (40 ثانية)',
          );
          return;
        }
      }

      ContestSessionMemory.dismiss(widget.contest.id);
      ContestParticipationSessionCache.markJoined(widget.contest.id);
      if (!mounted) return;
      if (lastHttpStatus >= 200 && lastHttpStatus < 300) {
        final balance = (lastBody['balance'] as num?)?.toInt();
        if (balance != null) {
          context.read<CoinsBalanceCubit>().applyBalance(balance);
        }
        setState(() => _participated = true);
        final isQuizContest =
            !widget.contest.isPrediction && !widget.contest.isQuickJoin;
        await showContestCelebration(
          context: context,
          httpStatus: lastHttpStatus,
          responseBody: lastBody,
          isPredictionContest: widget.contest.isPrediction,
          isQuizContest: isQuizContest,
        );
        if (!mounted) return;
        messenger?.showSnackBar(
          SnackBar(
            content: Text('تم الاشتراك', style: GoogleFonts.cairo()),
          ),
        );
      }
      if (!mounted) return;
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      _logContestErrorToConsole(e);
      _showFriendlyErrorSnackBar(messenger, e);
    } finally {
      timeoutTimer.cancel();
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _onSelectQuizOption(String id) async {
    final isAuthed = await _ensureLoggedInForInteraction();
    if (!isAuthed || !mounted) return;
    setState(() => _selectedOptionId = id);
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message, style: GoogleFonts.cairo())),
    );
  }

  /// Full technical details — console only (no raw Dio on screen).
  void _logContestErrorToConsole(Object error) {
    final buffer = StringBuffer('[contest submit] ');
    if (error is DioException) {
      buffer.writeln('DioException');
      buffer.writeln('HTTP ${error.response?.statusCode ?? '—'}');
      buffer.writeln('uri=${error.requestOptions.uri}');
      buffer.writeln('type=${error.type} ${error.message ?? ''}');
      buffer.writeln('body=${_stringifyForLog(error.response?.data)}');
    } else {
      buffer.writeln(error.toString());
    }
    nmdDebugLog(buffer.toString());
  }

  String _stringifyForLog(dynamic data) {
    if (data == null) return '(empty)';
    try {
      if (data is Map || data is List) return jsonEncode(data);
      return data.toString();
    } catch (_) {
      return data.toString();
    }
  }

  bool _isAlreadyParticipatedError(DioException e) {
    if (e.response?.statusCode != 400) return false;
    final d = e.response?.data;
    if (d is Map) {
      if (d['code'] == 'ALREADY_PARTICIPATED') return true;
      final err = d['error']?.toString().toLowerCase() ?? '';
      if (err.contains('already participated') ||
          err.contains('تم الاشتراك مسبق')) {
        return true;
      }
      try {
        if (jsonEncode(d).toLowerCase().contains('already participated')) {
          return true;
        }
      } catch (_) {}
    }
    if (d is String) {
      return d.toLowerCase().contains('already participated');
    }
    return false;
  }

  void _showAlreadyParticipatedInfoCard(ScaffoldMessengerState? messenger) {
    const message = 'أنت مشارك في هذه المسابقة مسبقاً، استنّى النتيجة! ⏳';
    messenger?.showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        elevation: 6,
        backgroundColor: AppColors.primaryTeal.withValues(alpha: 0.14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: AppColors.primaryTeal.withValues(alpha: 0.35),
          ),
        ),
        content: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.info_outline_rounded,
              color: AppColors.primaryTeal,
              size: 26,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: GoogleFonts.cairo(
                  fontWeight: FontWeight.w700,
                  fontSize: 14.5,
                  height: 1.35,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    Future<void>.delayed(const Duration(seconds: 2), () {
      if (!mounted) return;
      ContestParticipationSessionCache.markJoined(widget.contest.id);
      ContestSessionMemory.dismiss(widget.contest.id);
      Navigator.pop(context);
    });
  }

  void _showFriendlyErrorSnackBar(
      ScaffoldMessengerState? messenger, Object error) {
    final text = _friendlyUserMessage(error);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(text, style: GoogleFonts.cairo()),
      ),
    );
  }

  String _friendlyUserMessage(Object error) {
    if (error is String) return error;
    if (error is DioException) {
      final d = error.response?.data;
      if (d is Map) {
        final code = d['code']?.toString();
        switch (code) {
          case 'INSUFFICIENT_COINS':
            return 'رصيدك غير كافٍ';
          case 'ALREADY_PARTICIPATED':
            return 'تم الاشتراك مسبقًا';
          case 'LOGIN_REQUIRED':
            return 'سجّل الدخول للمتابعة';
        }
        if (d['error'] != null) {
          final t = d['error']?.toString().trim() ?? '';
          if (t.isNotEmpty) return t;
        }
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return 'انتهت مهلة الاتصال، حاول مرة أخرى';
      }
      if (error.type == DioExceptionType.connectionError) {
        return 'تعذّر الاتصال بالخادم';
      }
      final code = error.response?.statusCode;
      if (code == 400) return 'البيانات غير صحيحة';
      if (code == 403) return 'غير مسموح بهذا الإجراء';
      if (code == 404) return 'المسابقة غير متاحة';
    }
    return 'تعذّر إرسال المشاركة حالياً، حاول مرة أخرى';
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.contest;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 26,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (c.bannerImageUrl != null && c.bannerImageUrl!.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: AspectRatio(
                        aspectRatio: 2,
                        child: CachedNetworkImage(
                          imageUrl: c.bannerImageUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            color: const Color(0xFFF1F5F9),
                            alignment: Alignment.center,
                            child: const SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.primaryTeal,
                              ),
                            ),
                          ),
                          errorWidget: (_, __, ___) => Container(
                            color:
                                AppColors.primaryTeal.withValues(alpha: 0.15),
                          ),
                        ),
                      ),
                    ),
                  if (c.bannerImageUrl != null && c.bannerImageUrl!.isNotEmpty)
                    const SizedBox(height: 12),
                  Text(
                    c.title,
                    style: GoogleFonts.cairo(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  if (c.description.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      c.description,
                      style: GoogleFonts.cairo(
                        fontSize: 13.5,
                        color: const Color(0xFF475569),
                      ),
                    ),
                  ],
                  if (c.coinsCost > 0) ...[
                    const SizedBox(height: 8),
                    Text(
                      'تكلفة الاشتراك: ${c.coinsCost} عملة',
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0D9488),
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  if (c.isPrediction)
                    _PredictionInput(
                      teamAName: c.teamAName,
                      teamBName: c.teamBName,
                      scoreAController: _scoreAController,
                      scoreBController: _scoreBController,
                    )
                  else if (c.isQuickJoin)
                    _QuickJoinCard()
                  else
                    _QuizOptions(
                      options: c.options,
                      selectedId: _selectedOptionId,
                      onSelect: _onSelectQuizOption,
                    ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            ContestSessionMemory.dismiss(c.id);
                            Navigator.pop(context);
                          },
                          child: Text('إغلاق', style: GoogleFonts.cairo()),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: (_participated || _submitting) ? null : _submit,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primaryTeal,
                            disabledBackgroundColor:
                                AppColors.primaryTeal.withValues(alpha: 0.35),
                          ),
                          child: Text(
                            _participated
                                ? 'تم الاشتراك'
                                : _submitting
                                    ? 'جارٍ الإرسال...'
                                    : (c.isQuickJoin ? 'انضم الآن' : 'إرسال'),
                            style: GoogleFonts.cairo(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PredictionInput extends StatelessWidget {
  const _PredictionInput({
    required this.teamAName,
    required this.teamBName,
    required this.scoreAController,
    required this.scoreBController,
  });

  final String teamAName;
  final String teamBName;
  final TextEditingController scoreAController;
  final TextEditingController scoreBController;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ScoreRow(label: teamAName, controller: scoreAController),
        const SizedBox(height: 10),
        _ScoreRow(label: teamBName, controller: scoreBController),
      ],
    );
  }
}

class _ScoreRow extends StatelessWidget {
  const _ScoreRow({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Row(
          children: [
            const Text('⚽', style: TextStyle(fontSize: 20)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
            ),
            SizedBox(
              width: 64,
              child: TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                decoration: const InputDecoration(isDense: true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuizOptions extends StatelessWidget {
  const _QuizOptions({
    required this.options,
    required this.selectedId,
    required this.onSelect,
  });

  final List<Map<String, String>> options;
  final String? selectedId;
  final Future<void> Function(String id) onSelect;

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) {
      return Text('لا توجد خيارات متاحة',
          style: GoogleFonts.cairo(color: const Color(0xFFB45309)));
    }
    return Column(
      children: options.map((opt) {
        final id = (opt['id'] ?? '').trim();
        final label = (opt['label'] ?? '').trim();
        final selected = selectedId == id;
        return InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () async => onSelect(id),
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: selected
                  ? AppColors.primaryTeal.withValues(alpha: 0.10)
                  : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color:
                    selected ? AppColors.primaryTeal : const Color(0xFFE2E8F0),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: selected
                      ? AppColors.primaryTeal
                      : const Color(0xFF64748B),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label.isEmpty ? id : label,
                    style: GoogleFonts.cairo(
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _QuickJoinCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDFA),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF99F6E4)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Text(
          'مسابقة انضمام سريع! اضغط "انضم الآن" للمشاركة مباشرة.',
          style: GoogleFonts.cairo(
            fontWeight: FontWeight.w700,
            color: const Color(0xFF134E4A),
          ),
        ),
      ),
    );
  }
}
