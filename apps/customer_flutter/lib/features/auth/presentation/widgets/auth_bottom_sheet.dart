import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lottie/lottie.dart';
import 'package:pinput/pinput.dart';

import '../../../../core/auth/app_review_demo_access.dart';
import '../../../../core/auth/customer_auth_launcher.dart';
import '../../../../core/debug/nmd_post_login_trace.dart';
import '../../../../design_system/design_system.dart';
import '../../../account/data/delivery_town_repository.dart';
import '../../../account/presentation/widgets/delivery_town_picker_sheet.dart';
import '../bloc/auth_bloc.dart';

bool _authSheetOpen = false;

void _authSheetAudit(String message) {
  debugPrint('[AUTH-AUDIT] $message');
}

/// Clears a stale open flag when no root modal route is mounted.
void recoverStuckAuthSheetIfNeeded(BuildContext context) {
  if (!_authSheetOpen) return;
  final navigator = Navigator.maybeOf(context, rootNavigator: true);
  final hasModal = navigator?.canPop() ?? false;
  if (!hasModal) {
    _authSheetOpen = false;
    _authSheetAudit('recoverStuckAuthSheet: cleared stale open flag');
  }
}

@visibleForTesting
void resetAuthSheetOpenForTest() {
  _authSheetOpen = false;
}

@visibleForTesting
bool isAuthSheetOpenForTest() => _authSheetOpen;

@visibleForTesting
void setAuthSheetOpenForTest(bool value) {
  _authSheetOpen = value;
}

Future<bool> showAuthBottomSheet(BuildContext context) async {
  recoverStuckAuthSheetIfNeeded(context);
  _authSheetAudit(
    'showAuthBottomSheet enter open=$_authSheetOpen mounted=${context.mounted}',
  );
  if (_authSheetOpen) {
    _authSheetAudit('showAuthBottomSheet blocked — sheet already open');
    return false;
  }
  _authSheetOpen = true;
  final authBloc = context.read<AuthBloc>();
  authBloc.add(const AuthResetRequested());

  bool? result;
  try {
    _authSheetAudit('showAuthBottomSheet pushing modal useRootNavigator=true');
    result = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      isDismissible: true,
      enableDrag: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(
        value: authBloc,
        child: const _AuthBottomSheetView(),
      ),
    );
    _authSheetAudit('showAuthBottomSheet modal closed result=$result');
  } catch (e, st) {
    _authSheetAudit('showAuthBottomSheet error: $e\n$st');
    result = false;
  } finally {
    _authSheetOpen = false;
    _authSheetAudit('showAuthBottomSheet finally open=false');
  }

  return result == true;
}

Future<bool> showNmdAuthBottomSheet(BuildContext context) {
  return showAuthBottomSheet(context);
}

class _AuthBottomSheetView extends StatefulWidget {
  const _AuthBottomSheetView();

  @override
  State<_AuthBottomSheetView> createState() => _AuthBottomSheetViewState();
}

class _AuthBottomSheetViewState extends State<_AuthBottomSheetView> {
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  final _otpController = TextEditingController();
  final _otpFocus = FocusNode();
  final _nameFocus = FocusNode();

