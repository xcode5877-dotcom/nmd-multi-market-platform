import 'package:dio/dio.dart';

/// Web / non-IO: default Dio adapter (browser). No custom TLS.
void applyNmdDioIoHttpAdapter(Dio dio, {required bool allowBadCertificates}) {}
