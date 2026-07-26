part of 'auth_bloc.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

final class AuthPhoneSubmitted extends AuthEvent {
  const AuthPhoneSubmitted(this.phone);
  final String phone;

  @override
  List<Object?> get props => [phone];
}

/// After OTP entry: existing users verify immediately; new users move to profile step.
final class AuthOtpContinue extends AuthEvent {
  const AuthOtpContinue(this.code);
  final String code;

  @override
  List<Object?> get props => [code];
}

/// New user: submit display name, then delivery town step.
final class AuthProfileSubmit extends AuthEvent {
  const AuthProfileSubmit(this.name);
  final String name;

  @override
  List<Object?> get props => [name];
}

/// New or existing user: submit required default delivery town.
final class AuthDeliveryTownSubmit extends AuthEvent {
  const AuthDeliveryTownSubmit(this.town);
  final String town;

  @override
  List<Object?> get props => [town];
}

final class AuthResetRequested extends AuthEvent {
  const AuthResetRequested();
}

/// Restore [AuthStep.done] from stored customer JWT + `GET /customer/me` (app cold start).
final class AuthSessionRestored extends AuthEvent {
  const AuthSessionRestored();
}
