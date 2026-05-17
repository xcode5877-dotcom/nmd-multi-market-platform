import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lottie/lottie.dart';
import 'package:pinput/pinput.dart';

import '../../../../app/theme/app_colors.dart';
import '../bloc/auth_bloc.dart';

Future<bool> showAuthBottomSheet(BuildContext context) async {
  final authBloc = context.read<AuthBloc>();
  authBloc.add(const AuthResetRequested());

  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => BlocProvider.value(
      value: authBloc,
      child: const _AuthBottomSheetView(),
    ),
  );

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
    if (state.step == AuthStep.otp && state.pendingOtpCode == null) {
      _otpController.clear();
    }
    if (state.step == AuthStep.otp) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _otpFocus.requestFocus();
      });
    }
    if (state.step == AuthStep.profile) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _nameFocus.requestFocus();
      });
    }
    if (state.step == AuthStep.done && !_successTimerStarted) {
      _successTimerStarted = true;
      Future<void>.delayed(const Duration(milliseconds: 1700), () {
        if (!context.mounted) return;
        Navigator.of(context).pop(true);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (prev, next) =>
          prev.step != next.step || prev.pendingOtpCode != next.pendingOtpCode,
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
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 42,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SvgPicture.asset(
                      'assets/branding/logo-nowmarket.svg',
                      height: 34,
                    ),
                    const SizedBox(height: 20),
                    if (state.error != null) ...[
                      _ErrorBanner(message: state.error!),
                      const SizedBox(height: 14),
                    ],
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
                        key: ValueKey(
                          '${state.step}_${state.phone}_${state.pendingOtpCode ?? ''}',
                        ),
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
          devCode: state.devCode,
          controller: _otpController,
          focusNode: _otpFocus,
          loading: state.loading,
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
    }
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Text(
        message,
        textAlign: TextAlign.right,
        style: GoogleFonts.cairo(
          color: const Color(0xFFB91C1C),
          fontSize: 13,
          fontWeight: FontWeight.w600,
          height: 1.4,
        ),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'تسجيل الدخول',
          textAlign: TextAlign.center,
          style: GoogleFonts.cairo(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'أدخل رقم جوالك لإرسال رمز التحقق عبر واتساب',
          textAlign: TextAlign.center,
          style: GoogleFonts.cairo(
            fontSize: 14,
            color: const Color(0xFF64748B),
            height: 1.45,
          ),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: controller,
          keyboardType: TextInputType.phone,
          textAlign: TextAlign.right,
          style: GoogleFonts.cairo(
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
          decoration: InputDecoration(
            labelText: 'رقم الجوال',
            hintText: '05xxxxxxxx',
            alignLabelWithHint: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(
                color: AppColors.primaryTeal,
                width: 2,
              ),
            ),
          ),
          onSubmitted: (_) => onSubmit(),
        ),
        const SizedBox(height: 18),
        SizedBox(
          height: 54,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                colors: [
                  AppColors.shellTeal,
                  AppColors.primaryTeal,
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primaryTeal.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: loading ? null : onSubmit,
                borderRadius: BorderRadius.circular(16),
                child: Center(
                  child: loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'إرسال الرمز',
                          style: GoogleFonts.cairo(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                          ),
                        ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        _WhatsAppTrustBadge(),
      ],
    );
  }
}

class _WhatsAppTrustBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: const Color(0xFF25D366).withValues(alpha: 0.25),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          textDirection: TextDirection.rtl,
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                color: Color(0xFF25D366),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.chat_rounded,
                size: 13,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Verified by WhatsApp',
              style: GoogleFonts.cairo(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF166534),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OtpStep extends StatelessWidget {
  const _OtpStep({
    required this.phone,
    required this.sentVia,
    required this.devCode,
    required this.controller,
    required this.focusNode,
    required this.loading,
    required this.onContinue,
  });

  final String phone;
  final String? sentVia;
  final String? devCode;
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool loading;
  final void Function(String code) onContinue;

  static const _pinBorder = Color(0xFFE2E8F0);

  @override
  Widget build(BuildContext context) {
    final defaultPin = PinTheme(
      width: 46,
      height: 52,
      textStyle: GoogleFonts.cairo(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: const Color(0xFF0F172A),
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _pinBorder, width: 1.2),
        color: const Color(0xFFF8FAFC),
      ),
    );

    final focusedPin = defaultPin.copyWith(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primaryTeal, width: 2),
        color: const Color(0xFFF8FAFC),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryTeal.withValues(alpha: 0.18),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'رمز التحقق',
          textAlign: TextAlign.center,
          style: GoogleFonts.cairo(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'أدخل الرمز المرسل إلى $phone'
          '${sentVia != null && sentVia!.contains('whatsapp') ? ' عبر واتساب' : ''}',
          textAlign: TextAlign.center,
          style: GoogleFonts.cairo(
            fontSize: 14,
            color: const Color(0xFF64748B),
            height: 1.45,
          ),
        ),
        const SizedBox(height: 22),
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
            onCompleted: onContinue,
          ),
        ),
        if (devCode != null) ...[
          const SizedBox(height: 12),
          Text(
            'رمز التطوير: $devCode',
            textAlign: TextAlign.center,
            style: GoogleFonts.cairo(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryTeal,
            ),
          ),
        ],
        const SizedBox(height: 20),
        SizedBox(
          height: 52,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.primaryTeal.withValues(alpha: 0.35),
              ),
            ),
            child: Material(
              color: const Color(0xFFF0FDFA),
              child: InkWell(
                onTap:
                    loading ? null : () => onContinue(controller.text.trim()),
                borderRadius: BorderRadius.circular(14),
                child: Center(
                  child: loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: AppColors.primaryTeal,
                          ),
                        )
                      : Text(
                          'متابعة',
                          style: GoogleFonts.cairo(
                            color: AppColors.primaryTeal,
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                ),
              ),
            ),
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
          style: GoogleFonts.cairo(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'مرحباً بك! أدخل اسمك الظاهر في الطلبات',
          textAlign: TextAlign.center,
          style: GoogleFonts.cairo(
            fontSize: 14,
            color: const Color(0xFF64748B),
            height: 1.45,
          ),
        ),
        const SizedBox(height: 22),
        TextField(
          controller: controller,
          focusNode: focusNode,
          textAlign: TextAlign.right,
          textCapitalization: TextCapitalization.words,
          style: GoogleFonts.cairo(
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
          decoration: InputDecoration(
            labelText: 'الاسم الكامل',
            hintText: 'مثال: أحمد محمد',
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(
                color: AppColors.primaryTeal,
                width: 2,
              ),
            ),
          ),
          onSubmitted: (_) => onSubmit(),
        ),
        const SizedBox(height: 18),
        SizedBox(
          height: 54,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                colors: [
                  AppColors.shellTeal,
                  AppColors.primaryTeal,
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primaryTeal.withValues(alpha: 0.3),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: loading ? null : onSubmit,
                borderRadius: BorderRadius.circular(16),
                child: Center(
                  child: loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'إنشاء الحساب',
                          style: GoogleFonts.cairo(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                          ),
                        ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SuccessPanel extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Lottie.asset(
            'assets/lottie/auth_success_check.json',
            width: 140,
            height: 140,
            fit: BoxFit.contain,
            repeat: false,
          ),
          const SizedBox(height: 8),
          Text(
            'تم بنجاح',
            textAlign: TextAlign.center,
            style: GoogleFonts.cairo(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'جاري تسجيل الدخول…',
            textAlign: TextAlign.center,
            style: GoogleFonts.cairo(
              fontSize: 14,
              color: const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }
}
