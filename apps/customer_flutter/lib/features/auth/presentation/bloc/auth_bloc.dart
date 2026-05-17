import 'package:equatable/equatable.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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

  String _normalizePhone(String phone) => phone.replaceAll(RegExp(r'\D'), '');

  bool _isValidIsraelPhone(String phone) {
    final digits = _normalizePhone(phone);
    return digits.length == 10 && digits.startsWith('05');
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

  Future<void> _onPhoneSubmitted(
    AuthPhoneSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    final phone = event.phone.trim();
    if (phone.isEmpty) {
      emit(state.copyWith(error: 'أدخل رقم الجوال'));
      return;
    }
    if (!_isValidIsraelPhone(phone)) {
      emit(state.copyWith(error: 'رقم الجوال بصيغة إسرائيلية (05x-xxxxxxx)'));
      return;
    }

    emit(state.copyWith(
      loading: true,
      phone: phone,
      clearError: true,
      clearDevCode: true,
      clearPendingOtp: true,
    ));
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
          devCode: start.devCode,
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

    final exists = state.phoneExists == true;
    if (exists) {
      emit(state.copyWith(loading: true, clearError: true));
      try {
        final result = await _repo.verifyOtp(
          phone: state.phone,
          code: code,
          name: null,
        );
        emit(
          state.copyWith(
            loading: false,
            step: AuthStep.done,
            isNewUser: result.isNewUser,
          ),
        );
      } catch (e) {
        emit(state.copyWith(
          loading: false,
          error: _readError(e, fallback: 'فشل التحقق من الرمز.'),
        ));
      }
      return;
    }

    emit(
      state.copyWith(
        step: AuthStep.profile,
        pendingOtpCode: code,
        clearError: true,
      ),
    );
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
    final pending = state.pendingOtpCode;
    if (pending == null || pending.length != 6) {
      emit(state.copyWith(
        error: 'انتهت الجلسة. ارجع لإدخال الرمز مرة أخرى.',
        step: AuthStep.otp,
        clearPendingOtp: true,
      ));
      return;
    }

    emit(state.copyWith(loading: true, clearError: true));
    try {
      final result = await _repo.verifyOtp(
        phone: state.phone,
        code: pending,
        name: name,
      );
      emit(
        state.copyWith(
          loading: false,
          step: AuthStep.done,
          isNewUser: result.isNewUser,
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
    try {
      final me = await _repo.fetchCurrentCustomer();
      if (me == null) return;
      emit(
        state.copyWith(
          step: AuthStep.done,
          loading: false,
          phone: me.phone,
          clearError: true,
        ),
      );
    } catch (_) {
      // ignore — stay logged out
    }
  }
}
