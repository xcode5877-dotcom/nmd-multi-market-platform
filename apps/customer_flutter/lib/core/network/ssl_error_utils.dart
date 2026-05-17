import 'package:dio/dio.dart';

/// Human-readable TLS / certificate context for logs and support.
String describeDioTlsIssue(DioException e) {
  final buf = StringBuffer('TLS/SSL handshake or certificate problem');
  final uri = e.requestOptions.uri;
  buf.write(
      ' (host=${uri.host}, port=${uri.hasPort ? uri.port : (uri.scheme == 'https' ? 443 : 80)})');

  final parts = <String>[];
  void addFrom(Object? o) {
    if (o == null) return;
    final s = o.toString();
    if (s.isEmpty) return;
    if (s.contains('HandshakeException') ||
        s.contains('CERTIFICATE_VERIFY_FAILED') ||
        s.contains('Hostname mismatch') ||
        s.contains('Bad certificate') ||
        s.contains('CertificateException')) {
      parts.add(s);
    }
  }

  addFrom(e.message);
  addFrom(e.error);

  if (parts.isEmpty) {
    final m = e.message ?? '';
    if (m.isNotEmpty) parts.add(m);
  }
  if (parts.isNotEmpty) {
    buf.write(': ${parts.join(' | ')}');
  }
  return buf.toString();
}

bool dioExceptionLooksLikeTlsFailure(DioException e) {
  bool hit(String? s) {
    if (s == null || s.isEmpty) return false;
    return s.contains('HandshakeException') ||
        s.contains('CERTIFICATE_VERIFY_FAILED') ||
        s.contains('Hostname mismatch') ||
        s.contains('Bad certificate') ||
        s.contains('TlsException') ||
        s.contains('CERTIFICATE');
  }

  if (hit(e.message)) return true;
  final err = e.error;
  if (err != null && hit(err.toString())) return true;
  return e.type == DioExceptionType.connectionError && hit(e.message);
}
