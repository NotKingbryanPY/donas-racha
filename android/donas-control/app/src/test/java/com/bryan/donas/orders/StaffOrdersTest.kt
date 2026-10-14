package com.bryan.donas.orders

import android.app.NotificationManager
import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.DonasApp
import com.bryan.donas.daily.DailyActivity
import com.bryan.donas.data.BackendClient
import com.bryan.donas.data.SessionTokens
import com.bryan.donas.data.db.AppDatabase
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class StaffOrdersTest {
    private val owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    private val other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    private val id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    private fun row(value: String = id) = JSONObject().put("id", value).put("status", "PENDING").put("created_at", "2026-10-14T01:00:00.123456+00:00")
    private class Tokens : SessionTokens {
        override fun save(refreshToken: String) {}
        override fun refreshToken() = "test-refresh"
        override fun hasSession() = true
        override fun clear() {}
    }
    @Test fun cacheIsOwnerScopedAndTwoPagesAreRecoveredWithoutDroppingOlderActiveOrders() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        var pages = 0
        val fake = object : StaffOrderTransport {
            override val dailyOwner = owner
            override suspend fun staffOrderPage(owner: String, status: String?, cursor: JSONObject?, orderId: String?): JSONObject {
                if (status == null) return JSONObject().put("orders", JSONArray().put(row()))
                pages++
                return JSONObject().put("orders", JSONArray().put(row(if (cursor == null) id else other)))
                    .put("hasMore", cursor == null).put("nextCursor", JSONObject().put("id", id).put("createdAt", "time"))
            }
        }
        try {
            db.staffOrderDao().save(StaffOrderCache(other, "private-other-cache", 4))
            val pending = StaffInbox(db.staffOrderDao(), fake).refresh(owner)
            assertEquals(2, pending.size); assertEquals(2, pages)
            assertEquals(2, JSONObject(db.staffOrderDao().cache(owner)!!.json).getJSONArray("active").length())
            assertEquals("private-other-cache", db.staffOrderDao().cache(other)!!.json)
        } finally { db.close() }
    }
    @Test fun failedPageAndOwnerChangeNeverReplaceThePreviousCache() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        var current = owner
        val fake = object : StaffOrderTransport {
            override val dailyOwner get() = current
            override suspend fun staffOrderPage(owner: String, status: String?, cursor: JSONObject?, orderId: String?): JSONObject {
                current = other
                return JSONObject().put("orders", JSONArray().put(row())).put("hasMore", false)
            }
        }
        try {
            db.staffOrderDao().save(StaffOrderCache(owner, "previous-private-cache", 7))
            try { StaffInbox(db.staffOrderDao(), fake).refresh(owner); fail("Owner change must fail") } catch (_: IllegalArgumentException) {}
            assertEquals("previous-private-cache", db.staffOrderDao().cache(owner)!!.json)
            assertNull(db.staffOrderDao().cache(other))
        } finally { db.close() }
    }
    @Test fun notificationHasExactImmutableNativeTargetAndIsNotRepeatedAfterDismissal() {
        val app = ApplicationProvider.getApplicationContext<DonasApp>()
        BackendClient::class.java.getDeclaredField("sessions").apply { isAccessible = true }.set(app.backendClient, Tokens())
        app.getSharedPreferences("remote_device", Context.MODE_PRIVATE).edit().putString("dailyOwner", owner).commit()
        val manager = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancelAll()
        StaffOrderNotifications.showOrder(app, owner, id)
        val notification = shadowOf(manager).getNotification("$owner:$id", 0)
        assertNotNull(notification)
        val target = shadowOf(notification.contentIntent).savedIntent
        assertEquals(DailyActivity::class.java.name, target.component!!.className)
        assertEquals(id, target.getStringExtra("orderId")); assertEquals(owner, target.getStringExtra("notificationOwner"))
        assertTrue(shadowOf(notification.contentIntent).isImmutable)
        assertEquals(NotificationManager.IMPORTANCE_HIGH, manager.getNotificationChannel("new_orders").importance)
        assertNotNull(manager.getNotificationChannel("new_orders").sound)
        manager.cancel("$owner:$id", 0)
        StaffOrderNotifications.showOrder(app, owner, id)
        assertNull(shadowOf(manager).getNotification("$owner:$id", 0))
        StaffOrderNotifications.showOrder(app, other, other)
        assertNull(shadowOf(manager).getNotification("$other:$other", 0))
    }
    @Test fun detailFetchRejectsAResponseForAnotherOrder() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        val fake = object : StaffOrderTransport {
            override val dailyOwner = owner
            override suspend fun staffOrderPage(owner: String, status: String?, cursor: JSONObject?, orderId: String?) = JSONObject().put("orders", JSONArray().put(row(other)))
        }
        try {
            try { StaffInbox(db.staffOrderDao(), fake).detail(owner, id); fail("Must reject wrong order") } catch (_: IllegalArgumentException) {}
        } finally { db.close() }
    }
}
