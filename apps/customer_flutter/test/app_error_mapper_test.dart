import 'package:customer_flutter/core/auth/auth_failure.dart';
import 'package:customer_flutter/core/errors/app_error_mapper.dart';
import 'package:customer_flutter/core/errors/app_error_type.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps Dio timeout to friendly Arabic copy', () {
    final presentation = AppErrorMapper.map(
      DioException(
        requestOptions: RequestOptions(path: '/markets'),
        type: DioExceptionType.connectionTimeout,
      ),
    );
    expect(presentation.type, AppErrorType.timeout);
    expect(presentation.title, 'تعذّر الاتصال');
    expect(presentation.message, contains('الاتصال'));
  });

  test('maps protected 401 with token to session expired copy', () {
    final requestOptions = RequestOptions(
      path: '/customer/orders',
      headers: {'Authorization': 'Bearer stale'},
    );
    final presentation = AppErrorMapper.map(
      DioException(
        requestOptions: requestOptions,
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: requestOptions,
          statusCode: 401,
        ),
      ),
    );
    expect(presentation.type, AppErrorType.unauthorized);
    expect(presentation.title, kSessionExpiredMessage);
  });

  test('maps public feed-campaigns 401 without session expired copy', () {
    final requestOptions = RequestOptions(
      path: '/markets/by-slug/dabburiyya/feed-campaigns',
      method: 'GET',
      headers: {'Authorization': 'Bearer stale'},
    );
    final presentation = AppErrorMapper.map(
      DioException(
        requestOptions: requestOptions,
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: requestOptions,
          statusCode: 401,
        ),
      ),
    );
    expect(presentation.type, AppErrorType.unknown);
    expect(presentation.title, isNot(kSessionExpiredMessage));
  });

  test('maps optional GET /rewards 401 without session expired copy', () {
    final requestOptions = RequestOptions(
      path: '/rewards',
      method: 'GET',
      headers: {'Authorization': 'Bearer stale'},
    );
    final presentation = AppErrorMapper.map(
      DioException(
        requestOptions: requestOptions,
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: requestOptions,
          statusCode: 401,
        ),
      ),
    );
    expect(presentation.type, AppErrorType.unknown);
    expect(presentation.title, isNot(kSessionExpiredMessage));
  });

  test('maps 503 to maintenance copy', () {
    final presentation = AppErrorMapper.mapHttpStatus(503);
    expect(presentation.type, AppErrorType.maintenance);
  });

  test('does not expose raw exception text in friendly message', () {
    final presentation = AppErrorMapper.map(
      DioException(
        requestOptions: RequestOptions(path: '/catalog'),
        type: DioExceptionType.unknown,
        message: 'DioException [connection timeout]: RAW_RESPONSE',
      ),
    );
    expect(presentation.message.toLowerCase(), isNot(contains('dioexception')));
    expect(presentation.message, isNot(contains('RAW_RESPONSE')));
  });
}
