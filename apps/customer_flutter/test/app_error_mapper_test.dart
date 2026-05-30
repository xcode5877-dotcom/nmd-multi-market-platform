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

  test('maps 401 to unauthorized copy', () {
    final presentation = AppErrorMapper.map(
      DioException(
        requestOptions: RequestOptions(path: '/customer/orders'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/customer/orders'),
          statusCode: 401,
        ),
      ),
    );
    expect(presentation.type, AppErrorType.unauthorized);
    expect(presentation.title, 'انتهت الجلسة');
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
