package com.bryan.donas.data

import androidx.test.core.app.ApplicationProvider
import android.content.Context
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.RecordedRequest
import okhttp3.mockwebserver.MockResponse
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class BackendSessionTest {
    private class Tokens : SessionTokens {
        var value: String? = null
        override fun save(refreshToken: String) { value = refreshToken }
        override fun refreshToken() = value
        override fun hasSession() = value != null
        override fun clear() { value = null }
    }
    private val tokens = Tokens()
    private val refreshes = AtomicInteger()
    @Volatile private var refreshStatus = 200
    @Volatile private var expiredLogin = true
    @Volatile private var rejectLoginAccess = false
    @Volatile private var restoreSupported = true
    private lateinit var server: MockWebServer
    private lateinit var client: BackendClient

    @Before fun setUp() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
          override fun dispatch(request: RecordedRequest): MockResponse {
            val path = request.requestUrl!!.encodedPath
            var status = 200
            val data = when (path) {
                "/api/auth/session" -> {
                    val body = JSONObject(request.body.readUtf8())
                    val refreshing = body.getString("grantType") == "refresh_token"
                    if (refreshing) { refreshes.incrementAndGet(); status = refreshStatus }
                    JSONObject().put("accessToken", if (refreshing) "renewed-access" else "first-access")
                        .put("refreshToken", if (refreshing) "rotated-refresh-token" else "original-refresh-token")
                        .put("role", "ADMIN").put("expiresAt", if (!refreshing && expiredLogin)
                            "2000-01-01T00:00:00.000Z" else "2099-01-01T00:00:00.000Z")
                }
                "/api/admin/orders" -> {
                    if (rejectLoginAccess && request.getHeader("Authorization") == "Bearer first-access") status = 401
                    JSONObject().put("orders", org.json.JSONArray())
                }
                "/api/sync" -> {
                    val body = JSONObject(request.body.readUtf8())
                    assertEquals("restore-device", body.getString("action"))
                    assertEquals(7L, body.getLong("serverSequence"))
                    if (restoreSupported) JSONObject().put("deviceId", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") else JSONObject()
                }
                else -> JSONObject()
            }
            val response = if (status == 200) JSONObject().put("ok", true).put("data", data)
                else JSONObject().put("ok", false).put("error", JSONObject().put("message", "Test failure").put("code", "INVALID_CREDENTIALS"))
            return MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(response.toString())
          }
        }
        server.start()
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("remote_device", Context.MODE_PRIVATE).edit().clear().commit()
        client = BackendClient(context, server.url("/").toString().trimEnd('/'), tokens)
    }
    @After fun tearDown() { server.shutdown() }

    private fun importedProof() = com.bryan.donas.data.db.SyncOutboxEntity(
        clientOperationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", localEventId = 1,
        type = "SALE", occurredAt = "2026-10-04T00:00:00.000Z", payloadJson = "{}",
        state = "ACKED", serverSequence = 7)

    @Test fun restoredBookKeepsOriginalDeviceBeforeAllowingUploads() = runBlocking {
        val prefs = ApplicationProvider.getApplicationContext<Context>().getSharedPreferences("remote_device", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("restoreNeedsIdentity", true).commit()
        client.login("admin@example.test", "password")
        assertFalse(client.canUpload)
        client.recoverRestoredDevice(importedProof())
        assertTrue(client.canUpload)
        assertEquals("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", prefs.getString("id", null))
        assertFalse(prefs.getBoolean("restoreNeedsIdentity", true))
    }

    @Test fun oldServerCannotReplayRestoredSalesUnderANewDevice() = runBlocking {
        val prefs = ApplicationProvider.getApplicationContext<Context>().getSharedPreferences("remote_device", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("restoreNeedsIdentity", true).commit()
        client.login("admin@example.test", "password")
        restoreSupported = false
        try { client.recoverRestoredDevice(importedProof()); fail("Restoration must remain blocked") }
        catch (_: IllegalStateException) { }
        assertFalse(client.canUpload)
        assertTrue(prefs.getBoolean("restoreNeedsIdentity", false))
        try { client.push(listOf(importedProof())); fail("Cannot upload without the original identity") }
        catch (_: IllegalStateException) { }
    }

    @Test fun temporaryFailuresKeepRenewableSession() = runBlocking {
        client.login("admin@example.test", "password")
        for (status in listOf(429, 502, 503)) {
            refreshStatus = status
            try { client.recentOrders(); fail("Expected temporary failure") } catch (_: BackendException) { }
            assertTrue(client.signedIn)
            assertEquals("original-refresh-token", tokens.value)
        }
        refreshStatus = 200
        client.recentOrders()
        assertEquals("rotated-refresh-token", tokens.value)
    }
    @Test fun concurrentRequestsRenewOnce() = runBlocking {
        client.login("admin@example.test", "password")
        (1..12).map { async { client.recentOrders() } }.awaitAll()
        assertEquals(1, refreshes.get())
        assertTrue(client.signedIn)
    }
    @Test fun rejectedAccessIsRetriedWithoutPassword() = runBlocking {
        expiredLogin = false; rejectLoginAccess = true
        client.login("admin@example.test", "password")
        client.recentOrders()
        assertEquals(1, refreshes.get())
        assertTrue(client.signedIn)
    }
    @Test fun revokedRenewalRequiresLogin() = runBlocking {
        client.login("admin@example.test", "password")
        refreshStatus = 401
        try { client.recentOrders(); fail("Expected revocation") } catch (_: BackendException) { }
        assertFalse(client.signedIn)
    }
}
