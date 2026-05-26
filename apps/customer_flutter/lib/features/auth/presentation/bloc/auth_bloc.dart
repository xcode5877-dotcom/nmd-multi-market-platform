import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/auth/app_review_demo_access.dart';
import '../../domain/auth_repository.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._repo) : super(const AuthState.initial()) {
    on<AuthPhoneSubmitted>(_onPhoneSubmitted);
    on<AuthOtpContinue>(_onOtpContinue);
    on<AuthProfileSubmit>(_onProfileSubmit);
    on<AuthResetRequested>(_onReset);
    on<AuthSessionRestored>(_onSessionRestored);
  }

  final AuthRepository _repo;

  Completer<bool>? _sessionRestoreCompleter;

  /// Coalesced session restore for cold start and auth gates (avoids stream races).
  Future<bool> restoreSession() {
    if (state.step == AuthStep.done) return Future.value(true);
    if (_sessionRestoreCompleter != null) {
      return _sessionRestoreCompleter!.future;
    }
    _sessionRestoreCompleter = Completer<bool>();
    add(const AuthSessionRestored());
    return _sessionRestoreCompleter!.future;
  }

  void _finishSessionRestore(bool ok) {
    final pending = _sessionRestoreCompleter;
    _sessionRestoreCompleter = null;
    if (pending != null && !pending.isCompleted) {
      pending.complete(ok);
    }
  }

  String _normalizePhone(String phone) => phone.replaceAll(RegExp(r'\D'), '');

  bool _isValidIsraelPhone(String phone) {
    final digits = _normalizePhone(phone);
    return digits.length == 10 && digits.startsWith('05');
  }

  bool _isValidPhoneInput(String phone) {
    if (isAppReviewDemoPhoneInput(phone)) return true;
    return _isValidIsraelPhone(phone);
  }

  String _phoneForAuthState(String phone) {
    if (isAppReviewDemoAccount(phone)) {
      return normalizeAppReviewDemoPhone(phone);
    }
    return phone.trim();
  }

  String _readError(Object error, {required String fallback}) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] != null) {
        return data['error'].toString();
      }
      if (error.type == DioExceptionType.connectionError) {
        return 'تعذر الاتصال بالخادم. تحقق من الشبكة.';
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return 'انتهت مهلة الاتصال. حاول مرة أخرى.';
      }
      final status = error.response?.statusCode;
      if (status == 404) return 'الخدمة غير متاحة حالياً.';
      if (status == 500) return 'خطأ في الخادم. حاول بعد قليل.';
    }
    final text = error.toString();
    if (text.contains('SocketException')) {
      return 'تعذر الاتصال بالخادم. تحقق من الشبكة.';
    }
    if (text.contains('timeout')) return 'انتهت مهلة الاتصال. حاول مرة أخرى.';
    if (text.contains('400')) return 'البيانات غير صحيحة.';
    if (text.contains('401')) return 'غير مصرح. أعد تسجيل الدخول.';
    if (text.contains('404')) return 'الخدمة غير متاحة حالياً.';
    return fallback;
  }

  static const _wrongOtpMessage = 'رمز التحقق غير صحيح، حاول مرة أخرى';

  String _otpVerificationError(Object error) {
    if (error is DioException) {
      final status = error.response?.statusCode;
      if (status == 401 || status == 429) return _wrongOtpMessage;
      final data = error.response?.data;
      if (data is Map) {
        final code = data['code']?.toString();
        if (code == 'OTP_INVALID' ||
            code == 'OTP_EXPIRED' ||
            code == 'OTP_LOCKED') {
          return _wrongOtpMessage;
        }
      }
    }
    return _readError(error, fallback: _wrongOtpMessage);
  }

  Future<void> _onPhoneSubmitted(
    AuthPhoneSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    final phone = event.phone.trim();
    if (phone.isEmpty) {
      emit(state.copyWith(error: 'أدخل رقم الجوال'));
      return;
    }
    if (!_isValidPhoneInput(phone)) {
      emit(state.copyWith(error: 'رقم الجوال بصيغة إسرائيلية (05x-xxxxxxx)'));
      return;
    }

    final authPhone = _phoneForAuthState(phone);

    emit(state.copyWith(
      loading: true,
      phone: authPhone,
      clearError: true,
      clearDevCode: true,
      clearPendingOtp: true,
    ));

    /// Apple App Review demo access only — OTP step in-app; no /start delivery channel.
    if (isAppReviewDemoAccount(phone)) {
      logAppleReviewAuthBypass('phoneSubmitted');
      emit(
        state.copyWith(
          loading: false,
          step: AuthStep.otp,
          phone: authPhone,
          phoneExists: true,
          sentVia: 'app_review',
          clearError: true,
        ),
      );
      return;
    }

    try {
      final check = await _repo.checkPhone(phone);
      final start = await _repo.startOtp(phone);
      if (!start.ok) {
        emit(
          state.copyWith(
            loading: false,
            error: start.error ?? 'Failed to send OTP.',
          ),
        );
        return;
      }
      emit(
        state.copyWith(
          loading: false,
          step: AuthStep.otp,
          phoneExists: check.exists,
          sentVia: start.sentVia,
          clearDevCode: true,
        ),
      );
    } catch (e) {
      emit(state.copyWith(
        loading: false,
        error: _readError(e, fallback: 'تعذر إرسال رمز التحقق حالياً.'),
      ));
    }
  }

  Future<void> _onOtpContinue(
    AuthOtpContinue event,
    Emitter<AuthState> emit,
  ) async {
    final code = event.code.trim();
    if (code.length != 6) {
      emit(state.copyWith(error: 'أدخل الرمز الستّة أرقام'));
      return;
    }

    /// Apple App Review demo access only — reject wrong code locally; no outbound OTP channel.
    if (isAppReviewDemoAccount(state.phone)) {
      if (!isAppReviewDemoOtp(code)) {
        emit(state.copyWith(
          loading: false,
          step: AuthStep.otp,
          error: _wrongOtpMessage,
        ));
        return;
      }
      logAppleReviewAuthBypass('otpSubmitted');
      await _completeOtpVerification(
        emit: emit,
        phone: normalizeAppReviewDemoPhone(state.phone),
        code: code,
        phoneExists: state.phoneExists == true,
      );
      return;
    }

    final exists = state.phoneExists == true;
    await _completeOtpVerification(
      emit: emit,
      phone: state.phone,
      code: code,
      phoneExists: exists,
    );
  }

  Future<void> _completeOtpVerification({
    required Emitter<AuthState> emit,
    required String phone,
    required String code,
    required bool phoneExists,
  }) async {
    if (phoneExists) {
      emit(state.copyWith(loading: true, clearError: true));
      try {
        final result = await _repo.verifyOtp(
          phone: phone,
          code: code,
          name: null,
        );
        emit(
          state.copyWith(
            loading: false,
            step: AuthStep.done,
            phone: phone,
            isNewUser: result.isNewUser,
          ),
        );
      } catch (e) {
        emit(state.copyWith(
          loading: false,
          step: AuthStep.otp,
          error: _otpVerificationError(e),
        ));
      }
      return;
    }

    emit(state.copyWith(loading: true, clearError: true));
    try {
      final result = await _repo.verifyOtp(
        phone: phone,
        code: code,
        name: null,
      );
      if (result.isNewUser) {
        emit(
          state.copyWith(
            loading: false,
            step: AuthStep.profile,
            phone: phone,
            clearPendingOtp: true,
            isNewUser: true,
          ),
        );
        return;
      }
      emit(
        state.copyWith(
          loading: false,
          step: AuthStep.done,
          phone: phone,
          isNewUser: false,
        ),
      );
    } catch (e) {
      emit(state.copyWith(
        loading: false,
        step: AuthStep.otp,
        error: _otpVerificationError(e),
      ));
    }
  }

  Future<void> _onProfileSubmit(
    AuthProfileSubmit event,
    Emitter<AuthState> emit,
  ) async {
    final name = event.name.trim();
    if (name.isEmpty) {
      emit(state.copyWith(error: 'أدخل اسمك'));
      return;
    }
    emit(state.copyWith(loading: true, clearError: true));
    try {
      await _repo.updateCustomerName(name);
      emit(
        state.copyWith(
          loading: false,
          step: AuthStep.done,
          isNewUser: true,
        ),
      );
    } catch (e) {
      emit(state.copyWith(
        loading: false,
        error: _readError(e, fallback: 'فشل إكمال التسجيل.'),
      ));
    }
  }

  void _onReset(
    AuthResetRequested event,
    Emitter<AuthState> emit,
  ) {
    emit(const AuthState.initial());
  }

  Future<void> _onSessionRestored(
    AuthSessionRestored event,
    Emitter<AuthState> emit,
  ) async {
    if (state.step == AuthStep.done) {
      _finishSessionRestore(true);
      return;
    }
    var ok = false;
    try {
      final me = await _repo.fetchCurrentCustomer();
      if (me != null) {
        emit(
          state.copyWith(
            step: AuthStep.done,
            loading: false,
            phone: me.phone,
            clearError: true,
          ),
        );
        ok = true;
      }
    } catch (_) {
      // Stay logged out; caller may show OTP sheet.
    } finally {
      _finishSessionRestore(ok);
    }
  }
}
