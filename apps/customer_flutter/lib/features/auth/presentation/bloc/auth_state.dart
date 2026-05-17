part of 'auth_bloc.dart';

enum AuthStep {
  phone,
  otp,
  profile,
  done,
}

final class AuthState extends Equatable {
  const AuthState({
    required this.step,
    required this.loading,
    this.phone = '',
    this.phoneExists,
    this.sentVia,
    this.devCode,
    this.pendingOtpCode,
    this.error,
    this.isNewUser,
  });

  const AuthState.initial()
      : step = AuthStep.phone,
        loading = false,
        phone = '',
        phoneExists = null,
        sentVia = null,
        devCode = null,
        pendingOtpCode = null,
        error = null,
        isNewUser = null;

  final AuthStep step;
  final bool loading;
  final String phone;
  final bool? phoneExists;
  final String? sentVia;
  final String? devCode;

  /// OTP digits held while the user completes their name (new users only).
  final String? pendingOtpCode;
  final String? error;
  final bool? isNewUser;

  AuthState copyWith({
    AuthStep? step,
    bool? loading,
    String? phone,
    bool? phoneExists,
    String? sentVia,
    String? devCode,
    String? pendingOtpCode,
    String? error,
    bool? isNewUser,
    bool clearError = false,
    bool clearDevCode = false,
    bool clearPendingOtp = false,
  }) {
    return AuthState(
      step: step ?? this.step,
      loading: loading ?? this.loading,
      phone: phone ?? this.phone,
      phoneExists: phoneExists ?? this.phoneExists,
      sentVia: sentVia ?? this.sentVia,
      devCode: clearDevCode ? null : (devCode ?? this.devCode),
      pendingOtpCode:
          clearPendingOtp ? null : (pendingOtpCode ?? this.pendingOtpCode),
      error: clearError ? null : (error ?? this.error),
      isNewUser: isNewUser ?? this.isNewUser,
    );
  }

  @override
  List<Object?> get props => [
        step,
        loading,
        phone,
        phoneExists,
        sentVia,
        devCode,
        pendingOtpCode,
        error,
        isNewUser,
      ];
}
