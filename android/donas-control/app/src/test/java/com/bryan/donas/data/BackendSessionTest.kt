package com.bryan.donas.data

import androidx.test.core.app.ApplicationProvider
import android.content.Context
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.util.concurrent.Executors
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
    private lateinit var server: HttpServer
    private val pool = Executors.newCachedThreadPool()
    private lateinit var client: BackendClient

    @Before fun setUp() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.executor = pool
        server.createContext("/") { exchange ->
            val path = exchange.requestURI.path
            var status = 200
            val data = when (path) {
                "/api/auth/session" -> {
                    val request = JSONObject(exchange.requestBody.bufferedReader().readText())
                    val refreshing = request.getString("grantType") == "refresh_token"
                    if (refreshing) { refreshes.incrementAndGet(); status = refreshStatus }
                    JSONObject().put("accessToken", if (refreshing) "renewed-access" else "first-access")
                        .put("refreshToken", if (refreshing) "rotated-refresh-token" else "original-refresh-token")
                        .put("role", "ADMIN").put("expiresAt", if (!refreshing && expiredLogin)
                            "2000-01-01T00:00:00.000Z" else "2099-01-01T00:00:00.000Z")
                }
                "/api/admin/orders" -> {
                    if (rejectLoginAccess && exchange.requestHeaders.getFirst("Authorization") == "Bearer first-access") status = 401
                    JSONObject().put("orders", org.json.JSONArray())
                }
                else -> JSONObject()
            }
            val response = if (status == 200) JSONObject().put("ok", true).put("data", data)
                else JSONObject().put("ok", false).put("error", JSONObject().put("message", "Test failure").put("code", "INVALID_CREDENTIALS"))
            val bytes = response.toString().toByteArray()
            exchange.sendResponseHeaders(status, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
            exchange.close()
        }
        server.start()
        val context = ApplicationProvider.getApplicationContext<Context>()
        client = BackendClient(context, "http://127.0.0.1:${server.address.port}", tokens)
    }
    @After fun tearDown() { server.stop(0); pool.shutdownNow() }

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
