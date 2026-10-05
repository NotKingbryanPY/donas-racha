# Room generates its own keep rules.

# AndroidJUnitRunner shares the optimized app's tracing dependency at runtime.
# Keep its public binary names so instrumentation can start against the official APK.
-keep class androidx.tracing.** { *; }
