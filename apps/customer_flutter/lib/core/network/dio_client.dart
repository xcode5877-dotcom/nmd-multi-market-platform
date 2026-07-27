import 'dart:convert';
import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../api/api_base.dart';
import '../errors/app_error_mapper.dart';
import 'auth_interceptor.dart';
import 'dio_io_adapter.dart';
import 'ssl_error_utils.dart';
import 'token_storage.dart';

/// Nginx exposes mock-api at `https://nmd.marketing/api/...`. Ensures [baseUrl] has no trailing
/// slash, ends with `/api`, and [path] starts with `/` so the final URL is never `.../api//...`.
void _ensureNmdGatewayUrl(RequestOptions o) {
  var base = kStorefrontApiBase.replaceAll(RegExp(r'/+$'), '');
  if (!base.endsWith('/api')) {
    base = '$base/api';
  }
  o.baseUrl = base;
  final p = o.path;
  if (p.isEmpty) return;
  if (!p.startsWith('/')) {
    o.path = '/$p';
  }
  if (o.baseUrl.endsWith('/') && o.path.startsWith('/')) {
    o.path = o.path.substring(1);
  }
}

final class DioClient {
  DioClient._();

  static Dio create(TokenStorage tokenStorage) {
    final resolvedBase = kStorefrontApiBase;
    final baseUri = Uri.tryParse(resolvedBase);
    if (baseUri != null &&
        nmdApiHostLooksLikeIp(baseUri.host) &&
        (kDebugMode || kNmdApiLog)) {
      debugPrint(
        '[Dio] WARNING: API base host "${baseUri.host}" looks like an IP. '
        'TLS certs are usually issued for a domain; use '
        '--dart-define=NMD_API_BASE=https://your-domain/api to avoid hostname mismatch.',
      );
    }
    if (kDebugMode || kNmdApiLog) {
      debugPrint(
        '[Dio] API base: $resolvedBase (production lock: $kNmdApiLockedToProduction, '
        'relaxSsl: $kNmdRelaxSslVerification)',
      );
    }
    final dio = Dio(
      BaseOptions(
        baseUrl: resolvedBase,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        headers: const {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'origin': 'https://nmd.marketing',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
          'Referer': 'https://nmd.marketing',
          'Origin': 'https://nmd.marketing',
        },
      ),
    );

    configureNmdDioHttpAdapter(dio,
        allowBadCertificates: kNmdRelaxSslVerification);

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          _ensureNmdGatewayUrl(options);
          // Opt in to Measurement V2 fractional quantities / order presentation.
          options.headers['X-Nmd-Supports-Measurement-V2'] = 'true';
          final url = options.uri.toString();
          if (kDebugMode || kNmdApiLog) {
            developer.log(url, name: 'NMD_HTTP');
            debugPrint('[NMD_HTTP] ${options.method} $url');
          }
          handler.next(options);
        },
        onError: (e, handler) {
          final u = e.requestOptions.uri.toString();
          AppErrorMapper.log(
            e,
            context: 'dio',
            endpoint: u,
          );
          if (kDebugMode || kNmdApiLog) {
            developer.log('ERROR ${e.response?.statusCode} $u ${e.message}',
                name: 'NMD_HTTP');
            debugPrint(
                '[NMD_HTTP] ERROR ${e.response?.statusCode} $u ${e.message}');
          }
          if (dioExceptionLooksLikeTlsFailure(e)) {
            final detail = describeDioTlsIssue(e);
            if (kDebugMode || kNmdApiLog) {
              developer.log(detail, name: 'NMD_TLS');
              debugPrint('[NMD_TLS] $detail');
            }
          }
          handler.next(e);
        },
        onResponse: (response, handler) {
          final raw = response.data;
          if (raw is String) {
            final s = raw.trim();
            if (s.startsWith('{') || s.startsWith('[')) {
              try {
                response.data = jsonDecode(s);
              } catch (_) {
                // Keep raw string when backend returns non-JSON text.
              }
            }
          }
          handler.next(response);
        },
      ),
    );

    dio.interceptors.add(AuthInterceptor(tokenStorage));
    return dio;
  }
}
