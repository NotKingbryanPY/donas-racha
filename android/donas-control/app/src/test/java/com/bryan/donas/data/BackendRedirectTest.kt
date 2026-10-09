package com.bryan.donas.data

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class BackendRedirectTest {
    private class Tokens : SessionTokens {
        var value: String? = null
        override fun save(refreshToken: String) { value = refreshToken }
        override fun refreshToken() = value
        override fun hasSession() = value != null
        override fun clear() { value = null }
    }
    private lateinit var server: MockWebServer
    private lateinit var client: BackendClient
    private val tokens = Tokens()

    @Before fun setup() {
        server = MockWebServer()
        server.start()
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("remote_device", Context.MODE_PRIVATE).edit().clear().commit()
        client = BackendClient(context, server.url("/").toString().trimEnd('/'), tokens)
    }
    @After fun teardown() { server.shutdown() }
    private fun session() = MockResponse().setHeader("Content-Type", "application/json").setBody(
        """{"ok":true,"data":{"accessToken":"access","refreshToken":"refresh","role":"ADMIN","expiresAt":"2099-01-01T00:00:00.000Z"}}""")
    private fun redirect(status: Int, location: String) = MockResponse().setResponseCode(status).setHeader("Location", location)

    @Test fun permanentRedirectKeepsLoginPostAndCredentials() = runBlocking {
        server.enqueue(redirect(308, "/api/auth/session"))
        server.enqueue(session())
        client.login("admin@example.test", "password")
        val original = server.takeRequest()
        val redirected = server.takeRequest()
        assertEquals("POST", redirected.method)
        assertEquals(original.body.readUtf8(), redirected.body.readUtf8())
        assertTrue(client.signedIn)
    }

    @Test fun temporaryRedirectKeepsAuthenticatedPostBodyAndToken() = runBlocking {
        server.enqueue(session())
        client.login("admin@example.test", "password")
        server.takeRequest()
        server.enqueue(redirect(307, "/api/admin/customers/devices"))
        server.enqueue(MockResponse().setBody("""{"ok":true,"data":{}}"""))
        client.registerPush("push-token")
        val original = server.takeRequest()
        val redirected = server.takeRequest()
        assertEquals("POST", redirected.method)
        assertEquals("Bearer access", redirected.getHeader("Authorization"))
        assertEquals(original.body.readUtf8(), redirected.body.readUtf8())
    }

    @Test fun redirectCannotExposePasswordToAnotherOrigin() = runBlocking {
        val destination = MockWebServer()
        destination.start()
        try {
            server.enqueue(redirect(308, destination.url("/api/auth/session").toString()))
            try { client.login("admin@example.test", "password"); fail("Must reject another origin") }
            catch (error: BackendException) { assertEquals("UNSAFE_REDIRECT", error.code) }
            assertEquals(0, destination.requestCount)
            assertFalse(client.signedIn)
        } finally { destination.shutdown() }
    }

    @Test fun redirectLoopStopsAfterTwoHops() = runBlocking {
        repeat(3) { server.enqueue(redirect(308, "/api/auth/session")) }
        try { client.login("admin@example.test", "password"); fail("Must stop redirect loop") }
        catch (error: BackendException) { assertEquals("UNSAFE_REDIRECT", error.code) }
        assertEquals(3, server.requestCount)
    }

    @Test fun cachedResponseDoesNotEraseSessionOrInventOrders() = runBlocking {
        server.enqueue(session())
        client.login("admin@example.test", "password")
        server.takeRequest()
        server.enqueue(MockResponse().setResponseCode(304))
        try { client.recentOrders(); fail("304 has no order data") }
        catch (error: BackendException) {
            assertEquals(304, error.status)
            assertTrue(error.message!!.contains("caché"))
        }
        assertTrue(client.signedIn)
        assertEquals("no-store", server.takeRequest().getHeader("Cache-Control"))
        server.enqueue(MockResponse().setBody("""{"ok":true,"data":{"orders":[]}}"""))
        assertEquals(0, client.recentOrders().length())
    }
}
