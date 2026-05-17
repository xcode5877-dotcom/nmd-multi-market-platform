import 'package:dio/dio.dart';

import 'token_storage.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._tokenStorage);

  final TokenStorage _tokenStorage;

  bool _needsCustomerToken(RequestOptions options) {
    // Prefer full URI path so `/api/customer/...` (merged baseUrl + path) still matches.
    final path = options.uri.path.isNotEmpty ? options.uri.path : options.path;
    final normalized = path.startsWith('/') ? path : '/$path';
    final method = options.method.toUpperCase();

    if (normalized.contains('/customer/')) return true;
    // Web parity: ContestPopUp sends Bearer for `/contest/me` and `/contest/participate`.
    if (normalized.contains('/contest/me') ||
        normalized.contains('/contest/participate')) {
      return true;
    }
    if (normalized.startsWith('/coupons/validate')) return true;
    if (normalized.endsWith('/coupons/validate')) return true;
    if ((normalized == '/orders' || normalized.endsWith('/orders')) &&
        method == 'POST') {
      return true;
    }
    return false;
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _tokenStorage.getCustomerToken().then((token) {
      if (_needsCustomerToken(options) && token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    }).catchError((_) {
      handler.next(options);
    });
  }
}
