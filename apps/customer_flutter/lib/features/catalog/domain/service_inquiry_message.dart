/// WhatsApp prefill for professional / services leads (Now Market app parity).
String serviceInquiryWhatsAppMessage(String serviceName) {
  final name = serviceName.trim();
  return 'مرحباً، أود الاستفسار عن $name من خلال تطبيق Now Market.';
}

/// General inquiry to the business (store hero, bottom bar, primary CTA).
String storeServicesInquiryWhatsAppMessage() {
  return 'مرحباً، أود الاستفسار عن خدماتكم من خلال تطبيق Now Market.';
}
