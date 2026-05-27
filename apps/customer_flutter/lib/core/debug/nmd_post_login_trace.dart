import 'dart:developer' as developer;

/// Temporary instrumentation for Apple Review / post-auth navigation debugging.
/// Remove or narrow once the rejection is cleared.
void nmdPostLoginTrace(String tag, [Object? detail]) {
  final msg =
      detail == null ? tag : '$tag :: $detail';
  developer.log(msg, name: 'NMD_POST_LOGIN');
}
