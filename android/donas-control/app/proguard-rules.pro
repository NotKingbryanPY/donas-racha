# Room generates its own keep rules.

# AndroidJUnitRunner shares the optimized app's tracing dependency at runtime.
# Keep its public binary names so instrumentation can start against the official APK.
-keep class androidx.tracing.** { *; }

# The separate instrumentation APK also calls Kotlin/coroutine entry points that
# are otherwise inlined out of the app. Preserve their binary API across APKs.
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
