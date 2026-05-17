import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';

/// Configures Dio to use [IOHttpClientAdapter] with optional relaxed TLS for local/dev.
///
/// When [allowBadCertificates] is true, [HttpClient.badCertificateCallback] accepts any
/// server certificate (self-signed, hostname mismatch, etc.). **Never enable in release.**
void applyNmdDioIoHttpAdapter(Dio dio, {required bool allowBadCertificates}) {
  dio.httpClientAdapter = IOHttpClientAdapter(
    createHttpClient: () {
      final client = HttpClient();
      if (allowBadCertificates) {
        client.badCertificateCallback =
            (X509Certificate cert, String host, int port) => true;
      }
      return client;
    },
  );
}