  bool _successTimerStarted = false;
  List<String> _deliveryTowns = const [];
  String? _selectedDeliveryTown;
  bool _townsLoading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    _otpController.dispose();
    _otpFocus.dispose();
    _nameFocus.dispose();
    super.dispose();
  }

  void _onAuthState(BuildContext context, AuthState state) {
    if (state.step == AuthStep.otp) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _otpFocus.requestFocus();
      });
    }
    if (state.step == AuthStep.otp && state.error != null) {
      _otpController.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _otpFocus.requestFocus();
      });
    }
    if (state.step == AuthStep.profile) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _nameFocus.requestFocus();
      });
    }
    if (state.step == AuthStep.deliveryTown &&
        _deliveryTowns.isEmpty &&
        !_townsLoading) {
      _loadDeliveryTowns();
    }
    if (state.step == AuthStep.done && !_successTimerStarted) {
      _successTimerStarted = true;
      nmdPostLoginTrace('POST_LOGIN_START', 'auth sheet success animation');
      Future<void>.delayed(const Duration(milliseconds: 1700), () {
        if (!context.mounted) {
          nmdPostLoginTrace('AUTH_SHEET_POP_SKIPPED_UNMOUNTED');
          return;
        }
        nmdPostLoginTrace('AUTH_SHEET_POP_SUCCESS');
        Navigator.of(context, rootNavigator: true).pop(true);
      });
    }
  }

  Future<void> _loadDeliveryTowns() async {
    setState(() => _townsLoading = true);
    try {
      final dio = context.read<Dio>();
      final towns =
          await DeliveryTownRepository(dio).fetchTowns(forceRefresh: true);
      if (mounted) {
        setState(() {
          _deliveryTowns = towns;
          _townsLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _townsLoading = false);
    }
  }

  Future<void> _openDeliveryTownPicker() async {
    if (_deliveryTowns.isEmpty) await _loadDeliveryTowns();
    if (!mounted || _deliveryTowns.isEmpty) return;
    final picked = await showDeliveryTownPickerSheet(
      context,
      towns: _deliveryTowns,
      selectedTown: _selectedDeliveryTown,
    );
    if (picked != null && mounted) {
      setState(() => _selectedDeliveryTown = picked);
    }
  }

  int _stepIndex(AuthStep step) => switch (step) {
        AuthStep.phone => 0,
        AuthStep.otp => 1,
        AuthStep.profile => 2,
        AuthStep.deliveryTown => 2,
        AuthStep.done => 3,
      };

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (prev, next) =>
          prev.step != next.step ||
          prev.error != next.error ||
          prev.loading != next.loading,
      listener: _onAuthState,
      builder: (context, state) {
        return AnimatedPadding(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutCubic,
          padding: EdgeInsets.only(bottom: bottomInset),
          child: Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.92,
            ),
            decoration: const BoxDecoration(
              color: NmdColors.surfaceBase,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              boxShadow: NmdShadows.lg,
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  NmdSpacing.screenHorizontal,
                  NmdSpacing.sm,
                  NmdSpacing.screenHorizontal,
                  NmdSpacing.lg,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 42,
                        height: 4,
                        decoration: BoxDecoration(
                          color: NmdColors.borderSubtle,
                          borderRadius: NmdRadius.borderPill,
                        ),
                      ),
                    ),
                    const SizedBox(height: NmdSpacing.md),
                    SvgPicture.asset(
                      'assets/branding/logo-nowmarket.svg',
                      height: 34,
                    ),
                    const SizedBox(height: NmdSpacing.md),
                    if (state.step != AuthStep.done)
                      _AuthStepIndicator(activeIndex: _stepIndex(state.step)),
                    if (state.error != null && state.step != AuthStep.otp) ...[
                      const SizedBox(height: NmdSpacing.sm),
                      _ErrorBanner(message: state.error!),
                    ],
                    const SizedBox(height: NmdSpacing.sm),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 320),
                      switchInCurve: Curves.easeOutCubic,
                      switchOutCurve: Curves.easeInCubic,
                      transitionBuilder: (child, animation) {
                        return FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: Tween<Offset>(
                              begin: const Offset(0, 0.05),
                              end: Offset.zero,
                            ).animate(animation),
                            child: child,
                          ),
                        );
                      },
                      child: KeyedSubtree(
                        key: ValueKey('${state.step}_${state.phone}'),
                        child: _stepChild(context, state),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _stepChild(BuildContext context, AuthState state) {
    switch (state.step) {
      case AuthStep.done:
        return _SuccessPanel();
      case AuthStep.phone:
        return _PhoneStep(
          controller: _phoneController,
          loading: state.loading,
          onSubmit: () => context.read<AuthBloc>().add(
                AuthPhoneSubmitted(_phoneController.text),
              ),
        );
      case AuthStep.otp:
        return _OtpStep(
          phone: state.phone,
          sentVia: state.sentVia,
          controller: _otpController,
          focusNode: _otpFocus,
          loading: state.loading,
          errorMessage: state.error,
          onResend: () => context.read<AuthBloc>().add(
                AuthPhoneSubmitted(state.phone),
              ),
          onContinue: (code) =>
              context.read<AuthBloc>().add(AuthOtpContinue(code)),
        );
      case AuthStep.profile:
        return _ProfileStep(
          controller: _nameController,
          focusNode: _nameFocus,
          loading: state.loading,
          onSubmit: () => context.read<AuthBloc>().add(
                AuthProfileSubmit(_nameController.text),
              ),
        );
      case AuthStep.deliveryTown:
        return _DeliveryTownStep(
          loading: state.loading,
          townsLoading: _townsLoading,
          selectedTown: _selectedDeliveryTown,
          onOpenPicker: _openDeliveryTownPicker,
          onSubmit: () {
            final town = _selectedDeliveryTown?.trim() ?? '';
            if (town.isEmpty) {
              context.read<AuthBloc>().add(const AuthDeliveryTownSubmit(''));
              return;
            }
            context.read<AuthBloc>().add(AuthDeliveryTownSubmit(town));
          },
        );
    }
  }
}

