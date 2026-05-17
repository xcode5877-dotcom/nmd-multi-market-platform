import 'package:dio/dio.dart';

import 'dio_io_adapter_stub.dart'
    if (dart.library.io) 'dio_io_adapter_impl.dart';

/// Applies platform-appropriate HTTP adapter and TLS behavior for NMD APIs.
void configureNmdDioHttpAdapter(Dio dio, {required bool allowBadCertificates}) {
  applyNmdDioIoHttpAdapter(dio, allowBadCertificates: allowBadCertificates);
}
