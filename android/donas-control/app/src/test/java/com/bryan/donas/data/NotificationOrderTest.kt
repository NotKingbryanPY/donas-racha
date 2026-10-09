package com.bryan.donas.data

import android.app.Application
import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.data.db.AppDatabase
import com.bryan.donas.data.db.RemoteOrderEntity
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class NotificationOrderTest {
    @Test fun notificationSelectsAnOldCachedOrderWithoutIncreasingThePageSize() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        try {
            val old = RemoteOrderEntity("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "DR-OLD", "PENDING",
                "CASH", "PENDING", "Local", "Cliente", "", 100L,
                "2000-01-01T00:00:00Z", "2000-01-01T00:00:00Z", "[]")
            db.syncDao().upsertOrders(listOf(old) + (1..100).map {
                old.copy(id = "new-$it", publicCode = "DR-$it", createdAt = "2026-10-08T00:00:00Z")
            })
            assertFalse(db.syncDao().recentOrders().any { it.id == old.id })
            val selected = db.syncDao().recentOrders(old.id)
            assertEquals(100, selected.size)
            assertEquals(old.id, selected.first().id)
        } finally { db.close() }
    }

    @Test fun targetedNetworkLookupPreservesAuthorizationAndUsesOneResult() = runBlocking {
        val server = MockWebServer()
        server.enqueue(MockResponse().setHeader("Content-Type", "application/json")
            .setBody("""{"ok":true,"data":{"orders":[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]}}"""))
        server.start()
        try {
            val credential = "drd.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb." + "x".repeat(43)
            val tokens = object : SessionTokens {
                override fun hasSession() = true
                override fun refreshToken() = credential
                override fun save(refreshToken: String) {}
                override fun clear() {}
            }
            val context = ApplicationProvider.getApplicationContext<Context>()
            val client = BackendClient(context, server.url("/").toString().trimEnd('/'), tokens)
            val id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            assertEquals(id, client.recentOrders(id).getJSONObject(0).getString("id"))
            val request = server.takeRequest()
            assertEquals(id, request.requestUrl!!.queryParameter("orderId"))
            assertEquals("1", request.requestUrl!!.queryParameter("limit"))
            assertEquals("Bearer $credential", request.getHeader("Authorization"))
        } finally { server.shutdown() }
    }
}
