package com.bryan.donas.data

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class PushRecoveryTest {
    @Test fun pushDuringExistingSyncLeavesAnotherPullAndRecoversAfterCancellation() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkManagerTestInitHelper.initializeTestWorkManager(context,
            Configuration.Builder().setExecutor(java.util.concurrent.Executor { it.run() }).build())
        val manager = WorkManager.getInstance(context)
        OrderSync.request(context)
        OrderSync.receivedPush(context, false, "first")
        OrderSync.receivedPush(context, false, "second")
        OrderSync.receivedPush(context, false, "second")
        val first = manager.getWorkInfosByTag("donas-order-push").get()
        assertEquals(2, first.size)
        assertEquals(0, first.count { it.state == WorkInfo.State.BLOCKED })
        assertEquals(2, first.count { it.state == WorkInfo.State.ENQUEUED })
        assertEquals(1, manager.getWorkInfosForUniqueWork("donas-order-sync").get().size)
        manager.cancelAllWorkByTag("donas-order-push").result.get()
        OrderSync.receivedPush(context, false, "third")
        assertTrue(manager.getWorkInfosForUniqueWork("donas-order-push-third").get().any { it.state == WorkInfo.State.ENQUEUED })
    }

    @Test @Config(sdk = [31]) fun highPriorityHasQuotaFallbackAndNormalPushRemainsOrdinary() {
        assertTrue(OrderSync.pushWork(true).workSpec.expedited)
        assertEquals(androidx.work.OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST,
            OrderSync.pushWork(true).workSpec.outOfQuotaPolicy)
        assertFalse(OrderSync.pushWork(false).workSpec.expedited)
    }

    @Test @Config(sdk = [23]) fun oldAndroidDoesNotStartAnUnsupportedExpeditedForegroundService() {
        assertFalse(OrderSync.pushWork(true).workSpec.expedited)
    }

    @Test fun registeredPhoneDoesNotHideAnUnconfiguredServerAndStatusPersists() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        PushHealth.clear(context)
        PushHealth.registered(context, JSONObject("""{"registered":true,"configured":{"android":false},"retryConfigured":false}"""))
        assertFalse(PushHealth.registrationDue(context))
        assertTrue(PushHealth.summary(context, true, true).contains("servidor no tiene configurado"))
        PushHealth.checked(context, JSONObject("""{"configured":{"android":true},"check":{"status":"FCM_AUTH_FAILED"}}"""))
        assertTrue(PushHealth.summary(context, true, true).contains("FCM_AUTH_FAILED"))
        PushHealth.checked(context, JSONObject("""{"configured":{"android":true},"check":{"status":"FCM_VALIDATED"}}"""))
        PushHealth.received(context, true)
        assertTrue(PushHealth.summary(context, true, true).contains("Último push recibido"))
        PushHealth.failed(context, "NETWORK_ERROR")
        assertTrue(PushHealth.registrationDue(context))
        assertTrue(PushHealth.summary(context, true, true).contains("NETWORK_ERROR"))
        PushHealth.clear(context)
        assertTrue(PushHealth.registrationDue(context))
    }

    @Test fun blockedChannelDoesNotMarkAnUnshownOrderAsNotified() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel("new_orders", "Pedidos nuevos", NotificationManager.IMPORTANCE_NONE))
        val id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        assertFalse(OrderNotifications.enabled(context))
        OrderNotifications.showNew(context, id, "DR-TEST")
        assertFalse(context.getSharedPreferences("order_alerts", Context.MODE_PRIVATE).contains(id))
    }
}
