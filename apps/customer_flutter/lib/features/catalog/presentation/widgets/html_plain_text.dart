/// Best-effort HTML strip for tenant `about` (web uses `dangerouslySetInnerHTML`).
String stripHtmlToPlainText(String raw) {
  var s = raw.replaceAll(RegExp(r'<[^>]*>'), ' ');
  s = s.replaceAll('&nbsp;', ' ');
  s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
  return s;
}
