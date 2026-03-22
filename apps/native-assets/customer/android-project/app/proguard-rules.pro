# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /sdk/tools/proguard/proguard-android.txt

# Keep WebView JavaScript interface
-keepclassmembers class com.nmd.customer.app.NMDWebBridge { *; }

# Keep Firebase Messaging
-keep class com.google.firebase.messaging.** { *; }
