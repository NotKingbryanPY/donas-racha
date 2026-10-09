package com.bryan.donas.data

import android.app.Application
import android.app.NotificationManager
import android.content.Context
import androidx.core.content.edit
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.ui.OrdersActivity
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@android.annotation.TargetApi(28)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class OrderNotificationsTest {
    @Test fun ordersHaveDistinctTargetsAndSeenAlertsSurviveCancellation() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("order_alerts", Context.MODE_PRIVATE).edit(commit = true) { clear() }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancelAll()
        val a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        val b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        OrderNotifications.showNew(context, a, "DR-A")
        OrderNotifications.showNew(context, b, "DR-B")
        val first = shadowOf(manager).getNotification(a, 0)
        val second = shadowOf(manager).getNotification(b, 0)
        assertNotNull(first); assertNotNull(second)
        val targetA = shadowOf(first.contentIntent).savedIntent
        val targetB = shadowOf(second.contentIntent).savedIntent
        assertEquals(OrdersActivity::class.java.name, targetA.component!!.className)
        assertEquals(a, targetA.getStringExtra("orderId"))
        assertEquals(b, targetB.getStringExtra("orderId"))
        assertNotEquals(targetA.data, targetB.data)
        assertTrue(shadowOf(first.contentIntent).isImmutable)
        assertEquals(NotificationManager.IMPORTANCE_HIGH, manager.getNotificationChannel("new_orders").importance)
        assertNotNull(manager.getNotificationChannel("new_orders").sound)
        manager.cancel(a, 0)
        OrderNotifications.showNew(context, a, "DR-A")
        assertNull(shadowOf(manager).getNotification(a, 0))
    }
}