class _AuthStepIndicator extends StatelessWidget {
  const _AuthStepIndicator({required this.activeIndex});

  final int activeIndex;

  static const _labels = ['الجوال', 'الرمز', 'الملف'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(_labels.length, (i) {
        final active = i == activeIndex;
        final done = i < activeIndex;
        return Expanded(
          child: Padding(
            padding: EdgeInsetsDirectional.only(
              start: i == 0 ? 0 : 4,
              end: i == _labels.length - 1 ? 0 : 4,
            ),
            child: Column(
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: done || active
                        ? NmdColors.brandPrimary
                        : NmdColors.borderSubtle,
                    borderRadius: NmdRadius.borderPill,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _labels[i],
                  style: NmdTypography.micro.copyWith(
                    fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    color: active
                        ? NmdColors.brandPrimary
                        : NmdColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return NmdSurface(
      mode: NmdSurfaceMode.muted,
      padding: const EdgeInsets.all(NmdSpacing.sm),
      borderRadius: NmdRadius.borderMd,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded,
              color: NmdColors.error, size: 20),
          const SizedBox(width: NmdSpacing.xs),
          Expanded(
            child: Text(
              message,
              textAlign: TextAlign.right,
              style: NmdTypography.bodySmall.copyWith(
                color: NmdColors.error,
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PhoneStep extends StatelessWidget {
  const _PhoneStep({
    required this.controller,
    required this.loading,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool loading;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final reviewDemo = isAppReviewDemoPhoneInput(controller.text);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'تسجيل الدخول',
              textAlign: TextAlign.center,
              style: NmdTypography.h2,
            ),
            const SizedBox(height: NmdSpacing.xs),
            Text(
              reviewDemo
                  ? 'أدخل رقم المراجعة — الرمز يُدخل داخل التطبيق (لا حاجة لواتساب)'
                  : 'أدخل رقم جوالك — نرسل لك رمز التحقق عبر واتساب بأمان',
              textAlign: TextAlign.center,
              style: NmdTypography.bodySmall.copyWith(height: 1.45),
            ),
            const SizedBox(height: NmdSpacing.lg),
            NmdInput(
              controller: controller,
              label: 'رقم الجوال',
              hint: reviewDemo ? '0500000000' : '05xxxxxxxx',
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => onSubmit(),
            ),
            const SizedBox(height: NmdSpacing.md),
            NmdButton(
              label: reviewDemo ? 'متابعة' : 'إرسال الرمز',
              loading: loading,
              onPressed: loading ? null : onSubmit,
            ),
            if (!reviewDemo) ...[
              const SizedBox(height: NmdSpacing.md),
              const _WhatsAppTrustBadge(),
            ],
          ],
        );
      },
    );
  }
}

class _WhatsAppTrustBadge extends StatelessWidget {
  const _WhatsAppTrustBadge();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: NmdChip(
        label: 'تحقق عبر واتساب',
        variant: NmdChipVariant.status,
        backgroundColor: const Color(0xFFF0FDF4),
        foregroundColor: const Color(0xFF166534),
        leading: Container(
          width: 22,
          height: 22,
          decoration: const BoxDecoration(
            color: Color(0xFF25D366),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.chat_rounded, size: 13, color: Colors.white),
        ),
      ),
    );
  }
}

class _OtpStep extends StatelessWidget {
  const _OtpStep({
    required this.phone,
    required this.sentVia,
    required this.controller,
    required this.focusNode,
    required this.loading,
    this.errorMessage,
    required this.onResend,
    required this.onContinue,
  });

  final String phone;
  final String? sentVia;
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool loading;
  final String? errorMessage;
  final VoidCallback onResend;
  final void Function(String code) onContinue;

  @override
  Widget build(BuildContext context) {
    final reviewDemo = isAppReviewDemoAccount(phone) ||
        sentVia == 'app_review' ||
        sentVia == 'play_review';
    final defaultPin = PinTheme(
      width: 46,
      height: 52,
      textStyle: NmdTypography.h3.copyWith(fontWeight: FontWeight.w800),
      decoration: BoxDecoration(
        borderRadius: NmdRadius.borderSm,
        border: Border.all(color: NmdColors.borderSubtle, width: 1.2),
        color: NmdColors.surfaceMuted,
      ),
    );

    final focusedPin = defaultPin.copyWith(
      decoration: BoxDecoration(
        borderRadius: NmdRadius.borderSm,
        border: Border.all(color: NmdColors.brandPrimary, width: 2),
        color: NmdColors.surfaceMuted,
        boxShadow: NmdShadows.brandGlow(alpha: 0.15),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'رمز التحقق',
          textAlign: TextAlign.center,
          style: NmdTypography.h2,
        ),
        const SizedBox(height: NmdSpacing.xs),
        Text(
          reviewDemo
              ? 'أدخل رمز المراجعة داخل التطبيق ($kAppReviewDemoOtp) — لا حاجة لواتساب أو رسائل'
              : 'أدخل الرمز المرسل إلى $phone'
                  '${sentVia != null && sentVia!.contains('whatsapp') ? ' عبر واتساب' : ''}',
          textAlign: TextAlign.center,
          style: NmdTypography.bodySmall.copyWith(height: 1.45),
        ),
        const SizedBox(height: NmdSpacing.lg),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Pinput(
            length: 6,
            controller: controller,
            focusNode: focusNode,
            autofocus: true,
            defaultPinTheme: defaultPin,
            focusedPinTheme: focusedPin,
            submittedPinTheme: defaultPin,
            hapticFeedbackType: HapticFeedbackType.lightImpact,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            onCompleted: loading ? null : onContinue,
          ),
        ),
        if (errorMessage != null) ...[
          const SizedBox(height: NmdSpacing.sm),
          _ErrorBanner(message: errorMessage!),
        ],
        const SizedBox(height: NmdSpacing.md),
        NmdButton(
          label: 'متابعة',
          variant: NmdButtonVariant.secondary,
          loading: loading,
          onPressed: loading ? null : () => onContinue(controller.text.trim()),
        ),
        const SizedBox(height: NmdSpacing.sm),
        TextButton(
          onPressed: loading ? null : onResend,
          child: Text(
            'إعادة إرسال الرمز',
            style: NmdTypography.label.copyWith(color: NmdColors.brandPrimary),
          ),
        ),
      ],
    );
  }
}

class _ProfileStep extends StatelessWidget {
  const _ProfileStep({
    required this.controller,
    required this.focusNode,
    required this.loading,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool loading;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'أكمل ملفك',
          textAlign: TextAlign.center,
          style: NmdTypography.h2,
        ),
        const SizedBox(height: NmdSpacing.xs),
        Text(
          'مرحباً بك! أدخل اسمك الظاهر في الطلبات',
          textAlign: TextAlign.center,
          style: NmdTypography.bodySmall.copyWith(height: 1.45),
        ),
        const SizedBox(height: NmdSpacing.lg),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          textDirection: TextDirection.rtl,
          children: [
            Text(
              'الاسم الكامل',
              textAlign: TextAlign.right,
              style:
                  NmdTypography.label.copyWith(color: NmdColors.textSecondary),
            ),
            const SizedBox(height: NmdSpacing.xxs),
            TextFormField(
              controller: controller,
              focusNode: focusNode,
              textAlign: TextAlign.right,
              textCapitalization: TextCapitalization.words,
              style: NmdTypography.body,
              decoration: const InputDecoration(
                hintText: 'مثال: أحمد محمد',
              ),
              onFieldSubmitted: (_) => onSubmit(),
            ),
          ],
        ),
        const SizedBox(height: NmdSpacing.md),
        NmdButton(
          label: 'إنشاء الحساب',
          loading: loading,
          onPressed: loading ? null : onSubmit,
        ),
      ],
    );
  }
}

