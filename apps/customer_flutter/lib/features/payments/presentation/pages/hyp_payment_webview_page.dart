import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../app/theme/app_colors.dart';

/// Opens Hyp / CreditGuard hosted payment page; closes when redirect hits `nmdcustomer://` (return page from backend).
class HypPaymentWebViewPage extends StatefulWidget {
  const HypPaymentWebViewPage({
    super.key,
    required this.paymentUrl,
  });

  final String paymentUrl;

  @override
  State<HypPaymentWebViewPage> createState() => _HypPaymentWebViewPageState();
}

class _HypPaymentWebViewPageState extends State<HypPaymentWebViewPage> {
  late final WebViewController _controller;
  var _loading = true;
  String? _loadError;
  bool _closed = false;

  void _finish(bool paid) {
    if (_closed) return;
    _closed = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).pop(paid);
    });
  }

  @override
  void initState() {
    super.initState();
    Uri? uri;
    try {
      final raw = widget.paymentUrl.trim();
      if (raw.isEmpty) {
        _loadError = 'رابط الدفع فارغ';
      } else {
        uri = Uri.parse(raw);
        if (!uri.hasScheme ||
            !(uri.scheme == 'http' || uri.scheme == 'https')) {
          _loadError = 'رابط الدفع غير صالح: $raw';
        }
      }
    } catch (e) {
      _loadError = 'رابط الدفع غير صالح: $e';
    }

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          onNavigationRequest: (req) {
            final u = req.url;
            if (u.startsWith('nmdcustomer://payment-success')) {
              _finish(true);
              return NavigationDecision.prevent;
            }
            if (u.startsWith('nmdcustomer://payment-cancel')) {
              _finish(false);
              return NavigationDecision.prevent;
            }
            if (u.contains('/payments/hyp/return')) {
              final uri = Uri.tryParse(u);
              final outcome =
                  uri?.queryParameters['outcome']?.toLowerCase() ?? '';
              final paymentStatus =
                  uri?.queryParameters['paymentStatus']?.toLowerCase() ?? '';
              final isPaid = outcome == 'success' ||
                  outcome == 'paid' ||
                  paymentStatus == 'success' ||
                  paymentStatus == 'paid';
              _finish(isPaid);
              return NavigationDecision.prevent;
            }
            if (u.startsWith('nmdcustomer://')) {
              final uri = Uri.tryParse(u);
              final status =
                  uri?.queryParameters['paymentStatus']?.toLowerCase() ??
                      uri?.queryParameters['status']?.toLowerCase() ??
                      '';
              final isPaid = status == 'success' || status == 'paid';
              _finish(isPaid);
              return NavigationDecision.prevent;
            }
            final uri = Uri.tryParse(u);
            final scheme = (uri?.scheme ?? '').toLowerCase();
            if (scheme != 'https' && scheme != 'http') {
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      );

    if (_loadError == null && uri != null) {
      // Direct bank URL mode: load absolute provider URL as-is (no internal rerouting).
      _controller.loadRequest(uri);
    } else {
      _loading = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.textPrimary,
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () => Navigator.of(context).pop(false),
          ),
          title: Text(
            'دفع بالبطاقة',
            style: GoogleFonts.cairo(fontWeight: FontWeight.w800, fontSize: 18),
          ),
        ),
        body: Stack(
          children: [
            if (_loadError == null) WebViewWidget(controller: _controller),
            if (_loadError != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    _loadError!,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.cairo(
                        fontSize: 15, color: AppColors.textPrimary),
                  ),
                ),
              ),
            if (_loading && _loadError == null)
              const Positioned.fill(
                child: ColoredBox(
                  color: Colors.white,
                  child: Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primaryTeal)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
