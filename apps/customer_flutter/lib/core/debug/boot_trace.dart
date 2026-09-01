/// Release-visible cold-start tracing (not gated on kDebugMode).
void bootTrace(String message) {
  // ignore: avoid_print
  print('[BOOT] $message');
}

void bootTraceError(String phase, Object error, [StackTrace? stack]) {
  bootTrace('ERROR phase=$phase error=$error');
  if (stack != null) {
    // ignore: avoid_print
    print(stack);
  }
}
