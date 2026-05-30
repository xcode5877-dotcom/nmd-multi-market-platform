import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../api/api_base.dart';
import 'app_error_type.dart';

/// Friendly Arabic copy for a mapped error.
final class AppErrorPresentation {
  const AppErrorPresentation({
    required this.type,
    required this.title,
    required this.message,
  });

  final AppErrorType type;
  final String title;
  final String message;
}

/// Maps network/API failures to customer-safe Arabic messages.
/// Technical details belong in [log] only.
abstract final class AppErrorMapper {
  static AppErrorPresentation map(Object error) {
    if (error is DioException) {
      return _fromDio(error);
    }
    if (error is SocketException) {
      return _copy(AppErrorType.noConnection);
    }
    if (error is AppErrorPresentation) {
      return error;
    }
    final text = error.toString().toLowerCase();
    if (text.contains('socketexception') ||
        text.contains('network is unreachable') ||
        text.contains('failed host lookup') ||
        text.contains('connection refused')) {
      return _copy(AppErrorType.noConnection);
    }
    if (text.contains('timeout') || text.contains('timed out')) {
      return _copy(AppErrorType.timeout);
    }
    return _copy(AppErrorType.unknown);
  }

  static AppErrorPresentation mapHttpStatus(int? statusCode) {
    if (statusCode == 401) return _copy(AppErrorType.unauthorized);
    if (statusCode == 404) return _copy(AppErrorType.notFound);
    if (statusCode == 503) return _copy(AppErrorType.maintenance);
    if (statusCode != null && statusCode >= 500) {
      return _copy(AppErrorType.server);
    }
    if (statusCode != null && statusCode >= 400) {
      return _copy(AppErrorType.server);
    }
    return _copy(AppErrorType.unknown);
  }

  static String friendlyMessage(Object error) => map(error).message;

  static String get unknownMessage => _messages[AppErrorType.unknown]!;

  static String friendlyTitle(Object error) => map(error).title;

  /// Logs endpoint, status, and type for developers — never shown in UI.
  static void log(
    Object error, {
    String? context,
    int? statusCode,
    String? endpoint,
  }) {
    final prefix = context != null ? '[AppError:$context]' : '[AppError]';
    if (error is DioException) {
      final path = endpoint ?? error.requestOptions.uri.toString();
      final method = error.requestOptions.method;
      final code = statusCode ?? error.response?.statusCode;
      final type = error.type.name;
      nmdDebugLog(
        '$prefix type=$type status=$code $method $path message=${error.message}',
      );
      if (kDebugMode) {
        debugPrint('$prefix raw=${error.toString()}');
        final data = error.response?.data;
        if (data != null) {
          debugPrint('$prefix response=$data');
        }
      }
      return;
    }
    nmdDebugLog('$prefix ${error.toString()}');
    if (kDebugMode) {
      debugPrint('$prefix raw=${error.toString()}');
    }
  }

  static void logHttp({
    required String context,
    int? statusCode,
    String? endpoint,
    String? rawResponse,
    String? errorMessage,
  }) {
    nmdDebugLog(
      '[AppError:$context] status=$statusCode endpoint=$endpoint '
      'error=$errorMessage',
    );
    if (kDebugMode && rawResponse != null && rawResponse.isNotEmpty) {
      debugPrint('[AppError:$context] RAW_RESPONSE: $rawResponse');
    }
  }

  static AppErrorPresentation _fromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return _copy(AppErrorType.timeout);
      case DioExceptionType.connectionError:
        return _copy(AppErrorType.noConnection);
      case DioExceptionType.badResponse:
        return mapHttpStatus(error.response?.statusCode);
      case DioExceptionType.cancel:
        return _copy(AppErrorType.unknown);
      case DioExceptionType.badCertificate:
        return _copy(AppErrorType.noConnection);
      case DioExceptionType.unknown:
        final inner = error.error;
        if (inner != null && inner != error) {
          return map(inner);
        }
        return _copy(AppErrorType.unknown);
    }
  }

  static AppErrorPresentation _copy(AppErrorType type) {
    return AppErrorPresentation(
      type: type,
      title: _titles[type]!,
      message: _messages[type]!,
    );
  }

  static const _titles = {
    AppErrorType.noConnection: 'لا يوجد اتصال بالإنترنت',
    AppErrorType.timeout: 'تعذّر الاتصال',
    AppErrorType.server: 'حدثت مشكلة مؤقتة',
    AppErrorType.notFound: 'المحتوى غير متوفر',
    AppErrorType.unauthorized: 'انتهت الجلسة',
    AppErrorType.maintenance: 'الخدمة قيد الصيانة',
    AppErrorType.unknown: 'حدث خطأ غير متوقع',
  };

  static const _messages = {
    AppErrorType.noConnection:
        'تأكد من تشغيل الواي فاي أو بيانات الهاتف ثم أعد المحاولة.',
    AppErrorType.timeout:
        'نواجه صعوبة في الاتصال الآن. يرجى التأكد من الإنترنت والمحاولة مرة أخرى.',
    AppErrorType.server:
        'نحاول حل المشكلة. يرجى المحاولة بعد قليل.',
    AppErrorType.notFound:
        'لم نجد ما تبحث عنه. قد يكون المحتوى غير متاح حالياً.',
    AppErrorType.unauthorized:
        'يرجى تسجيل الدخول مرة أخرى للمتابعة.',
    AppErrorType.maintenance:
        'نقوم بتحسين الخدمة حالياً. يرجى المحاولة بعد قليل.',
    AppErrorType.unknown:
        'لم نتمكن من إتمام العملية الآن. حاول مرة أخرى.',
  };
}
