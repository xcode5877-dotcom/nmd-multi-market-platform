import 'models/market.dart';

/// Result of loading markets for the picker UI (includes server diagnostics for on-device debugging).
class MarketsPickerLoadResult {
  const MarketsPickerLoadResult({
    required this.markets,
    required this.showDiagnostics,
    this.statusCode,
    this.rawResponse,
    this.errorMessage,
  });

  final List<Market> markets;

  /// True when the HTTP layer failed or the API returned no usable rows (before fallback).
  final bool showDiagnostics;
  final int? statusCode;
  final String? rawResponse;
  final String? errorMessage;

  String get diagnosticClipboardText {
    final buf = StringBuffer();
    buf.writeln('HTTP status: ${statusCode ?? '—'}');
    if (errorMessage != null && errorMessage!.isNotEmpty) {
      buf.writeln('Error: $errorMessage');
    }
    buf.writeln('RAW_RESPONSE:');
    buf.write(rawResponse ?? '(null)');
    return buf.toString();
  }
}
