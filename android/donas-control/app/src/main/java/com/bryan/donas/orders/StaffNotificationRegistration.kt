package com.bryan.donas.orders

import android.content.Context
import androidx.work.*
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BackendException
import com.bryan.donas.data.PushHealth
import com.bryan.donas.data.PushRegistration
import com.bryan.donas.data.OrderNotifications
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object StaffNotificationRegistration {
    fun request(context: Context): UUID? {
        val app = context.applicationContext as DonasApp
        val owner = app.backendClient.dailyOwner ?: return null
        if (!PushRegistration.initialize(context)) { PushHealth.failed(context, "FIREBASE_APK_NOT_CONFIGURED"); return null }
        val work = OneTimeWorkRequestBuilder<StaffNotificationRegistrationWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork("staff-fcm-register-$owner", ExistingWorkPolicy.APPEND_OR_REPLACE,
            work)
        return work.id
    }
    fun ensure(context: Context) {
        val owner = (context.applicationContext as DonasApp).backendClient.dailyOwner ?: return
        if (PushHealth.registrationDue(context) || !OrderNotifications.enabled(context)) request(context)
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("staff-fcm-renew-$owner", ExistingPeriodicWorkPolicy.UPDATE,
            PeriodicWorkRequestBuilder<StaffNotificationRegistrationWorker>(24, TimeUnit.HOURS)
                .setInitialDelay(24, TimeUnit.HOURS).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
    }
    fun stop(context: Context, owner: String) {
        WorkManager.getInstance(context).cancelUniqueWork("staff-fcm-register-$owner")
        WorkManager.getInstance(context).cancelUniqueWork("staff-fcm-renew-$owner")
        PushHealth.clear(context)
    }
}
class StaffNotificationRegistrationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as DonasApp
        val owner = app.backendClient.dailyOwner ?: return Result.success()
        if (!PushRegistration.initialize(app)) {
            PushHealth.failed(app, "FIREBASE_APK_NOT_CONFIGURED")
            return Result.failure()
        }
        return try {
            if (!OrderNotifications.enabled(app)) {
                app.backendClient.staffNotificationStop(owner)
                if (app.backendClient.dailyOwner == owner) PushHealth.failed(app, "ANDROID_NOTIFICATIONS_DISABLED")
                return Result.success()
            }
            val token = withTimeoutOrNull(30_000) { suspendCancellableCoroutine<String> { continuation ->
                FirebaseMessaging.getInstance().token.addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
                    .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
            } } ?: throw BackendException(503, "Firebase tardó demasiado; se reintentará el registro.", "FIREBASE_TOKEN_TIMEOUT")
            if (app.backendClient.dailyOwner != owner) return Result.success()
            val result = app.backendClient.staffNotificationRegister(owner, token)
            if (app.backendClient.dailyOwner != owner) return Result.success()
            PushHealth.registered(app, result)
            PushHealth.checked(app, app.backendClient.staffNotificationStatus(owner, true))
            Result.success() // Missing server credentials are a setup issue, never a permanent retry loop.
        } catch (e: CancellationException) { throw e
        } catch (e: BackendException) {
            if (app.backendClient.dailyOwner == owner) PushHealth.failed(app, e.code ?: "REGISTRATION_ERROR")
            if (e.status in listOf(400, 401, 403) || e.code == "NOTIFICATIONS_SETUP_REQUIRED") Result.failure() else Result.retry()
        } catch (_: Exception) {
            if (app.backendClient.dailyOwner == owner) PushHealth.failed(app, "NETWORK_OR_FIREBASE_ERROR")
            Result.retry()
        }
    }
}
class StaffMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { StaffNotificationRegistration.request(this) }
    override fun onMessageReceived(message: RemoteMessage) {
        val client = (application as DonasApp).backendClient
        val owner = client.dailyOwner ?: return
        if (message.data["ownerId"] != owner || message.data["deviceId"] != client.notificationDeviceId(owner)) return
        when (message.data["type"]) {
            "order_created" -> {
                val id = message.data["orderId"] ?: return
                if (!StaffOrderNotifications.validId(id)) return
                PushHealth.received(this, message.priority == RemoteMessage.PRIORITY_HIGH)
                StaffOrderNotifications.showOrder(this, owner, id)
                StaffInboxSync.request(this, message.priority == RemoteMessage.PRIORITY_HIGH)
            }
            "notification_test" -> {
                val id = message.data["eventId"] ?: return
                if (!StaffOrderNotifications.validId(id)) return
                PushHealth.received(this, message.priority == RemoteMessage.PRIORITY_HIGH)
                StaffOrderNotifications.showTest(this, owner, id)
            }
        }
    }
    override fun onDeletedMessages() { StaffInboxSync.request(this) }
}