class _DeliveryTownStep extends StatelessWidget {
  const _DeliveryTownStep({
    required this.loading,
    required this.townsLoading,
    required this.selectedTown,
    required this.onOpenPicker,
    required this.onSubmit,
  });

  final bool loading;
  final bool townsLoading;
  final String? selectedTown;
  final VoidCallback onOpenPicker;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'اختر منطقتك الرئيسية',
          textAlign: TextAlign.center,
          style: NmdTypography.h2,
        ),
        const SizedBox(height: NmdSpacing.xs),
        Text(
          'سنستخدم هذه المنطقة تلقائيًا عند إتمام الطلب، ويمكنك تغييرها لاحقًا.',
          textAlign: TextAlign.center,
          style: NmdTypography.bodySmall.copyWith(height: 1.45),
        ),
        const SizedBox(height: NmdSpacing.lg),
        InkWell(
          onTap: townsLoading ? null : onOpenPicker,
          borderRadius: BorderRadius.circular(12),
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: 'المنطقة الرئيسية',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              suffixIcon: townsLoading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : const Icon(Icons.keyboard_arrow_down_rounded),
            ),
            child: Text(
              selectedTown?.trim().isNotEmpty == true
                  ? selectedTown!
                  : 'اختر منطقة',
              textAlign: TextAlign.right,
              style: NmdTypography.body.copyWith(
                color: selectedTown?.trim().isNotEmpty == true
                    ? NmdColors.textPrimary
                    : NmdColors.textSecondary,
              ),
            ),
          ),
        ),
        const SizedBox(height: NmdSpacing.md),
        NmdButton(
          label: 'متابعة',
          loading: loading,
          onPressed: loading ? null : onSubmit,
        ),
      ],
    );
  }
}

class _SuccessPanel extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NmdSpacing.lg),
      child: Column(
        children: [
          Lottie.asset(
            'assets/lottie/auth_success_check.json',
            width: 140,
            height: 140,
            fit: BoxFit.contain,
            repeat: false,
          ),
          const SizedBox(height: NmdSpacing.xs),
          Text(
            'تم بنجاح',
            textAlign: TextAlign.center,
            style: NmdTypography.h2,
          ),
          const SizedBox(height: NmdSpacing.xxs),
          Text(
            'جاري تسجيل الدخول…',
            textAlign: TextAlign.center,
            style: NmdTypography.bodySmall,
          ),
        ],
      ),
    );
  }
}
