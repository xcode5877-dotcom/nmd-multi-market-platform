import 'package:dio/dio.dart';

import '../auth/auth_failure.dart';
import 'token_storage.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._tokenStorage);

  final TokenStorage _tokenStorage;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _tokenStorage.getCustomerToken().then((token) {
      final path = requestPath(options);
      final shouldAttach = shouldAttachCustomerToken(
        path,
        method: options.method,
      );
      if (shouldAttach && token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    }).catchError((_) {
      handler.next(options);
    });
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final status = err.response?.statusCode;
    if (status == 401) {
      final path = requestPath(err.requestOptions);
      final hadToken = requestHadBearerToken(err.requestOptions);
      final method = err.requestOptions.method;

      log401Intercept(
        path: path,
        hadToken: hadToken,
        statusCode: status,
        method: method,
      );

      final kind = classifyAuthFailure(
        path: path,
        hadToken: hadToken,
        statusCode: status,
        method: method,
      );
      err.requestOptions.extra['authFailureKind'] = kind;

      if (shouldClearTokenOn401(
        path: path,
        hadToken: hadToken,
        statusCode: status,
        method: method,
      )) {
        _tokenStorage.clear();
      }
    }
    handler.next(err);
  }
}
