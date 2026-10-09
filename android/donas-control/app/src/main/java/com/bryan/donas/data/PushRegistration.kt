package com.bryan.donas.data

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.bryan.donas.BuildConfig
import com.bryan.donas.DonasApp
import androidx.work.*
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.CancellationException

object PushRegistration {
    val configured: Boolean get() = listOf(BuildConfig.FIREBASE_APP_ID, BuildConfig.FIREBASE_API_KEY,
        BuildConfig.FIREBASE_PROJECT_ID, BuildConfig.FIREBASE_SENDER_ID).all { it.isNotBlank() }
    fun initialize(context: Context): Boolean {
        if (!configured) return false
        if (FirebaseApp.getApps(context).isEmpty()) FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
            .setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID).build())
        return true
    }
    fun register(context: Context) {
        if (!initialize(context)) return
        schedule(context)
        val work = OneTimeWorkRequestBuilder<PushRegistrationWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork("donas-push-registration", ExistingWorkPolicy.REPLACE, work)
    }
    private fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<PushRegistrationWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(24, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("donas-push-renewal", ExistingPeriodicWorkPolicy.UPDATE, work)
    }
    fun ensureRegistered(context: Context) {
        if (!initialize(context)) return
        schedule(context)
        if (PushHealth.registrationDue(context)) register(context)
    }
    fun stop(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork("donas-push-registration")
        WorkManager.getInstance(context).cancelUniqueWork("donas-push-renewal")
        PushHealth.clear(context)
    }
}

class PushRegistrationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as DonasApp
        if (!app.backendClient.signedIn || !PushRegistration.initialize(app)) return Result.success()
        return try {
            val token = suspendCancellableCoroutine<String> { continuation ->
                FirebaseMessaging.getInstance().token.addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
                    .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
            }
            PushHealth.registered(app, app.backendClient.registerPush(token))
            val health = app.backendClient.pushStatus()
            PushHealth.checked(app, health)
            if (health.optJSONObject("check")?.optBoolean("validated") == false) Result.retry() else Result.success()
        } catch (e: CancellationException) { throw e
        } catch (e: BackendException) {
            PushHealth.failed(app, e.code ?: "REGISTRATION_ERROR")
            if (e.status in 400..499 && e.status != 429) Result.failure() else Result.retry()
        } catch (_: Exception) { PushHealth.failed(app, "NETWORK_OR_FIREBASE_ERROR"); Result.retry() }
    }
}

class DonasMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { PushRegistration.register(this) }
    override fun onMessageReceived(message: RemoteMessage) {
        if (!(application as DonasApp).backendClient.signedIn) return
        val id = message.data["orderId"] ?: return
        if (!runCatching { java.util.UUID.fromString(id) }.isSuccess) return
        val highPriority = message.priority == RemoteMessage.PRIORITY_HIGH
        PushHealth.received(this, highPriority)
        OrderNotifications.showNew(this, id, message.data["publicCode"].orEmpty())
        OrderSync.receivedPush(this, highPriority, message.messageId ?: java.util.UUID.randomUUID().toString())
    }
    override fun onDeletedMessages() {
        if ((application as DonasApp).backendClient.signedIn) OrderSync.receivedPush(this, false)
    }
}
